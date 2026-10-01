import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

const sounds = vi.hoisted(() => ({ timerStart: vi.fn(), timerWarning: vi.fn(), timerEnd: vi.fn() }))
vi.mock('../../utils/sounds', () => ({ sfx: sounds }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { TimerFloatOverlay } from './TimerFloatOverlay'

describe('timer sounds', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
		Object.values(sounds).forEach(f => f.mockClear())
	})
	afterEach(() => vi.useRealTimers())

	it('rings once when the countdown it watched reaches zero', () => {
		const endsAt = Date.now() + 5_000
		render(<TimerFloatOverlay timer={{ label: 'Раунд', totalSeconds: 5, running: true, endsAt }} />)
		expect(sounds.timerStart).toHaveBeenCalledTimes(1)
		expect(sounds.timerWarning).toHaveBeenCalledTimes(1)   // 5 s is inside the last 30
		expect(sounds.timerEnd).not.toHaveBeenCalled()
		act(() => { vi.advanceTimersByTime(6_000) })
		expect(sounds.timerEnd).toHaveBeenCalledTimes(1)
		act(() => { vi.advanceTimersByTime(5_000) })
		expect(sounds.timerEnd).toHaveBeenCalledTimes(1)
	})

	it('stays quiet for someone who joins after the time ran out', () => {
		const endsAt = Date.now() - 60_000
		render(<TimerFloatOverlay timer={{ label: 'Раунд', totalSeconds: 60, running: true, endsAt }} />)
		act(() => { vi.advanceTimersByTime(3_000) })
		expect(sounds.timerEnd).not.toHaveBeenCalled()
		expect(sounds.timerStart).not.toHaveBeenCalled()
	})

	it('makes no sound while the timer stands still', () => {
		render(<TimerFloatOverlay timer={{ label: 'Гра', totalSeconds: 7200, running: false, endsAt: null }} />)
		act(() => { vi.advanceTimersByTime(3_000) })
		expect(Object.values(sounds).every(f => f.mock.calls.length === 0)).toBe(true)
	})
})
