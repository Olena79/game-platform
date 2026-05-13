import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { RoomPlayer } from '../components/gameroom/types'

export const isMockDevEnv = (): boolean =>
	import.meta.env.DEV ||
	window.location.hostname === 'localhost' ||
	window.location.hostname === '127.0.0.1'

const MOCK_NAMES = [
	'Аліна Мороз', 'Богдан Ковальчук', 'Вікторія Шевченко', 'Григорій Бондаренко',
	'Дарина Кравченко', 'Євген Олексієнко', 'Жанна Тимченко', 'Захар Іванченко',
	'Ірина Савченко', 'Кирило Петренко', 'Лариса Данченко', 'Микола Лисенко',
	'Наталія Гончаренко', 'Олексій Мельник', 'Поліна Козаченко', 'Роман Демченко',
	'Світлана Назаренко', 'Тарас Сергієнко', 'Уляна Войченко', 'Федір Кириченко',
]

const MOCK_ROLES = [
	'Дипломат', 'Аналітик', 'Брокер', 'Стратег', 'Активіст',
	'Медіатор', 'Агент', 'Командир', 'Провокатор', '',
]

let _mockCounter = 0

function makeMockPlayer(index: number, breakoutRoomId: string | null = null): RoomPlayer {
	const name = MOCK_NAMES[index % MOCK_NAMES.length]
	const parts = name.split(' ')
	const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase()
	return {
		socketId: `mock-${index}`,
		userId: `mock-${index}`,
		name,
		initials,
		role: MOCK_ROLES[index % MOCK_ROLES.length],
		coins: Math.floor(Math.random() * 5) * 10,
		influence: Math.floor(Math.random() * 4),
		handRaised: false,
		breakoutRoomId,
		isGamemaster: false,
		isSpectator: false,
		connected: true,
	}
}

export function useMockParticipants() {
	const [mockPlayers, setMockPlayers] = useState<RoomPlayer[]>([])
	const [mockSpeakingId, setMockSpeakingId] = useState<string | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const playersRef = useRef<RoomPlayer[]>([])
	playersRef.current = mockPlayers

	// Speaking simulation: silence → someone speaks → silence → repeat
	// Picks any mock player regardless of room — visual effect only applies
	// in views where that player is rendered (correct by construction)
	const scheduleCycle = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current)
		const players = playersRef.current
		if (players.length === 0) { setMockSpeakingId(null); return }

		const silenceDuration = 2000 + Math.random() * 5000
		timerRef.current = setTimeout(() => {
			const idx = Math.floor(Math.random() * players.length)
			setMockSpeakingId(players[idx].userId)

			const speakDuration = 1500 + Math.random() * 3500
			timerRef.current = setTimeout(() => {
				setMockSpeakingId(null)
				scheduleCycle()
			}, speakDuration)
		}, silenceDuration)
	}, [])

	useEffect(() => {
		if (mockPlayers.length === 0) {
			if (timerRef.current) clearTimeout(timerRef.current)
			setMockSpeakingId(null)
			return
		}
		scheduleCycle()
		return () => { if (timerRef.current) clearTimeout(timerRef.current) }
	}, [mockPlayers.length, scheduleCycle])

	// Add N mocks to a specific room (null = main room)
	const addMockPlayers = useCallback((count: number, breakoutRoomId: string | null = null) => {
		setMockPlayers(prev => {
			const next = [...prev]
			for (let i = 0; i < count; i++) {
				next.push(makeMockPlayer(_mockCounter++, breakoutRoomId))
			}
			return next
		})
	}, [])

	// Move a single mock player to a room
	const moveMockToRoom = useCallback((userId: string, breakoutRoomId: string | null) => {
		setMockPlayers(prev =>
			prev.map(p => p.userId === userId ? { ...p, breakoutRoomId } : p)
		)
	}, [])

	// Move ALL mock players to a room at once
	const moveAllMocksToRoom = useCallback((breakoutRoomId: string | null) => {
		setMockPlayers(prev => prev.map(p => ({ ...p, breakoutRoomId })))
	}, [])

	// Remove mocks from a specific room only
	const clearMocksInRoom = useCallback((breakoutRoomId: string | null) => {
		setMockPlayers(prev => prev.filter(p => p.breakoutRoomId !== breakoutRoomId))
	}, [])

	const clearMockPlayers = useCallback(() => {
		setMockPlayers([])
		setMockSpeakingId(null)
		if (timerRef.current) clearTimeout(timerRef.current)
	}, [])

	// Distribution: how many mocks are in each room ('main' key = main room)
	const mocksByRoom = useMemo<Record<string, number>>(() => {
		const result: Record<string, number> = { main: 0 }
		for (const p of mockPlayers) {
			const key = p.breakoutRoomId ?? 'main'
			result[key] = (result[key] ?? 0) + 1
		}
		return result
	}, [mockPlayers])

	return {
		isDev: isMockDevEnv(),
		mockPlayers,
		mockSpeakingId,
		mockCount: mockPlayers.length,
		mocksByRoom,
		addMockPlayers,
		moveMockToRoom,
		moveAllMocksToRoom,
		clearMocksInRoom,
		clearMockPlayers,
	}
}
