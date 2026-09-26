/**
 * Ten minutes before a game, everyone registered for it (with Telegram)
 * hears about it — once, with their own way in.
 */
const sent: Array<{ chat: string; text: string }> = []
let claimed = false

const game = {
	_id: 'g1',
	title: 'Пташине море',
	scheduledAt: new Date('2026-10-01T17:00:00Z'),
	gameCode: 'PLAY23',
	spectatorCode: 'WATCH7',
	creatorId: 'gm',
	registeredPlayers: [{ userId: 'p1' }],
	spectators: [{ userId: 's1' }],
}

jest.mock('../src/models/Game', () => ({
	Game: {
		find: () => ({ select: async () => [game] }),
		updateOne: async () => {
			const first = !claimed
			claimed = true
			return { modifiedCount: first ? 1 : 0 }
		},
	},
}))
jest.mock('../src/models/User', () => ({
	User: {
		find: () => ({ select: () => ({ lean: async () => [
			{ _id: 'gm', telegramChatId: '1', language: 'uk' },
			{ _id: 'p1', telegramChatId: '2', language: 'uk' },
			{ _id: 's1', telegramChatId: '3', language: 'en' },
		] }) }),
	},
}))
jest.mock('../src/services/telegramBot', () => {
	const actual = jest.requireActual('../src/services/telegramBot')
	return {
		...actual,
		sendTelegramHtml: async (chat: string, text: string) => { sent.push({ chat, text }); return { ok: true, unreachable: false } },
	}
})

import { sendDueReminders } from '../src/services/gameReminders'

describe('game reminders', () => {
	it('reminds each seat with its own code, once', async () => {
		const now = new Date(game.scheduledAt.getTime() - 10 * 60 * 1000)
		expect(await sendDueReminders(now)).toBe(3)
		const byChat = Object.fromEntries(sent.map(s => [s.chat, s.text]))
		expect(byChat['1']).toContain('ведучий')
		expect(byChat['2']).toContain('<code>PLAY23</code>')
		expect(byChat['2']).toContain('Через 10 хв')
		expect(byChat['2']).toContain('/room/PLAY23')
		expect(byChat['3']).toContain('<code>WATCH7</code>')
		expect(byChat['3']).not.toContain('PLAY23')

		// The next minute's run finds it already claimed
		expect(await sendDueReminders(new Date(now.getTime() + 60_000))).toBe(0)
	})
})
