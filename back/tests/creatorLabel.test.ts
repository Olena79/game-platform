jest.mock('../src/socket/gameRoom', () => ({}))
import { creatorLabel } from '../src/routes/games'

/** How a gamemaster is named on the games list and the game page. */
describe('creatorLabel', () => {
	it('uses name and surname when there are any', () => {
		expect(creatorLabel({ name: 'Олена', surname: 'Клементьєва', email: 'o@x.com' })).toEqual({ name: 'Олена Клементьєва', alias: '' })
		expect(creatorLabel({ name: 'Олена', surname: '', email: 'o@x.com' })).toEqual({ name: 'Олена', alias: '' })
		expect(creatorLabel({ name: '', surname: 'Клементьєва', email: 'o@x.com' })).toEqual({ name: 'Клементьєва', alias: '' })
	})

	it('falls back to the part of the email before the @, never the whole address', () => {
		expect(creatorLabel({ name: ' ', surname: '', email: 'olena79@gmail.com' })).toEqual({ name: '', alias: 'olena79' })
	})
})

import { seatCounts } from '../src/routes/games'

/** Registering answers with counts and the caller's own place — never the lists of names. */
describe('seatCounts', () => {
	it('gives counts and my own place only', () => {
		const game = {
			registeredPlayers: [{ userId: 'a', name: 'Ann' }, { userId: 'me', name: 'Me' }],
			spectators: [{ userId: 'b', name: 'Bob' }],
		}
		const out = seatCounts(game, 'me')
		expect(out).toEqual({ playersCount: 2, spectatorsCount: 1, isRegistered: true, isSpectatorRegistered: false })
		expect(JSON.stringify(out)).not.toMatch(/Ann|Bob/)
	})
})

import { isReplay } from '../src/routes/games'

/**
 * A game already played, given a date ahead, starts with empty lists and
 * nobody is told; any other new date is a move, and the people stay.
 */
describe('isReplay', () => {
	const now = Date.parse('2026-10-03T12:00:00Z')
	const twoDaysAgo = now - 2 * 86400_000
	const inAWeek = now + 7 * 86400_000
	it('played, then given a date ahead: a replay', () => {
		expect(isReplay(twoDaysAgo, inAWeek, now)).toBe(true)
	})
	it('not played yet and moved: not a replay', () => {
		expect(isReplay(now + 86400_000, inAWeek, now)).toBe(false)
		expect(isReplay(inAWeek, now + 86400_000, now)).toBe(false)
	})
	it('moved to another past date, or with no date on either side: not a replay', () => {
		expect(isReplay(twoDaysAgo, now - 86400_000, now)).toBe(false)
		expect(isReplay(null, inAWeek, now)).toBe(false)
		expect(isReplay(twoDaysAgo, null, now)).toBe(false)
	})
})
