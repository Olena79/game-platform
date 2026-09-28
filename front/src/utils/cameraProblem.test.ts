import { describe, it, expect } from 'vitest'
import { cameraProblem } from './cameraProblem'

const err = (name: string, message = '') => Object.assign(new Error(message), { name })

describe('cameraProblem', () => {
	it('tells a site block from a system block', () => {
		expect(cameraProblem(err('NotAllowedError', 'Permission denied'))).toBe('blocked')
		expect(cameraProblem(err('NotAllowedError', 'Permission denied by system'))).toBe('system')
	})
	it('reads a camera held by another program or switched off as busy', () => {
		expect(cameraProblem(err('NotReadableError', 'Could not start video source'))).toBe('busy')
	})
	it('reads no camera as missing', () => {
		expect(cameraProblem(err('NotFoundError'))).toBe('missing')
	})
	it('keeps anything else generic', () => {
		expect(cameraProblem(err('TypeError'))).toBe('other')
		expect(cameraProblem(null)).toBe('other')
	})
})

describe('watchPermission', () => {
	it('reports the state, then changes, and stops when asked', async () => {
		const { watchPermission } = await import('./cameraProblem')
		const target = new EventTarget() as EventTarget & { state: PermissionState }
		target.state = 'denied'
		const orig = Object.getOwnPropertyDescriptor(navigator, 'permissions')
		Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => target } })
		const seen: Array<[PermissionState, boolean]> = []
		const stop = watchPermission('camera', (s, changed) => seen.push([s, changed]))
		await new Promise(r => setTimeout(r, 0))
		target.state = 'granted'
		target.dispatchEvent(new Event('change'))
		stop()
		target.dispatchEvent(new Event('change'))
		expect(seen).toEqual([['denied', false], ['granted', true]])
		if (orig) Object.defineProperty(navigator, 'permissions', orig)
		else delete (navigator as { permissions?: unknown }).permissions
	})

	it('does nothing where the browser cannot tell', async () => {
		const { watchPermission } = await import('./cameraProblem')
		const orig = Object.getOwnPropertyDescriptor(navigator, 'permissions')
		Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => { throw new TypeError('camera') } } })
		const seen: unknown[] = []
		const stop = watchPermission('camera', s => seen.push(s))
		await new Promise(r => setTimeout(r, 0))
		stop()
		expect(seen).toEqual([])
		if (orig) Object.defineProperty(navigator, 'permissions', orig)
		else delete (navigator as { permissions?: unknown }).permissions
	})
})
