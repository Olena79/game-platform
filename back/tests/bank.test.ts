import { createGameSchema, updateGameSchema, grBankGiveSchema, EDITABLE_GAME_FIELDS } from '../src/validation/schemas'

/** The gamemaster's starting bank and handing coins out of it. */
describe('gamemaster bank', () => {
	it('a game may start with a bank and no coins per player', () => {
		const r = createGameSchema.safeParse({ title: 'Bank game', useCoins: true, coinsPerPlayer: 0, startingBank: 10_000 })
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.startingBank).toBe(10_000)
	})

	it('the bank can be changed when editing the game', () => {
		expect(EDITABLE_GAME_FIELDS).toContain('startingBank')
		expect(updateGameSchema.safeParse({ startingBank: 500 }).success).toBe(true)
	})

	it('refuses a negative or absurd bank', () => {
		expect(createGameSchema.safeParse({ title: 'Bank game', startingBank: -1 }).success).toBe(false)
		expect(createGameSchema.safeParse({ title: 'Bank game', startingBank: 10_000_001 }).success).toBe(false)
	})

	it('giving from the bank takes a positive whole amount', () => {
		expect(grBankGiveSchema.safeParse({ gameCode: 'ABC', toUserId: 'u1', amount: 50 }).success).toBe(true)
		expect(grBankGiveSchema.safeParse({ gameCode: 'ABC', toUserId: 'u1', amount: 0 }).success).toBe(false)
		expect(grBankGiveSchema.safeParse({ gameCode: 'ABC', toUserId: 'u1', amount: -5 }).success).toBe(false)
		expect(grBankGiveSchema.safeParse({ gameCode: 'ABC', toUserId: 'u1', amount: 1.5 }).success).toBe(false)
	})
})
