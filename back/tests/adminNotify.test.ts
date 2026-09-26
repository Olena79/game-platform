/**
 * The administrator's notices — the sign-in code among them — go to one chat
 * only: the Telegram linked to the account named by ADMIN_EMAIL.
 */
const sent: Array<{ chat: string; text: string }> = []
const queries: unknown[] = []
let adminDoc: Record<string, unknown> = { _id: 'admin-id', telegramChatId: '777' }

jest.mock('../src/models/User', () => ({
	User: {
		findOne: (q: unknown) => {
			queries.push(q)
			return { select: () => ({ lean: async () => adminDoc }) }
		},
		findById: () => ({ select: () => ({ lean: async () => ({ name: 'Ann', surname: 'Lee' }) }) }),
	},
}))
jest.mock('../src/services/telegramBot', () => ({
	escapeHtml: (s: string) => s,
	formatGameDate: () => '',
	telegramEvents: { on: jest.fn() },
	sendTelegramHtml: async (chat: string, text: string) => { sent.push({ chat, text }); return { ok: true, unreachable: false } },
}))

import { notifyAdmin, forgetAdminCache, noticeGameCreated } from '../src/services/adminNotify'

describe('notices to the administrator', () => {
	beforeEach(() => { sent.length = 0; queries.length = 0; forgetAdminCache() })

	it('go only to the chat of the ADMIN_EMAIL account', async () => {
		process.env.ADMIN_EMAIL = ' Owner@Example.com '
		await notifyAdmin('code 123456')
		expect(queries).toEqual([{ email: 'owner@example.com' }])
		expect(sent).toEqual([{ chat: '777', text: 'code 123456' }])
	})

	it('go nowhere when no administrator is configured', async () => {
		process.env.ADMIN_EMAIL = ''
		expect(await notifyAdmin('code 123456')).toBe(false)
		expect(sent).toEqual([])
	})
})

describe('a new game', () => {
	beforeEach(() => { sent.length = 0; forgetAdminCache(); process.env.ADMIN_EMAIL = 'owner@example.com' })

	it('is not reported twice to an administrator who gets the announcement', async () => {
		adminDoc = { _id: 'admin-id', telegramChatId: '777' }
		await noticeGameCreated('someone-else', { title: 'T' })
		expect(sent).toEqual([])
	})

	it('is reported to an administrator who turned announcements off', async () => {
		adminDoc = { _id: 'admin-id', telegramChatId: '777', newsOptOut: true }
		await noticeGameCreated('someone-else', { title: 'T' })
		expect(sent).toHaveLength(1)
		expect(sent[0].chat).toBe('777')
	})
})
