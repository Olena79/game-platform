/**
 * Signing in with Google never makes a second account for an email that
 * already has one, and says "new" only when an account was really created.
 * It used to be guessed on the page from "Telegram not linked", so people
 * without Telegram were told "registered" at every Google sign-in.
 */
import express from 'express'
import request from 'supertest'

let mockExisting: Record<string, unknown> | null = null
const created: unknown[] = []

jest.mock('google-auth-library', () => ({
	OAuth2Client: class {
		async verifyIdToken() {
			return { getPayload: () => ({ sub: 'google-123', email: 'olena@gmail.com', email_verified: true, given_name: 'Олена', family_name: 'К' }) }
		}
	},
}))
jest.mock('../src/models/User', () => ({
	User: {
		findOne: async () => mockExisting,
		create: async (doc: Record<string, unknown>) => { created.push(doc); return { _id: 'new-id', tokenVersion: 0, ...doc } },
	},
}))
jest.mock('../src/services/tokenService', () => ({
	issueTokenPair: async () => ({ accessToken: 'a', refreshToken: 'r' }),
	refreshAccessToken: jest.fn(), revokeAllUserTokens: jest.fn(),
	generatePasswordResetToken: jest.fn(), verifyPasswordResetToken: jest.fn(),
}))
jest.mock('../src/services/adminNotify', () => ({ noticeNewUser: jest.fn() }))
jest.mock('../src/services/telegramBot', () => ({ sendPasswordResetToTelegram: jest.fn() }))

import authRoutes from '../src/routes/auth'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

describe('Google sign-in', () => {
	beforeEach(() => { created.length = 0; mockExisting = null })

	it('creates an account only for a new email, and says so', async () => {
		const res = await request(app).post('/api/auth/google').send({ token: 'x' })
		expect(res.status).toBe(200)
		expect(res.body.isNew).toBe(true)
		expect(created).toHaveLength(1)
	})

	it('signs in to the existing account for a known email — no second account', async () => {
		mockExisting = { _id: 'old-id', email: 'olena@gmail.com', googleId: 'google-123', name: 'Олена', tokenVersion: 0, save: jest.fn() }
		const res = await request(app).post('/api/auth/google').send({ token: 'x' })
		expect(res.status).toBe(200)
		expect(res.body.isNew).toBe(false)
		expect(res.body.user.id).toBe('old-id')
		expect(created).toHaveLength(0)
	})

	it('joins Google to an email + password account with the same email', async () => {
		const save = jest.fn()
		mockExisting = { _id: 'pw-id', email: 'olena@gmail.com', googleId: null, name: 'Олена', tokenVersion: 0, save }
		const res = await request(app).post('/api/auth/google').send({ token: 'x' })
		expect(res.body.isNew).toBe(false)
		expect(res.body.user.id).toBe('pw-id')
		expect(save).toHaveBeenCalled()
		expect(created).toHaveLength(0)
	})
})
