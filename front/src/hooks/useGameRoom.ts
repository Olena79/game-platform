import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import type { GameRoomState, ChatMessage } from '../components/gameroom/types'
import { resolveGameCode } from '../actions/games'
import { sfx } from '../utils/sounds'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface LKData { token: string; url: string; roomName: string }
export interface BreakoutInvite { roomId: string; roomName: string; imageUrl: string }

// rawCode is whatever is in the URL — could be gameCode or spectatorCode
export function useGameRoom(rawCode: string) {
	const { user, token: authToken, forceRefresh } = useAuth()
	const socketRef = useRef<Socket | null>(null)
	const [state, setState]                   = useState<GameRoomState | null>(null)
	const [connected, setConnected]           = useState(false)
	const [lk, setLk]                         = useState<LKData | null>(null)
	const [lkBreakout, setLkBreakout]         = useState<LKData | null>(null)
	const [breakoutInvite, setBreakoutInvite] = useState<BreakoutInvite | null>(null)
	const [endAnim, setEndAnim]               = useState(false)
	const [startAnim, setStartAnim]           = useState(false)
	const [error, setError]                   = useState<string | null>(null)
	const [connStatus, setConnStatus]         = useState<'connecting' | 'connected' | 'failed'>('connecting')
	const [playerReactions, setPlayerReactions] = useState<Record<string, { emoji: string; key: number }>>({})
	const [privateChats, setPrivateChats] = useState<Record<string, ChatMessage[]>>({})
	const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({})
	// 'all' is the room-wide command, 'self' is addressed to this person
	const [shouldMute, setShouldMute] = useState<'all' | 'self' | null>(null)
	const [newPublicMsgSignal, setNewPublicMsgSignal] = useState(0)
	const [recordStatus, setRecordStatus] = useState<string>('')
	const [recordError, setRecordError] = useState('')
	// The GM's image deck and a signal that the server delivered the notes
	const [gmImages, setGmImages] = useState<string[]>([])
	const gmImagesRef = useRef<string[]>([])
	const [notesDelivered, setNotesDelivered] = useState(0)
	// How this server records ('browser' | 'egress'), and a nudge when the
	// game is over and a browser recording should finish
	const [recordingMode, setRecordingMode] = useState<'browser' | 'egress'>('browser')
	const [recordStopSignal, setRecordStopSignal] = useState(0)
	const [scenario, setScenario] = useState('')
	const [actionError, setActionError] = useState('')
	// How far this device's clock sits from the room's
	const [clockOffset, setClockOffset] = useState(0)
	// What this person voted for: an anonymous vote no longer says so in the state
	const [myVote, setMyVote] = useState<{ voteId: string; optionIds: string[] } | null>(null)
	const reactionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
	const prevStatusRef = useRef<string>('')
	// Refs that mirror state so async connect handler never reads stale closures
	const lkRef = useRef<LKData | null>(null)
	const lkBreakoutRef = useRef<LKData | null>(null)
	const currentBreakoutRoomIdRef = useRef<string | null>(null)
	// Left a breakout, and the room has not confirmed it yet
	const leavingBreakoutRef = useRef(false)
	const lastJoinRef = useRef(0)

	useEffect(() => { lkRef.current = lk }, [lk])
	useEffect(() => { lkBreakoutRef.current = lkBreakout }, [lkBreakout])

	// What kind of seat this code gives — known before the socket connects,
	// so the interface can hide the player controls from the first frame.
	// The server decides for itself from the same code; this only mirrors it.
	const [resolved, setResolved] = useState<{ isSpectatorJoin: boolean } | null>(null)

	const myId = user?.id ?? ''

	// Step 1: does the code open a room at all?
	useEffect(() => {
		if (!rawCode) return
		setResolved(null)
		resolveGameCode(rawCode)
			.then(r => setResolved({ isSpectatorJoin: r.isSpectator }))
			.catch(() => setError('ROOM_NOT_FOUND'))
	}, [rawCode])

	// The code the person was given is all the client ever sends: the server
	// works out the room, the room's name and whether this seat has a voice.
	//
	// A failed request used to leave the room on "Getting LiveKit token..."
	// for good: nothing asked again. That happened on iPhones after picking a
	// photo — Safari freezes the page meanwhile, the scheduled sign-in refresh
	// is missed, and the first request after goes out with an expired token.
	// Now a 401 refreshes the sign-in, a network or server error is retried
	// after a pause, and only then does the room give up with a retry button.
	const fetchLKToken = useCallback(async (breakoutId?: string): Promise<LKData | null> => {
		if (!authToken || !user) return null
		const pauses = [1000, 2000, 4000, 8000]
		let refreshed = false
		for (let attempt = 0; ; attempt++) {
			let status = 0
			try {
				const res = await fetch(`${API}/api/livekit/token`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('mindflow_access_token') ?? authToken}` },
					body: JSON.stringify({ code: rawCode, breakoutId }),
				})
				if (res.ok) {
					const d = await res.json()
					return { token: d.token, url: d.url, roomName: d.roomName }
				}
				status = res.status
				const error = await res.json().catch(() => ({}))
				console.error('[LiveKit] Token request failed:', res.status, error)
				if (res.status === 403 && error?.message === 'REMOVED') { setError('REMOVED'); return null }
			} catch (err) {
				console.error('[LiveKit] Token fetch error:', err)
			}
			// 403 on the main room means this code opens nothing for this
			// person. Saying so beats a room stuck on "connecting...".
			if (status === 403) {
				if (!breakoutId) setError('NOT_A_PARTICIPANT')
				return null
			}
			if (status === 401 && !refreshed) {
				refreshed = true
				if (await forceRefresh()) continue
				if (!breakoutId) setConnStatus('failed')
				return null
			}
			if (attempt >= pauses.length) {
				if (!breakoutId) setConnStatus('failed')
				return null
			}
			await new Promise(r => setTimeout(r, pauses[attempt]))
		}
	}, [authToken, user, rawCode, forceRefresh])

	// Step 2: connect socket once the code is resolved
	useEffect(() => {
		if (!user || !authToken || !resolved) return

		const { isSpectatorJoin } = resolved
		const gameCode = rawCode

		// The auth callback runs on every (re)connect, so a token refreshed
		// mid-game is picked up instead of the stale one this effect closed over.
		const socket = io(API, {
			transports: ['websocket', 'polling'],
			auth: cb => cb({ token: localStorage.getItem('mindflow_access_token') ?? authToken }),
			reconnectionAttempts: Infinity,
			reconnectionDelayMax: 10000,
		})
		socketRef.current = socket

		socket.on('connect', async () => {
			setConnected(true)
			setConnStatus('connected')
			socket.emit('gr:join', { gameCode })
			// Only fetch main token on first connect; LiveKit manages its own reconnection
			if (!lkRef.current) {
				const token = await fetchLKToken()
				if (token) setLk(token)
			}
			// Restore breakout session if socket reconnected while user was in a breakout room
			if (currentBreakoutRoomIdRef.current && !lkBreakoutRef.current) {
				const token = await fetchLKToken(currentBreakoutRoomIdRef.current ?? undefined)
				if (token) setLkBreakout(token)
			}
		})

		socket.on('connect_error', () => setConnStatus('failed'))

		socket.on('gr:state', (s: GameRoomState) => {
			// The room's clock, so a device with the wrong time still counts down
			// the same round as everyone else.
			if (typeof s.serverNow === 'number') setClockOffset(s.serverNow - Date.now())
			// Our seat is missing from the roster: claim it back rather than sit
			// invisible to everyone until someone reloads.
			if (user && !s.players.some(p => p.userId === user.id)) announce()
			if ((prevStatusRef.current === 'lobby' || prevStatusRef.current === 'ended') && s.status === 'started') setStartAnim(true)
			prevStatusRef.current = s.status
			// The deck is the GM's alone and arrives separately
			setState({ ...s, images: gmImagesRef.current })
		})
		// An expired access token makes the handshake fail forever: the socket
		// keeps retrying with the same dead token and the room becomes a wall.
		socket.on('connect_error', async (err: Error) => {
			if (err.message !== 'Authentication error') return
			const fresh = await forceRefresh()
			if (fresh) socket.connect()
			else setConnStatus('failed')
		})

		// Either the room asked, or a state arrived without us in it: announce
		// ourselves again. A roster that has forgotten someone shows everyone
		// else an empty seat where that person is still sitting.
		const announce = () => {
			const now = Date.now()
			if (now - lastJoinRef.current < 4000) return
			lastJoinRef.current = now
			socket.emit('gr:join', { gameCode })
		}
		socket.on('gr:rejoin', announce)

		socket.on('gr:my-vote', (d: { voteId: string; optionIds: string[] }) => setMyVote(d))
		socket.on('gr:error', (msg: string) => setError(msg))
		// The gamemaster removed this person from the game for good
		socket.on('gr:kicked', () => setError('REMOVED'))
		// A refused command: say so for a moment, keep the room
		socket.on('gr:action-error', (msg: string) => {
			setActionError(msg)
			setTimeout(() => setActionError(''), 5000)
		})

		socket.on('gr:chat', (msg: ChatMessage) => {
			const isPrivate = (msg.recipients?.length ?? 0) > 0
			const isMyMsg   = msg.userId === user.id
			if (isPrivate) {
				const allParticipants = [msg.userId, ...(msg.recipients ?? [])]
				const convKey = allParticipants.filter(id => id !== (user?.id ?? '')).sort().join('|')
				setPrivateChats(prev => ({
					...prev,
					[convKey]: [...(prev[convKey] ?? []).slice(-99), msg],
				}))
				setUnreadDMs(prev => ({ ...prev, [convKey]: (prev[convKey] ?? 0) + 1 }))
				// Sound: DM received — only for recipient, never for spectators or sender
				if (!isSpectatorJoin && !isMyMsg) sfx.dmMsg()
			} else {
				setState(prev => prev
					? { ...prev, messages: [...prev.messages.slice(-99), msg] }
					: prev)
				setNewPublicMsgSignal(n => n + 1)
				// Sound: public message — everyone in room except sender and spectators
				if (!isSpectatorJoin && !isMyMsg) sfx.chatMsg()
			}
		})

		socket.on('gr:chat-history', (msgs: ChatMessage[]) => {
			const publicMsgs = msgs.filter(m => (m.recipients?.length ?? 0) === 0)
			const privateMsgs = msgs.filter(m => (m.recipients?.length ?? 0) > 0)
			setState(prev => prev ? { ...prev, messages: publicMsgs } : prev)
			const grouped: Record<string, ChatMessage[]> = {}
			for (const msg of privateMsgs) {
				const allParticipants = [msg.userId, ...(msg.recipients ?? [])]
				const convKey = allParticipants.filter(id => id !== (user?.id ?? '')).sort().join('|')
				grouped[convKey] = [...(grouped[convKey] ?? []), msg]
			}
			setPrivateChats(grouped)
		})

		socket.on('gr:mute-all', () => setShouldMute('all'))
		socket.on('gr:mute-player', () => setShouldMute('self'))

		socket.on('gr:reactions', (r: Record<string, number>) => {
			setState(prev => prev ? { ...prev, reactions: r } : prev)
		})

		// Coins changed hands: the fly-over layer (CoinFlights) draws it
		socket.on('gr:coins-moved', (m: { from: string; to: string; amount: number }) => {
			window.dispatchEvent(new CustomEvent('gos:coins-moved', { detail: m }))
		})
		socket.on('gr:influence-changed', (m: { userId: string; delta: number }) => {
			window.dispatchEvent(new CustomEvent('gos:influence-changed', { detail: m }))
		})
		socket.on('gr:player-reacted', ({ userId, emoji }: { userId: string; emoji: string }) => {
			setPlayerReactions(prev => ({ ...prev, [userId]: { emoji, key: Date.now() } }))
			if (reactionTimersRef.current[userId]) clearTimeout(reactionTimersRef.current[userId])
			reactionTimersRef.current[userId] = setTimeout(() => {
				setPlayerReactions(prev => { const n = { ...prev }; delete n[userId]; return n })
			}, 7000)
		})

		socket.on('gr:breakout-invited', (d: BreakoutInvite) => setBreakoutInvite(d))
		socket.on('gr:breakout-return', () => {
			leavingBreakoutRef.current = true
			currentBreakoutRoomIdRef.current = null
			setLkBreakout(null)
		})
		socket.on('gr:end-anim', () => setEndAnim(true))
		// Scenario and image deck arrive separately, addressed to the gamemaster
		socket.on('gr:gm-state', (d: { scenario: string; images?: string[]; recordingMode?: 'browser' | 'egress' }) => {
			setScenario(d.scenario ?? '')
			if (d.recordingMode) setRecordingMode(d.recordingMode)
			const images = d.images ?? []
			gmImagesRef.current = images
			setGmImages(images)
			setState(prev => prev ? { ...prev, images } : prev)
		})
		socket.on('gr:record-status', (d: { status: string; detail?: string }) => {
			setRecordStatus(d.status)
			setRecordError(d.status === 'error' ? d.detail ?? '' : '')
		})
		socket.on('gr:notes-delivered', () => setNotesDelivered(n => n + 1))
		socket.on('gr:record-stop', () => setRecordStopSignal(n => n + 1))
		socket.on('disconnect', () => { setConnected(false); setConnStatus('connecting') })

		return () => {
			socket.disconnect()
			socketRef.current = null
			setConnected(false)
			Object.values(reactionTimersRef.current).forEach(clearTimeout)
			reactionTimersRef.current = {}
		}
	}, [resolved, rawCode, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	const markDMRead = useCallback((convKey: string) => {
		setUnreadDMs(prev => { const n = { ...prev }; delete n[convKey]; return n })
	}, [])

	const clearMuteSignal = useCallback(() => setShouldMute(null), [])

	const gameCode = rawCode

	const emit = useCallback((event: string, data?: object) => {
		socketRef.current?.emit(event, { gameCode, ...(data ?? {}) })
	}, [gameCode])

	// Media first, then the move: announcing the move without a media token
	// left the person in a breakout with no video and no way out.
	const joinBreakout = useCallback(async (roomId: string) => {
		setBreakoutInvite(null)
		const token = await fetchLKToken(roomId)
		if (!token) {
			setActionError('BREAKOUT_SWITCH_FAILED')
			setTimeout(() => setActionError(''), 5000)
			return
		}
		leavingBreakoutRef.current = false
		currentBreakoutRoomIdRef.current = roomId
		setLkBreakout(token)
		emit('gr:breakout-join', { roomId })
	}, [fetchLKToken, emit])

	const leaveBreakout = useCallback(() => {
		leavingBreakoutRef.current = true
		currentBreakoutRoomIdRef.current = null
		setLkBreakout(null)
		emit('gr:breakout-leave')
	}, [emit])

	const me = state?.players.find(p => p.userId === myId) ?? null
	const isGM = me?.isGamemaster ?? false
	const inBreakout = me?.breakoutRoomId ?? null

	// The room remembers who sits in a breakout; this page may not know it —
	// it was reopened (back from editing the game, a reload) while its owner
	// was still in one. The room then waited for a breakout media token nobody
	// asked for and hung on "Getting LiveKit token...". Ask for it here, or
	// go back to the main room if that seat is no longer ours.
	useEffect(() => {
		if (!inBreakout) { leavingBreakoutRef.current = false; return }
		if (!connected || leavingBreakoutRef.current) return
		if (currentBreakoutRoomIdRef.current === inBreakout) return
		currentBreakoutRoomIdRef.current = inBreakout
		void fetchLKToken(inBreakout).then(token => {
			if (currentBreakoutRoomIdRef.current !== inBreakout) return
			if (token) setLkBreakout(token)
			else {
				leavingBreakoutRef.current = true
				currentBreakoutRoomIdRef.current = null
				setLkBreakout(null)
				emit('gr:breakout-leave')
			}
		})
	}, [inBreakout, connected, fetchLKToken, emit])
	const isSpectatorJoin = resolved?.isSpectatorJoin ?? false

	return {
		state, connected, me, isGM, myId, inBreakout, isSpectatorJoin, error, connStatus, playerReactions,
		privateChats, unreadDMs, markDMRead,
		shouldMute, clearMuteSignal,
		newPublicMsgSignal,
		recordStatus,
		recordError,
		gmImages,
		notesDelivered,
		recordingMode,
		recordStopSignal,
		scenario,
		actionError,
		clockOffset,
		myVote,
		lk, lkBreakout,
		breakoutInvite, setBreakoutInvite,
		endAnim, setEndAnim,
		startAnim, setStartAnim,
		joinBreakout, leaveBreakout,
		// ── Actions ──
		sendChat:      (text: string, recipients: string[] = []) => emit('gr:chat', { text, recipients }),
		react:         (emoji: string)            => emit('gr:react',          { emoji }),
		raiseHand:     (raised: boolean)          => emit('gr:hand',           { raised }),
		setRole:       (targetUserId: string, role: string) => emit('gr:role', { targetUserId, role }),
		startGame:     ()                         => emit('gr:start'),
		endGame:       ()                         => emit('gr:end'),
		transferCoins: (toUserId: string, amount: number) => emit('gr:coins-transfer', { toUserId, amount }),
		payBank:       (amount: number)           => emit('gr:coins-bank',     { amount }),
		giveFromBank:  (toUserId: string, amount: number) => emit('gr:bank-give', { toUserId, amount }),
		setInfluence:  (targetUserId: string, delta: number) => emit('gr:influence', { targetUserId, delta }),
		muteAll:       ()                         => emit('gr:mute-all'),
		mutePlayer:    (targetUserId: string)     => emit('gr:mute-player', { targetUserId }),
		// For good: the server bans them from this game, then takes them out
		kickPlayer:    (targetUserId: string)     => emit('gr:kick', { targetUserId }),
		announce:      (text: string | null)      => emit('gr:announce',       { text }),
		setTimer:      (label: string, seconds: number) => emit('gr:timer',   { action: 'set', label, seconds }),
		startTimer:    ()                         => emit('gr:timer',          { action: 'start' }),
		stopTimer:     ()                         => emit('gr:timer',          { action: 'stop' }),
		clearTimer:    ()                         => emit('gr:timer',          { action: 'clear' }),
		createVote:    (question: string, options: string[], isAnonymous: boolean, multipleChoice: boolean) =>
			emit('gr:vote-create', { question, options, isAnonymous, multipleChoice }),
		castVote:      (optionIds: string[])      => emit('gr:vote-cast',      { optionIds }),
		closeVote:     ()                         => emit('gr:vote-close'),
		clearVote:     ()                         => emit('gr:vote-clear'),
		createSpectatorVote: (question: string, options: string[], isAnonymous: boolean, multipleChoice: boolean) =>
			emit('gr:spectator-vote-create', { question, options, isAnonymous, multipleChoice }),
		castSpectatorVote:   (optionIds: string[]) => emit('gr:spectator-vote-cast',  { optionIds }),
		closeSpectatorVote:  ()                    => emit('gr:spectator-vote-close'),
		clearSpectatorVote:  ()                    => emit('gr:spectator-vote-clear'),
		createBreakout:(name: string, imageUrl: string, timerSeconds: number | null) =>
			emit('gr:breakout-create', { name, imageUrl, timerSeconds }),
		inviteBreakout:(roomId: string, playerIds: string[]) =>
			emit('gr:breakout-invite', { roomId, playerIds }),
		endBreakout:   (roomId: string)           => emit('gr:breakout-end',   { roomId }),
		showImage:       (imageUrl: string | null)  => emit('gr:image-show',     { imageUrl }),
		recordControl:   (action: 'start' | 'stop') => {
			if (action === 'start') { setRecordStatus('starting'); setRecordError('') }
			emit('gr:record-control', { action })
		},
		// Keeps the server's copy of the GM's notes current, so they are still
		// delivered if the tab closes instead of the game being ended.
		syncNotes:       (notes: string)            => emit('gr:notes',          { notes }),
	}
}
