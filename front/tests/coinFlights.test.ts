import { describe, it, expect } from 'vitest'
import { coinsFor } from '../src/components/gameroom/CoinFlights'

/** More coins fly for bigger sums, so the amount is felt, not just the fact. */
describe('coin flight sizes', () => {
	it('follows the agreed steps', () => {
		expect(coinsFor(1)).toBe(3)
		expect(coinsFor(25)).toBe(3)
		expect(coinsFor(26)).toBe(6)
		expect(coinsFor(50)).toBe(6)
		expect(coinsFor(100)).toBe(10)
		expect(coinsFor(101)).toBe(24)
		expect(coinsFor(500)).toBe(24)
		expect(coinsFor(10_000)).toBe(32)
	})
})
