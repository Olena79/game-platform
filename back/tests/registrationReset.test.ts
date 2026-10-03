/** A day after a game's time its lists are emptied, quietly. */
let mockCall: { filter: any; update: any } | null = null
let mockFail = false
jest.mock('../src/models/Game', () => ({
	Game: {
		updateMany: async (filter: any, update: any) => {
			if (mockFail) throw new Error('db down')
			mockCall = { filter, update }
			return { modifiedCount: 2 }
		},
	},
}))

import { clearPlayedRegistrations, RESET_AFTER_MS } from '../src/services/registrationReset'

describe('clearing the registrations of played games', () => {
	beforeEach(() => { mockCall = null; mockFail = false })

	it('targets games more than a day past that still have someone listed, and empties the lists', async () => {
		const now = new Date('2026-10-03T12:00:00Z')
		expect(await clearPlayedRegistrations(now)).toBe(2)
		expect(mockCall!.filter.scheduledAt.$lt.getTime()).toBe(now.getTime() - RESET_AFTER_MS)
		expect(RESET_AFTER_MS).toBe(24 * 60 * 60 * 1000)
		expect(mockCall!.update.$set).toEqual({ registeredPlayers: [], spectators: [], accessBlockedUserIds: [] })
	})

	it('never throws', async () => {
		mockFail = true
		expect(await clearPlayedRegistrations()).toBe(0)
	})
})
