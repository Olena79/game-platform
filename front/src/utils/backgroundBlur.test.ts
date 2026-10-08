import { describe, it, expect, vi, beforeEach } from 'vitest'

const lib = vi.hoisted(() => ({ supported: true, failSet: false }))
vi.mock('@livekit/track-processors', () => ({
	supportsBackgroundProcessors: () => lib.supported,
	BackgroundProcessor: (_o: unknown, name: string) => ({ name }),
}))

import { applyBlur, blurPreferred, removeBlur, setBlurPreferred } from './backgroundBlur'

const fakeTrack = () => {
	let processor: { name: string } | undefined
	return {
		getProcessor: () => processor,
		setProcessor: vi.fn(async (p: { name: string }) => { if (lib.failSet) throw new Error('no webgl'); processor = p }),
		stopProcessor: vi.fn(async () => { processor = undefined }),
	}
}

describe('background blur', () => {
	beforeEach(() => { lib.supported = true; lib.failSet = false; localStorage.clear() })

	it('is off unless chosen, and the choice is kept on the device', () => {
		expect(blurPreferred()).toBe(false)
		setBlurPreferred(true)
		expect(blurPreferred()).toBe(true)
		setBlurPreferred(false)
		expect(blurPreferred()).toBe(false)
	})

	it('is laid on once, and taken off', async () => {
		const tr = fakeTrack()
		expect(await applyBlur(tr as never)).toBe(true)
		expect(await applyBlur(tr as never)).toBe(true)
		expect(tr.setProcessor).toHaveBeenCalledTimes(1)
		await removeBlur(tr as never)
		expect(tr.getProcessor()).toBeUndefined()
	})

	it('leaves the plain camera when it cannot start', async () => {
		const tr = fakeTrack()
		lib.failSet = true
		expect(await applyBlur(tr as never)).toBe(false)
		expect(tr.getProcessor()).toBeUndefined()
		lib.failSet = false; lib.supported = false
		expect(await applyBlur(fakeTrack() as never)).toBe(false)
	})
})
