import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import type { GameRoomState, ChatMessage } from '../components/gameroom/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface LKData { token: string; url: string; roomName: string }
export interface BreakoutInvite { roomId: string; roomName: string; imageUrl: string }

export function useGameRoom(gameCode: string) {
	const { user, token: authToken } = useAuth()
	const socketRef = useRef<Socket | null>(null)
	const [state, setState]                   = useState<GameRoomState | null>(null)
	const [connected, setConnected]           = useState(false)
	const [lk, setLk]                         = useState<LKData | null>(null)
	const [lkBreakout, setLkBreakout]         = useState<LKData | null>(null)
	const [breakoutInvite, setBreakoutInvite] = useState<BreakoutInvite | null>(null)
	const [endAnim, setEndAnim]               = useState(false)
	const [error, setError]                   = useState<string | null>(null)
	const [connStatus, setConnStatus]         = useState<'connecting' | 'connected' | 'failed'>('connecting')
	const [playerReactions, setPlayerReactions] = useState<Record<string, { emoji: string; key: number }>>({})
	const reactionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

	const myId = user?.id ?? ''

	const fetchLKToken = useCallback(async (roomName: string): Promise<LKData | null> => {
		if (!authToken || !user) return null
		try {
			const res = await fetch(`${API}/api/livekit/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
				body: JSON.stringify({
					roomName,
					participantName: [user.name, user.surname].filter(Boolean).join(' ') || user.name,
				}),
			})
			if (!res.ok) return null
			const d = await res.json()
			return { token: d.token, url: d.url, roomName }
		} catch { return null }
	}, [authToken, user])

	useEffect(() => {
		if (!user || !authToken || !gameCode) return

		const socket = io(API, { transports: ['websocket', 'polling'] })
		socketRef.current = socket

		socket.on('connect', async () => {
			setConnected(true)
			setConnStatus('connected')
			socket.emit('gr:join', {
				gameCode,
				userId: user.id,
				name: [user.name, user.surname].filter(Boolean).join(' ') || user.name,
			})
			const token = await fetchLKToken(`mindflow-${gameCode}`)
			if (token) setLk(token)
		})

		socket.on('connect_error', () => setConnStatus('failed'))

		socket.on('gr:state', (s: GameRoomState) => setState(s))
		socket.on('gr:error', (msg: string) => setError(msg))

		socket.on('gr:chat', (msg: ChatMessage) => {
			setState(prev => prev
				? { ...prev, messages: [...prev.messages.slice(-99), msg] }
				: prev)
		})

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
			setLkBreakout(null)
		})

		socket.on('gr:end-anim', () => setEndAnim(true))

		socket.on('disconnect', () => { setConnected(false); setConnStatus('connecting') })

		return () => {
			socket.disconnect()
			socketRef.current = null
			setConnected(false)
		}
	}, [gameCode, user?.id, authToken]) // eslint-disable-line react-hooks/exhaustive-deps

	const emit = useCallback((event: string, data?: object) => {
		socketRef.current?.emit(event, { gameCode, ...(data ?? {}) })
	}, [gameCode])

	const joinBreakout = useCallback(async (roomId: string) => {
		const token = await fetchLKToken(`mindflow-${gameCode}-${roomId}`)
		if (token) setLkBreakout(token)
		emit('gr:breakout-join', { roomId })
		setBreakoutInvite(null)
	}, [fetchLKToken, gameCode, emit])

	const leaveBreakout = useCallback(() => {
		setLkBreakout(null)
		emit('gr:breakout-leave')
	}, [emit])

	const me = state?.players.find(p => p.userId === myId) ?? null
	const isGM = me?.isGamemaster ?? false
	const inBreakout = me?.breakoutRoomId ?? null

	return {
		state, connected, me, isGM, myId, inBreakout, error, connStatus, playerReactions,
		lk, lkBreakout,
		breakoutInvite, setBreakoutInvite,
		endAnim, setEndAnim,
		joinBreakout, leaveBreakout,
		// ── Actions ──
		sendChat:      (text: string)             => emit('gr:chat',           { text }),
		react:         (emoji: string)            => emit('gr:react',          { emoji }),
		raiseHand:     (raised: boolean)          => emit('gr:hand',           { raised }),
		setRole:       (targetUserId: string, role: string) => emit('gr:role', { targetUserId, role }),
		startGame:     ()                         => emit('gr:start'),
		endGame:       ()                         => emit('gr:end'),
		transferCoins: (toUserId: string, amount: number) => emit('gr:coins-transfer', { toUserId, amount }),
		payBank:       (amount: number)           => emit('gr:coins-bank',     { amount }),
		setInfluence:  (targetUserId: string, delta: number) => emit('gr:influence', { targetUserId, delta }),
		muteAll:       ()                         => emit('gr:mute-all'),
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
		createBreakout:(name: string, imageUrl: string, timerSeconds: number | null) =>
			emit('gr:breakout-create', { name, imageUrl, timerSeconds }),
		inviteBreakout:(roomId: string, playerIds: string[]) =>
			emit('gr:breakout-invite', { roomId, playerIds }),
		endBreakout:   (roomId: string)           => emit('gr:breakout-end',   { roomId }),
		showImage:     (imageUrl: string | null)  => emit('gr:image-show',     { imageUrl }),
	}
}
