/**
 * Who gets which seat. The spectator code used to resolve, publicly, to the
 * entry code, and the socket trusted a flag from the browser — so any
 * spectator could take a player's seat with a microphone. These pin the rule
 * the server now applies on its own: the presented code decides.
 */
const game = {
	_id: '64f1a2b3c4d5e6f708192a3b',
	gameCode: 'PLAY23',
	spectatorCode: 'WATCH7',
	creatorId: 'gm-user',
	registeredPlayers: [{ userId: 'registered-player' }],
}

const findOne = jest.fn()
jest.mock('../src/models/Game', () => ({
	Game: { findOne: (...args: unknown[]) => findOne(...args) },
}))

import { resolveSeat } from '../src/services/roomAccess'

function returns(doc: unknown) {
	findOne.mockReturnValue({ select: () => Promise.resolve(doc) })
}

describe('resolveSeat', () => {
	beforeEach(() => {
		findOne.mockReset()
		returns(game)
	})

	it('gives the entry code a seat with a voice', async () => {
		const seat = await resolveSeat('PLAY23', 'someone')
		expect(seat).toMatchObject({ gameCode: 'PLAY23', asSpectator: false, isCreator: false })
	})

	it('gives the spectator code a silent seat', async () => {
		const seat = await resolveSeat('WATCH7', 'someone')
		expect(seat?.asSpectator).toBe(true)
	})

	it('accepts codes in any case and with stray spaces', async () => {
		const seat = await resolveSeat('  watch7 ', 'someone')
		expect(seat?.asSpectator).toBe(true)
		expect(findOne).toHaveBeenCalledWith({ $or: [{ gameCode: 'WATCH7' }, { spectatorCode: 'WATCH7' }] })
	})

	it('lets the gamemaster speak whichever code they use', async () => {
		const seat = await resolveSeat('WATCH7', 'gm-user')
		expect(seat).toMatchObject({ isCreator: true, asSpectator: false })
	})

	it('keeps a registered player a player even with the spectator code', async () => {
		const seat = await resolveSeat('WATCH7', 'registered-player')
		expect(seat?.asSpectator).toBe(false)
	})

	it('refuses an unknown code', async () => {
		returns(null)
		await expect(resolveSeat('NOPE99', 'someone')).resolves.toBeNull()
	})

	// A crafted payload such as {"$ne": null} must never reach the query
	it.each([
		[{ $ne: null }],
		[''],
		['AB'],
		['PLAY23; DROP'],
		[undefined],
	])('refuses a malformed code %p without querying', async (code) => {
		await expect(resolveSeat(code, 'someone')).resolves.toBeNull()
		expect(findOne).not.toHaveBeenCalled()
	})
})
