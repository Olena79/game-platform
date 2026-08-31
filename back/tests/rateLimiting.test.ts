import request from 'supertest'
import {
	authLimiter,
	gamesLimiter,
	communityLimiter,
	uploadLimiter,
	livekitLimiter,
	recordingsLimiter,
} from '../src/middleware/rateLimitMiddleware'

describe('Rate Limiting Middleware', () => {
	describe('authLimiter', () => {
		it('should be defined', () => {
			expect(authLimiter).toBeDefined()
		})

		it('should have correct window of 15 minutes', () => {
			expect(authLimiter.options.windowMs).toBe(15 * 60 * 1000)
		})

		it('should limit auth to 100 requests per 15 min', () => {
			expect(authLimiter.options.max).toBe(100)
		})
	})

	describe('gamesLimiter', () => {
		it('should be defined', () => {
			expect(gamesLimiter).toBeDefined()
		})

		it('should allow 500 requests per 15 min', () => {
			expect(gamesLimiter.options.max).toBe(500)
		})

		it('should have 15 minute window', () => {
			expect(gamesLimiter.options.windowMs).toBe(15 * 60 * 1000)
		})
	})

	describe('communityLimiter', () => {
		it('should be defined', () => {
			expect(communityLimiter).toBeDefined()
		})

		it('should allow 500 requests per 15 min', () => {
			expect(communityLimiter.options.max).toBe(500)
		})
	})

	describe('uploadLimiter', () => {
		it('should be defined', () => {
			expect(uploadLimiter).toBeDefined()
		})

		it('should restrict uploads to 50 requests per 15 min', () => {
			expect(uploadLimiter.options.max).toBe(50)
		})

		it('should be more restrictive than other limiters', () => {
			expect(uploadLimiter.options.max).toBeLessThan(gamesLimiter.options.max)
			expect(uploadLimiter.options.max).toBeLessThan(communityLimiter.options.max)
		})
	})

	describe('livekitLimiter', () => {
		it('should be defined', () => {
			expect(livekitLimiter).toBeDefined()
		})

		it('should allow 100 requests per 15 min', () => {
			expect(livekitLimiter.options.max).toBe(100)
		})
	})

	describe('recordingsLimiter', () => {
		it('should be defined', () => {
			expect(recordingsLimiter).toBeDefined()
		})

		it('should allow 100 requests per 15 min', () => {
			expect(recordingsLimiter.options.max).toBe(100)
		})
	})

	describe('Rate limiter configurations', () => {
		const limiters = [
			{ name: 'authLimiter', limiter: authLimiter },
			{ name: 'gamesLimiter', limiter: gamesLimiter },
			{ name: 'communityLimiter', limiter: communityLimiter },
			{ name: 'uploadLimiter', limiter: uploadLimiter },
			{ name: 'livekitLimiter', limiter: livekitLimiter },
			{ name: 'recordingsLimiter', limiter: recordingsLimiter },
		]

		it.each(limiters)('should have standardHeaders enabled for $name', ({ limiter }) => {
			expect(limiter.options.standardHeaders).toBe(true)
		})

		it.each(limiters)('should have legacyHeaders disabled for $name', ({ limiter }) => {
			expect(limiter.options.legacyHeaders).toBe(false)
		})

		it.each(limiters)('should have error message for $name', ({ limiter }) => {
			expect(limiter.options.message).toBeDefined()
			expect(typeof limiter.options.message).toBe('object')
			expect((limiter.options.message as any).message).toContain('Too many')
		})
	})

	describe('Rate limit order', () => {
		it('uploadLimiter should be most restrictive', () => {
			const limits = {
				upload: uploadLimiter.options.max,
				auth: authLimiter.options.max,
				livekit: livekitLimiter.options.max,
				recordings: recordingsLimiter.options.max,
				games: gamesLimiter.options.max,
				community: communityLimiter.options.max,
			}
			const maxLimit = Math.max(...Object.values(limits))
			expect(limits.upload).toBe(Math.min(...Object.values(limits)))
			expect(limits.community).toBe(maxLimit)
		})
	})
})
