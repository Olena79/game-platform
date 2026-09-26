import express from 'express'
import request from 'supertest'

/**
 * The admin panel's door: only the administrator's account, only with the
 * passphrase, only with the Telegram code — and nothing inside without the
 * session that results.
 */
const notifyAdmin = jest.fn(async (_html: string) => true)

jest.mock('../src/middleware/authMiddleware', () => ({
	authMiddleware: (req: any, res: any, next: any) => {
		const id = req.header('x-test-user')
		if (!id) { res.status(401).json({ message: 'No token provided' }); return }
		req.userId = id
		next()
	},
	forgetUser: jest.fn(),
}))
jest.mock('../src/services/adminNotify', () => ({
	adminEmail: () => 'owner@example.com',
	isAdminUser: async (id: string) => id === 'admin',
	notifyAdmin: (html: string) => notifyAdmin(html),
}))
jest.mock('../src/models/User', () => ({
	User: {
		findById: () => ({ select: () => ({ lean: async () => ({ telegramChatId: '42' }) }) }),
		find: () => ({ select: () => ({ lean: async () => [] }) }),
		countDocuments: async () => 0,
	},
}))
jest.mock('../src/models/Game', () => ({ Game: { countDocuments: async () => 0 } }))
jest.mock('../src/models/Post', () => ({ Post: { countDocuments: async () => 0 } }))
jest.mock('../src/models/Comment', () => ({ Comment: { countDocuments: async () => 0 } }))
// One row as the old Google Drive recorder left it: no type, mode, key or dates
const oldDriveRow = { _id: 'r1', gameTitle: 'Стара гра', gmId: 'gm', driveFileId: 'x', status: 'completed', shareLink: 'https://drive.example/x' }
jest.mock('../src/models/Recording', () => ({
	Recording: {
		countDocuments: async () => 0,
		aggregate: async () => [],
		find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [oldDriveRow] }) }) }),
	},
}))
jest.mock('../src/models/AdminLog', () => ({ AdminLog: { create: async () => ({}) } }))
jest.mock('../src/socket/gameRoom', () => ({ listRooms: () => [], endRoomAsAdmin: jest.fn(), kickUser: jest.fn() }))
jest.mock('../src/services/accountDeletion', () => ({ deleteAccount: jest.fn() }))
jest.mock('../src/services/gameDeletion', () => ({ deleteGame: jest.fn() }))
jest.mock('../src/services/recording', () => ({ deleteRecording: jest.fn() }))
jest.mock('../src/services/telegramBot', () => ({ broadcastToAll: jest.fn(), escapeHtml: (s: string) => s }))

import makeAdminRouter from '../src/routes/admin'
import { hashPassphrase, resetAdminAuthState } from '../src/services/adminAuth'

const PHRASE = 'the owl reads maps by moonlight'

function app() {
	const a = express()
	a.use(express.json())
	a.use('/api/admin', makeAdminRouter({ to: () => ({ emit: jest.fn() }) } as any))
	return a
}

describe('admin sign-in', () => {
	beforeAll(async () => {
		process.env.ADMIN_EMAIL = 'owner@example.com'
		process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(PHRASE, 100_000)
	})
	beforeEach(() => {
		resetAdminAuthState()
		notifyAdmin.mockClear()
	})

	it('does not exist for anyone else', async () => {
		const res = await request(app()).post('/api/admin/login').set('x-test-user', 'member').send({ passphrase: PHRASE })
		expect(res.status).toBe(404)
		expect(notifyAdmin).not.toHaveBeenCalled()
	})

	it('refuses a wrong passphrase and tells the administrator', async () => {
		const res = await request(app()).post('/api/admin/login').set('x-test-user', 'admin').send({ passphrase: 'guess' })
		expect(res.status).toBe(401)
		expect(notifyAdmin.mock.calls[0][0]).toContain('Невдала спроба')
	})

	it('passphrase, then the Telegram code, then a session that opens the panel', async () => {
		const a = app()
		expect((await request(a).get('/api/admin/stats').set('x-test-user', 'admin')).status).toBe(401)

		const login = await request(a).post('/api/admin/login').set('x-test-user', 'admin').send({ passphrase: PHRASE })
		expect(login.status).toBe(200)
		const code = /<code>(\d{6})<\/code>/.exec(notifyAdmin.mock.calls[0][0])![1]

		const wrong = code === '000000' ? '111111' : '000000'
		expect((await request(a).post('/api/admin/verify').set('x-test-user', 'admin').send({ code: wrong })).status).toBe(401)

		const verify = await request(a).post('/api/admin/verify').set('x-test-user', 'admin').send({ code })
		expect(verify.status).toBe(200)
		const token = verify.body.token as string

		const stats = await request(a).get('/api/admin/stats').set('x-test-user', 'admin').set('x-admin-token', token)
		expect(stats.status).toBe(200)
		expect(stats.body).toHaveProperty('users')

		// The session is the administrator's, not the token-holder's
		expect((await request(a).get('/api/admin/stats').set('x-test-user', 'member').set('x-admin-token', token)).status).toBe(401)

		await request(a).post('/api/admin/logout').set('x-test-user', 'admin').set('x-admin-token', token)
		expect((await request(a).get('/api/admin/stats').set('x-test-user', 'admin').set('x-admin-token', token)).status).toBe(401)
	})

	it('locks the door after five failures', async () => {
		const a = app()
		for (let i = 0; i < 5; i++) {
			await request(a).post('/api/admin/login').set('x-test-user', 'admin').send({ passphrase: 'nope' })
		}
		const res = await request(a).post('/api/admin/login').set('x-test-user', 'admin').send({ passphrase: PHRASE })
		expect(res.status).toBe(429)
	})

	it('lists recordings left by the old recorder without failing', async () => {
		const a = app()
		await request(a).post('/api/admin/login').set('x-test-user', 'admin').send({ passphrase: PHRASE })
		const code = /<code>(\d{6})<\/code>/.exec(notifyAdmin.mock.calls[0][0])![1]
		const { body: { token } } = await request(a).post('/api/admin/verify').set('x-test-user', 'admin').send({ code })
		const res = await request(a).get('/api/admin/recordings').set('x-test-user', 'admin').set('x-admin-token', token)
		expect(res.status).toBe(200)
		expect(res.body[0]).toMatchObject({ gameTitle: 'Стара гра', contentType: '', mode: 'drive', createdAt: null })
	})
})
