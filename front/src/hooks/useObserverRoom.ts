import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import type { GameRoomState, ChatMessage } from '../components/gameroom/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface LKData { token: string; url: string; roomName: string }

export function useObserverRoom(gameCode: string) {
	const { user, token: authToken, forceRefresh } = useAuth()
	const socketRef = useRef<Socket | null>(null)
	const [state, setState] = useState<GameRoomState | null>(null)
	const [lk, setLk] = useState<LKData | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting')
	const [recordSignal, setRecordSignal] = useState<'start' | 'stop' | null>(null)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [startAnim, setStartAnim] = useState(false)
	const [endAnim, setEndAnim] = useState(false)
	const prevStatusRef = useRef<string>('')

	useEffect(() => {
		if (!user || !authToken || !gameCode) return

		let mounted = true
		const ctrl = new AbortController()

		fetch(`${API}/api/livekit/observer-token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
			body: JSON.stringify({ gameCode, userName: 'Observer' }),
			signal: ctrl.signal,
		})
			.then(async r => {
				// A refusal used to slip through as JSON and leave the window
				// holding an undefined token, with nothing on screen to explain it.
				if (!r.ok) throw new Error(r.status === 403 ? 'OBSERVER_FORBIDDEN' : `HTTP ${r.status}`)
				return r.json()
			})
			.then(d => {
				if (!mounted) return
				if (!d?.token) throw new Error('EMPTY_TOKEN')
				setLk({ token: d.token, url: d.url, roomName: `mindflow-${gameCode}` })
			})
			.catch(err => {
				if (!mounted || err.name === 'AbortError') return
				setError(err.message === 'OBSERVER_FORBIDDEN'
					? 'Вікно запису доступне лише ігромастеру цієї гри'
					: 'Не вдалося отримати токен LiveKit')
			})

		// Same as the room: losing this socket mid-game means losing the
		// recording, so it reconnects with a token read fresh each time.
		const socket = io(API, {
			transports: ['websocket', 'polling'],
			auth: cb => cb({ token: localStorage.getItem('mindflow_access_token') ?? authToken }),
			reconnectionAttempts: Infinity,
			reconnectionDelayMax: 10000,
		})
		socketRef.current = socket

		socket.on('connect', () => {
			if (!mounted) return
			setConnStatus('connected')
			// Identity is taken from the JWT verified at handshake — no need to send userId
			socket.emit('gr:observer-connect', { gameCode })
		})
		socket.on('connect_error', () => setConnStatus('failed'))
		socket.on('gr:state', (s: GameRoomState) => {
			if ((prevStatusRef.current === 'lobby' || prevStatusRef.current === 'ended') && s.status === 'started') setStartAnim(true)
			prevStatusRef.current = s.status
			setState(s)
		})
		socket.on('connect_error', async (err: Error) => {
			if (err.message !== 'Authentication error') return
			const fresh = await forceRefresh()
			if (fresh) socket.connect()
			else setConnStatus('failed')
		})

		socket.on('gr:error', (msg: string) => setError(msg))
		socket.on('gr:chat', (msg: ChatMessage) => {
			if (!msg.recipients?.length) {
				setMessages(prev => [...prev.slice(-99), msg])
			}
		})
		socket.on('gr:chat-history', (msgs: ChatMessage[]) => {
			setMessages(msgs.filter(m => !m.recipients?.length))
		})
		socket.on('gr:record-signal', (d: { action: 'start' | 'stop' }) => {
			setRecordSignal(d.action)
		})
		socket.on('gr:end-anim', () => setEndAnim(true))

		return () => {
			mounted = false
			ctrl.abort()
			socket.disconnect()
			socketRef.current = null
			setConnStatus('connecting')
		}
	}, [gameCode, user?.id, authToken]) // eslint-disable-line react-hooks/exhaustive-deps

	const sendStatus = useCallback((status: string) => {
		socketRef.current?.emit('gr:record-status', { gameCode, status })
	}, [gameCode])

	const sendChat = useCallback((text: string) => {
		socketRef.current?.emit('gr:chat', { gameCode, text, recipients: [] })
	}, [gameCode])

	return {
		state, lk, error, connStatus,
		recordSignal, setRecordSignal,
		messages, sendStatus, sendChat,
		startAnim, setStartAnim,
		endAnim, setEndAnim,
		myId: user?.id ?? '',
	}
}
