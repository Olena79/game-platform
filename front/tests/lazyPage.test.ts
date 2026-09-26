import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isStaleChunkError, reloadForNewVersion } from '../src/utils/lazyPage'

/**
 * A tab opened before a redeploy asks for page files that no longer exist.
 * It reloads once to get the new version — and never loops.
 */
describe('stale page files after a redeploy', () => {
	beforeEach(() => {
		sessionStorage.clear()
		Object.defineProperty(window, 'location', { value: { reload: vi.fn() }, writable: true })
	})

	it('recognises the error browsers give', () => {
		expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/CommunityPage-C2rsTHSR.js'))).toBe(true)
		expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
		expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
	})

	it('reloads once, then gives up instead of looping', () => {
		expect(reloadForNewVersion()).toBe(true)
		expect(reloadForNewVersion()).toBe(false)
		expect(window.location.reload).toHaveBeenCalledTimes(1)
	})
})
