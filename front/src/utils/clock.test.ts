import { describe, it, expect } from 'vitest'
import { formatClock, splitSeconds } from './clock'

describe('timer clock', () => {
	it('reads minutes under an hour and hours above', () => {
		expect(formatClock(300)).toBe('05:00')
		expect(formatClock(3599)).toBe('59:59')
		expect(formatClock(7200)).toBe('2:00:00')
		expect(formatClock(5970)).toBe('1:39:30')
	})
	it('splits a two-hour timer into its fields', () => {
		expect(splitSeconds(7200)).toEqual({ hours: 2, minutes: 0, seconds: 0 })
		expect(splitSeconds(5405)).toEqual({ hours: 1, minutes: 30, seconds: 5 })
	})
})
