import express from 'express'
import request from 'supertest'
import {
	authLimiter,
	loginLimiter,
	gamesLimiter,
	communityLimiter,
	uploadLimiter,
	livekitLimiter,
	recordingsLimiter,
} from '../src/middleware/rateLimitMiddleware'

/**
 * express-rate-limit v8 no longer exposes `.options`, so these check what the
 * limiters actually do to requests instead of what they were configured with.
 */
function appWith(limiter: express.RequestHandler, method: 'get' | 'post' = 'get') {
	const app = express()
	app.use(express.json())
	app.use(limiter)
	app[method]('/', (_req, res) => { res.json({ ok: true }) })
	return app
}

async function hit(app: express.Express, times: number, body?: object) {
	const results: number[] = []
	for (let i = 0; i < times; i++) {
		const req = body ? request(app).post('/').send(body) : request(app).get('/')
		const res = await req
		results.push(res.status)
	}
	return results
}

describe('Rate limiting', () => {
	it('every limiter is a usable middleware', () => {
		for (const limiter of [authLimiter, loginLimiter, gamesLimiter, communityLimiter, uploadLimiter, livekitLimiter, recordingsLimiter]) {
			expect(typeof limiter).toBe('function')
		}
	})

	it('lets ordinary traffic through', async () => {
		const statuses = await hit(appWith(gamesLimiter), 5)
		expect(statuses.every(s => s === 200)).toBe(true)
	})

	it('sends standard rate limit headers', async () => {
		const res = await request(appWith(gamesLimiter)).get('/')
		expect(res.headers['ratelimit-limit'] ?? res.headers['ratelimit']).toBeDefined()
	})

	// Password guessing is the case worth being strict about: ten tries per
	// account per quarter hour, and a wrong password does count.
	it('stops a burst of failed sign-ins', async () => {
		const app = express()
		app.use(express.json())
		app.use(loginLimiter)
		app.post('/', (_req, res) => { res.status(401).json({ message: 'INVALID_CREDENTIALS' }) })

		const statuses = await hit(app, 12, { email: 'victim@example.com', password: 'guess' })
		expect(statuses.filter(s => s === 429).length).toBeGreaterThan(0)
	})

	it('counts sign-in attempts per account, not per address', async () => {
		const app = express()
		app.use(express.json())
		app.use(loginLimiter)
		app.post('/', (_req, res) => { res.status(401).json({ message: 'INVALID_CREDENTIALS' }) })

		await hit(app, 12, { email: 'first@example.com', password: 'guess' })
		const other = await request(app).post('/').send({ email: 'second@example.com', password: 'guess' })
		expect(other.status).toBe(401)   // a different account is unaffected
	})
})
