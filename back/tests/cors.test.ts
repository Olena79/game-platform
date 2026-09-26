import express from 'express'
import cors from 'cors'
import request from 'supertest'
import { corsOptions } from '../src/config/cors'

/**
 * The site and the API live on different domains, so the browser asks the
 * API first (a preflight) whether a request may carry its headers. A header
 * the API does not allow fails the request before it is sent — silently, as
 * a "network error". The recorder's part uploads died exactly like that.
 */
describe('CORS', () => {
	const site = 'https://game-platform-red.vercel.app'
	const app = express()
	app.use(cors(corsOptions([site])))
	app.post('/api/recordings/:id/parts/:n', (_req, res) => { res.json({ ok: true }) })

	it('lets the recorder send its part headers from the site', async () => {
		const res = await request(app)
			.options('/api/recordings/abc/parts/1')
			.set('Origin', site)
			.set('Access-Control-Request-Method', 'POST')
			.set('Access-Control-Request-Headers', 'authorization,content-type,x-final')
		expect(res.status).toBeLessThan(300)
		const allowed = String(res.headers['access-control-allow-headers']).toLowerCase()
		for (const h of ['authorization', 'content-type', 'x-final']) expect(allowed).toContain(h)
		expect(res.headers['access-control-allow-origin']).toBe(site)
	})

	it('does not answer for another site', async () => {
		const res = await request(app)
			.options('/api/recordings/abc/parts/1')
			.set('Origin', 'https://evil.example')
			.set('Access-Control-Request-Method', 'POST')
		expect(res.headers['access-control-allow-origin']).toBeUndefined()
	})
})
