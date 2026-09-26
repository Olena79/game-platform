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
