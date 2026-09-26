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
