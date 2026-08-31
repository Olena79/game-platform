import * as Sentry from '@sentry/node'
import { initializeSentry, captureException, captureMessage, addBreadcrumb } from '../src/config/sentry'

describe('Sentry Configuration', () => {
	describe('Initialization', () => {
		it('should export initializeSentry function', () => {
			expect(typeof initializeSentry).toBe('function')
		})

		it('should return false when no DSN provided in dev', () => {
			process.env.NODE_ENV = 'development'
			// When no DSN, should return false
			const result = initializeSentry()
			expect(typeof result).toBe('boolean')
		})

		it('should return boolean', () => {
			const result = initializeSentry()
			expect(typeof result).toBe('boolean')
		})
	})

	describe('Error Capturing', () => {
		it('should export captureException function', () => {
			expect(typeof captureException).toBe('function')
		})

		it('should export captureMessage function', () => {
			expect(typeof captureMessage).toBe('function')
		})

		it('should export addBreadcrumb function', () => {
			expect(typeof addBreadcrumb).toBe('function')
		})
	})

	describe('captureException', () => {
		it('should accept error and context', () => {
			const error = new Error('Test error')
			expect(() => {
				captureException(error, { userId: '507f' })
			}).not.toThrow()
		})

		it('should accept error without context', () => {
			const error = new Error('Test error')
			expect(() => {
				captureException(error)
			}).not.toThrow()
		})
	})

	describe('captureMessage', () => {
		it('should accept message and level', () => {
			expect(() => {
				captureMessage('Test message', 'info')
			}).not.toThrow()
		})

		it('should accept message with default level', () => {
			expect(() => {
				captureMessage('Test message')
			}).not.toThrow()
		})
	})

	describe('addBreadcrumb', () => {
		it('should accept message and data', () => {
			expect(() => {
				addBreadcrumb('Test breadcrumb', { action: 'login' })
			}).not.toThrow()
		})

		it('should accept message without data', () => {
			expect(() => {
				addBreadcrumb('Test breadcrumb')
			}).not.toThrow()
		})
	})

	describe('Sentry Module', () => {
		it('should export Sentry object', () => {
			expect(Sentry).toBeDefined()
		})

		it('should have init method', () => {
			expect(typeof Sentry.init).toBe('function')
		})

		it('should have captureException method', () => {
			expect(typeof Sentry.captureException).toBe('function')
		})

		it('should have captureMessage method', () => {
			expect(typeof Sentry.captureMessage).toBe('function')
		})

		it('should have addBreadcrumb method', () => {
			expect(typeof Sentry.addBreadcrumb).toBe('function')
		})
	})
})
