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
	const { user, token: authToken } = useAuth()
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
	const [shouldMute, setShouldMute] = useState(false)
	const [newPublicMsgSignal, setNewPublicMsgSignal] = useState(0)
	const [recordStatus, setRecordStatus] = useState<string>('')
	const [recordingActive, setRecordingActive] = useState(false)
	const reactionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
	const prevStatusRef = useRef<string>('')
	// Refs that mirror state so async connect handler never reads stale closures
	const lkRef = useRef<LKData | null>(null)
	const lkBreakoutRef = useRef<LKData | null>(null)
	const currentBreakoutRoomIdRef = useRef<string | null>(null)

	useEffect(() => { lkRef.current = lk }, [lk])
	useEffect(() => { lkBreakoutRef.current = lkBreakout }, [lkBreakout])

	// Resolved code info — populated after code resolution
	const [resolved, setResolved] = useState<{ gameCode: string; isSpectatorJoin: boolean } | null>(null)

	const myId = user?.id ?? ''

	// Step 1: resolve the raw code to the real gameCode + isSpectator flag
	useEffect(() => {
		if (!rawCode) return
		setResolved(null)
		resolveGameCode(rawCode)
			.then(r => setResolved({ gameCode: r.gameCode, isSpectatorJoin: r.isSpectator }))
			.catch(() => setError('Кімнату не знайдено'))
	}, [rawCode])

	const fetchLKToken = useCallback(async (roomName: string): Promise<LKData | null> => {
		if (!authToken || !user) return null
		try {
			const userName = [user.name, user.surname].filter(Boolean).join(' ') || user.name
			const payload = { roomName, userName }
			console.log('[LiveKit] Requesting token with payload:', payload)
			const res = await fetch(`${API}/api/livekit/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
				body: JSON.stringify(payload),
			})
			if (!res.ok) {
				const error = await res.json().catch(() => ({}))
				console.error('[LiveKit] Token request failed:', res.status, error)
				return null
			}
			const d = await res.json()
			return { token: d.token, url: d.url, roomName }
		} catch (err) {
			console.error('[LiveKit] Token fetch error:', err)
			return null
		}
	}, [authToken, user])

	// Step 2: connect socket once the code is resolved
	useEffect(() => {
		if (!user || !authToken || !resolved) return

		const { gameCode, isSpectatorJoin } = resolved

		const socket = io(API, { transports: ['websocket', 'polling'], auth: { token: authToken } })
		socketRef.current = socket

		socket.on('connect', async () => {
			setConnected(true)
			setConnStatus('connected')
			socket.emit('gr:join', {
				gameCode,
				userId: user.id,
				name: [user.name, user.surname].filter(Boolean).join(' ') || user.name,
				isSpectatorJoin,
			})
			// Only fetch main token on first connect; LiveKit manages its own reconnection
			if (!lkRef.current) {
				const token = await fetchLKToken(`mindflow-${gameCode}`)
				if (token) setLk(token)
			}
			// Restore breakout session if socket reconnected while user was in a breakout room
			if (currentBreakoutRoomIdRef.current && !lkBreakoutRef.current) {
				const token = await fetchLKToken(`mindflow-${gameCode}-${currentBreakoutRoomIdRef.current}`)
				if (token) setLkBreakout(token)
			}
		})

		socket.on('connect_error', () => setConnStatus('failed'))

		socket.on('gr:state', (s: GameRoomState) => {
			if ((prevStatusRef.current === 'lobby' || prevStatusRef.current === 'ended') && s.status === 'started') setStartAnim(true)
			prevStatusRef.current = s.status
			setState(s)
		})
		socket.on('gr:error', (msg: string) => setError(msg))

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

		socket.on('gr:mute-all', () => setShouldMute(true))
		socket.on('gr:mute-player', () => setShouldMute(true))

		socket.on('gr:reactions', (r: Record<string, number>) => {
			setState(prev => prev ? { ...prev, reactions: r } : prev)
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
			currentBreakoutRoomIdRef.current = null
			setLkBreakout(null)
		})
		socket.on('gr:end-anim', () => setEndAnim(true))
		socket.on('gr:record-status', (d: { status: string }) => setRecordStatus(d.status))
		socket.on('gr:recording-notify', (d: { active: boolean }) => setRecordingActive(d.active))
		socket.on('disconnect', () => { setConnected(false); setConnStatus('connecting') })

		return () => {
			socket.disconnect()
			socketRef.current = null
			setConnected(false)
			Object.values(reactionTimersRef.current).forEach(clearTimeout)
			reactionTimersRef.current = {}
		}
	}, [resolved?.gameCode, user?.id, authToken]) // eslint-disable-line react-hooks/exhaustive-deps

	const markDMRead = useCallback((convKey: string) => {
		setUnreadDMs(prev => { const n = { ...prev }; delete n[convKey]; return n })
	}, [])

	const clearMuteSignal = useCallback(() => setShouldMute(false), [])

	const gameCode = resolved?.gameCode ?? rawCode

	const emit = useCallback((event: string, data?: object) => {
		socketRef.current?.emit(event, { gameCode, ...(data ?? {}) })
	}, [gameCode])

	const joinBreakout = useCallback(async (roomId: string) => {
		currentBreakoutRoomIdRef.current = roomId
		const token = await fetchLKToken(`mindflow-${gameCode}-${roomId}`)
		if (token) setLkBreakout(token)
		emit('gr:breakout-join', { roomId })
		setBreakoutInvite(null)
	}, [fetchLKToken, gameCode, emit])

	const leaveBreakout = useCallback(() => {
		currentBreakoutRoomIdRef.current = null
		setLkBreakout(null)
		emit('gr:breakout-leave')
	}, [emit])

	const me = state?.players.find(p => p.userId === myId) ?? null
	const isGM = me?.isGamemaster ?? false
	const inBreakout = me?.breakoutRoomId ?? null
	const isSpectatorJoin = resolved?.isSpectatorJoin ?? false

	return {
		state, connected, me, isGM, myId, inBreakout, isSpectatorJoin, error, connStatus, playerReactions,
		privateChats, unreadDMs, markDMRead,
		shouldMute, clearMuteSignal,
		newPublicMsgSignal,
		recordStatus,
		recordingActive,
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
		setInfluence:  (targetUserId: string, delta: number) => emit('gr:influence', { targetUserId, delta }),
		muteAll:       ()                         => emit('gr:mute-all'),
		mutePlayer:    (targetUserId: string)     => emit('gr:mute-player', { targetUserId }),
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
		recordControl:   (action: 'start' | 'stop') => emit('gr:record-control', { action }),
	}
}
