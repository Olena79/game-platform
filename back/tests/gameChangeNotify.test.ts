/**
 * Important changes to a game reach everyone registered for it: a new date
 * or time, and a cancellation. Sent after the change is saved, so they must
 * never throw.
 */
const sent: Array<{ chat: string; text: string }> = []
let mockQueried: string[] = []
let mockFail = false

jest.mock('../src/models/User', () => ({
	User: {
		find: (q: { _id: { $in: string[] } }) => {
			mockQueried = q._id.$in
			const all: Record<string, { _id: string; telegramChatId: string; language: string }> = {
				gm: { _id: 'gm', telegramChatId: '1', language: 'uk' },
				p1: { _id: 'p1', telegramChatId: '2', language: 'uk' },
				p2: { _id: 'p2', telegramChatId: '2', language: 'uk' },   // same Telegram as p1
				s1: { _id: 's1', telegramChatId: '3', language: 'en' },
			}
			return { select: () => ({ lean: async () => { if (mockFail) throw new Error('db down'); return q._id.$in.map(id => all[id]).filter(Boolean) } }) }
		},
	},
}))
jest.mock('../src/services/telegramBot', () => {
	const actual = jest.requireActual('../src/services/telegramBot')
	return { ...actual, sendTelegramHtml: async (chat: string, text: string) => { sent.push({ chat, text }); return { ok: true, unreachable: false } } }
})

import { notifyGameCancelled, notifyGameRescheduled } from '../src/services/gameChangeNotify'

const now = new Date('2026-10-01T12:00:00Z')
const game = (scheduledAt: Date | null) => ({
	_id: 'g1', title: 'Пташине море', scheduledAt, creatorId: 'gm', gameCode: 'NEWPL4', spectatorCode: 'NEWSP7',
	registeredPlayers: [{ userId: 'p1' }, { userId: 'p2' }], spectators: [{ userId: 's1' }],
})

describe('game change notices', () => {
	beforeEach(() => { sent.length = 0; mockQueried = []; mockFail = false })

	it('a new time reaches players and spectators, once per chat, not the gamemaster who changed it', async () => {
		const before = new Date('2026-10-02T16:00:00Z')
		const after = new Date('2026-10-03T17:00:00Z')
		expect(await notifyGameRescheduled(game(after), before)).toBe(2)
		expect(mockQueried).not.toContain('gm')
		expect(sent.map(s => s.chat).sort()).toEqual(['2', '3'])
		const uk = sent.find(s => s.chat === '2')!.text
		expect(uk).toContain('Гру перенесено')
		expect(uk).toContain('Було:')
		expect(uk).toContain('Тепер:')
		expect(sent.find(s => s.chat === '3')!.text).toContain('has been moved')
		// The codes changed with the time: each gets their own new one
		expect(uk).toContain('<code>NEWPL4</code>')
		expect(uk).not.toContain('NEWSP7')
		expect(sent.find(s => s.chat === '3')!.text).toContain('<code>NEWSP7</code>')
		expect(sent.find(s => s.chat === '3')!.text).not.toContain('NEWPL4')
	})

	it('says nothing when the time did not change', async () => {
		const t = new Date('2026-10-02T16:00:00Z')
		expect(await notifyGameRescheduled(game(t), new Date(t))).toBe(0)
		expect(sent).toHaveLength(0)
	})

	it('a cancellation reaches players and spectators', async () => {
		expect(await notifyGameCancelled(game(new Date('2026-10-02T16:00:00Z')), { byGamemaster: true }, now)).toBe(2)
		expect(sent[0].text).toContain('Гру скасовано')
		expect(mockQueried).not.toContain('gm')
	})

	it('the gamemaster hears it too when the administrator deleted the game', async () => {
		await notifyGameCancelled(game(new Date('2026-10-02T16:00:00Z')), { byGamemaster: false }, now)
		expect(sent.map(s => s.chat).sort()).toEqual(['1', '2', '3'])
	})

	it('a game that already took place is not "cancelled" to anyone', async () => {
		expect(await notifyGameCancelled(game(new Date('2026-09-20T16:00:00Z')), { byGamemaster: true }, now)).toBe(0)
		expect(sent).toHaveLength(0)
	})

	it('never throws', async () => {
		mockFail = true
		await expect(notifyGameCancelled(game(null), { byGamemaster: true }, now)).resolves.toBe(0)
	})
})
