/**
 * The gamemaster hears in Telegram when someone signs up for their game.
 * It runs after the registration is saved, so it must never throw.
 */
const sent: Array<{ chat: string; text: string }> = []
let mockGm: Record<string, unknown> | null = { telegramChatId: '555', language: 'uk' }
let mockFail = false

jest.mock('../src/models/User', () => ({
	User: {
		findById: () => ({ select: () => ({ lean: async () => { if (mockFail) throw new Error('db down'); return mockGm } }) }),
	},
}))
jest.mock('../src/services/telegramBot', () => ({
	escapeHtml: (s: string) => s.replace(/</g, '&lt;'),
	sendTelegramHtml: async (chat: string, text: string) => { sent.push({ chat, text }); return { ok: true, unreachable: false } },
}))

import { notifyGmOfRegistration, registrationText } from '../src/services/registrationNotify'

const game = { creatorId: 'gm', title: 'Пташине море', maxPlayers: 10, playersCount: 4, spectatorsCount: 2 }

describe('registration notice to the gamemaster', () => {
	beforeEach(() => { sent.length = 0; mockGm = { telegramChatId: '555', language: 'uk' }; mockFail = false })

	it('goes to the gamemaster’s chat with the name and the count', async () => {
		await notifyGmOfRegistration(game, { name: 'Андрій', surname: 'Коваль' }, 'player')
		expect(sent).toHaveLength(1)
		expect(sent[0].chat).toBe('555')
		expect(sent[0].text).toContain('Новий гравець')
		expect(sent[0].text).toContain('Андрій Коваль')
		expect(sent[0].text).toContain('4 / 10')
	})

	it('says spectator for a spectator', async () => {
		await notifyGmOfRegistration(game, { name: 'Оля' }, 'spectator')
		expect(sent[0].text).toContain('Новий глядач')
		expect(sent[0].text).toContain('Глядачів: 2')
	})

	it('speaks English to an English-speaking gamemaster', () => {
		expect(registrationText(game, { name: 'Ann' }, 'player', 'en')).toContain('New player')
	})

	it('escapes names, so a name cannot break the message', () => {
		expect(registrationText(game, { name: '<b>x' }, 'player', 'uk')).toContain('&lt;b>x')
	})

	it('stays silent when the gamemaster has no Telegram', async () => {
		mockGm = { language: 'uk' }
		await notifyGmOfRegistration(game, { name: 'A' }, 'player')
		expect(sent).toHaveLength(0)
	})

	it('never throws, whatever fails', async () => {
		mockFail = true
		await expect(notifyGmOfRegistration(game, { name: 'A' }, 'player')).resolves.toBeUndefined()
	})
})
