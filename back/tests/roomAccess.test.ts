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

import { resolveSeat, timeRefusal } from '../src/services/roomAccess'

function returns(doc: unknown) {
	findOne.mockReturnValue({ select: () => Promise.resolve(doc) })
}

describe('resolveSeat', () => {
	beforeEach(() => {
		findOne.mockReset()
		returns(game)
	})

	it('gives a removed person no seat, through either code', async () => {
		returns({ ...game, bannedUserIds: ['troublemaker'] })
		expect(await resolveSeat('PLAY23', 'troublemaker')).toBeNull()
		expect(await resolveSeat('WATCH7', 'troublemaker')).toBeNull()
		expect(await resolveSeat('PLAY23', 'someone')).not.toBeNull()
	})

	it('never locks the gamemaster out of their own game', async () => {
		returns({ ...game, bannedUserIds: ['gm-user'] })
		expect(await resolveSeat('PLAY23', 'gm-user')).toMatchObject({ isCreator: true })
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

describe('when players and spectators may come in', () => {
	const game7pm = new Date('2026-10-10T16:00:00Z')   // 19:00 in Kyiv
	const at = (iso: string) => new Date(iso).getTime()

	it('opens ten minutes before the game, not earlier', () => {
		expect(timeRefusal({ scheduledAt: game7pm }, at('2026-10-10T15:49:00Z'))).toMatchObject({ reason: 'NOT_YET' })
		expect(timeRefusal({ scheduledAt: game7pm }, at('2026-10-10T15:50:00Z'))).toBeNull()
		expect(timeRefusal({ scheduledAt: game7pm }, at('2026-10-10T18:30:00Z'))).toBeNull()
	})

	it('closes when the half hour after the session is over, until rescheduled', () => {
		const closedAt = new Date('2026-10-10T19:00:00Z')
		expect(timeRefusal({ scheduledAt: game7pm, closedAt }, at('2026-10-10T18:59:00Z'))).toBeNull()
		expect(timeRefusal({ scheduledAt: game7pm, closedAt }, at('2026-10-10T19:00:00Z'))).toEqual({ reason: 'CLOSED' })
	})

	it('closes a day after a game nobody played', () => {
		expect(timeRefusal({ scheduledAt: game7pm }, at('2026-10-11T16:01:00Z'))).toEqual({ reason: 'CLOSED' })
	})

	it('keeps a game with no date open to its code, as before', () => {
		expect(timeRefusal({ scheduledAt: null }, at('2026-10-10T12:00:00Z'))).toBeNull()
	})

	it('lets the gamemaster in at any time; refuses a player out of time, through either code', async () => {
		returns({ ...game, scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000), closedAt: null })
		expect(await resolveSeat('PLAY23', 'gm-user')).toMatchObject({ isCreator: true })
		expect(await resolveSeat('PLAY23', 'someone')).toBeNull()
		expect(await resolveSeat('WATCH7', 'someone')).toBeNull()

		returns({ ...game, scheduledAt: new Date(Date.now() - 60 * 60 * 1000), closedAt: new Date(Date.now() - 1000) })
		expect(await resolveSeat('PLAY23', 'gm-user')).toMatchObject({ isCreator: true })
		expect(await resolveSeat('PLAY23', 'registered-player')).toBeNull()

		returns({ ...game, scheduledAt: new Date(Date.now() + 5 * 60 * 1000) })
		expect(await resolveSeat('PLAY23', 'someone')).toMatchObject({ asSpectator: false })
	})
})
