/**
 * A failed first contact with Telegram (a network blip right after a deploy)
 * must not leave the bot deaf until the next deploy.
 */
process.env.TELEGRAM_BOT_TOKEN = 'test-token'
// Read after the token is set: the module takes it at load time
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startTelegramPolling, stopTelegramPolling } = require('../src/services/telegramBot') as typeof import('../src/services/telegramBot')

describe('bot startup', () => {
	const realFetch = global.fetch
	afterEach(() => {
		stopTelegramPolling()
		global.fetch = realFetch
		jest.useRealTimers()
	})

	it('tries again after "fetch failed" and starts once Telegram answers', async () => {
		process.env.TELEGRAM_POLLING = ''
		jest.useFakeTimers()
		const calls: string[] = []
		let reachable = false
		global.fetch = jest.fn(async (url: any) => {
			const method = String(url).split('/').pop()!.split('?')[0]
			calls.push(method)
			if (!reachable) throw new TypeError('fetch failed')
			if (method === 'getMe') return { json: async () => ({ ok: true, result: { id: 1, is_bot: true, first_name: 'b' } }) } as any
			// getUpdates and the rest: never answer, so the loop just waits
			return new Promise(() => undefined) as any
		}) as any

		await startTelegramPolling()
		expect(calls).toEqual(['getMe'])

		reachable = true
		await jest.advanceTimersByTimeAsync(5_000)
		expect(calls.filter(c => c === 'getMe')).toHaveLength(2)
		expect(calls).toContain('getUpdates')
	})

	it('stops retrying on shutdown', async () => {
		process.env.TELEGRAM_POLLING = ''
		jest.useFakeTimers()
		const fetchMock = jest.fn(async () => { throw new TypeError('fetch failed') })
		global.fetch = fetchMock as any
		await startTelegramPolling()
		stopTelegramPolling()
		await jest.advanceTimersByTimeAsync(120_000)
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})
