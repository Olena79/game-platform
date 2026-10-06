import { describe, it, expect } from 'vitest'
import { compareGames, withinDays } from './gameOrder'

const now = Date.parse('2026-10-06T12:00:00Z')
const h = 3_600_000, d = 24 * h
const g = (name: string, offset: number | null, extra: object = {}) =>
	({ name, scheduledAt: offset === null ? null : new Date(now + offset).toISOString(), ...extra })
const order = (list: ReturnType<typeof g>[], key: Parameters<typeof compareGames>[2]) =>
	[...list].sort((a, b) => compareGames(a, b, key, now)).map(x => x.name)

describe('games list order', () => {
	const played2d = g('played 2 days ago', -2 * d)
	const played1w = g('played a week ago', -7 * d)
	const onNow = g('started an hour ago', -h)
	const tomorrow = g('tomorrow', d)
	const nextWeek = g('next week', 7 * d)
	const undated = g('no date', null)

	it('nearest date: games to come first (one on now at the top), then no date, then played, latest first', () => {
		expect(order([played1w, nextWeek, undated, played2d, tomorrow, onNow], 'date'))
			.toEqual(['started an hour ago', 'tomorrow', 'next week', 'no date', 'played 2 days ago', 'played a week ago'])
	})

	it('a new game to come is never put after a played one', () => {
		expect(order([played2d, nextWeek], 'date')).toEqual(['next week', 'played 2 days ago'])
	})

	it('other sorts keep the date order among equals', () => {
		const a = g('played, 3 likes', -d, { likesCount: 3 })
		const b = g('to come, 3 likes', d, { likesCount: 3 })
		const c = g('to come, 5 likes', 2 * d, { likesCount: 5 })
		expect(order([a, b, c], 'likes')).toEqual(['to come, 5 likes', 'to come, 3 likes', 'played, 3 likes'])
	})

	it('"next 7 days" keeps a game on right now and drops played or far ones', () => {
		expect(withinDays(onNow, 7, now)).toBe(true)
		expect(withinDays(tomorrow, 7, now)).toBe(true)
		expect(withinDays(played2d, 7, now)).toBe(false)
		expect(withinDays(g('in 10 days', 10 * d), 7, now)).toBe(false)
		expect(withinDays(undated, 7, now)).toBe(false)
	})
})
