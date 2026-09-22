import logger from '../config/logger'
import { verifyTelegramLinkToken } from './tokenService'
import { User } from '../models/User'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'gamesofsenses_bot'
const API_URL = process.env.VITE_API_URL || 'http://localhost:5000'
const TELEGRAM_API = 'https://api.telegram.org/bot'

interface TelegramUpdate {
	update_id: number
	message?: {
		chat: { id: number }
		from: { id: number; first_name: string }
		text: string
		entities?: Array<{ type: string; offset: number; length: number }>
	}
}

interface TelegramUser {
	id: number
	is_bot: boolean
	first_name: string
	username?: string
}

const POLL_TIMEOUT_S = 30
const CONFLICT_BACKOFF_MS = 5000
const ERROR_BACKOFF_MS = 3000
const CONFLICT_LOG_INTERVAL_MS = 60000

let lastUpdateId = 0
let pollingActive = false
let activeController: AbortController | null = null
let lastConflictLogAt = 0

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Telegram serves one getUpdates connection per token. A 409 means someone else
// holds it — an old deploy still draining, or a second process sharing the token.
// It resolves on its own, so log it once a minute instead of once per attempt.
function logConflict(description: string): void {
	const now = Date.now()
	if (now - lastConflictLogAt < CONFLICT_LOG_INTERVAL_MS) return
	lastConflictLogAt = now
	logger.warn('[telegram] getUpdates conflict — another poller holds this bot token, backing off', { error: description })
}

interface PollResult {
	updates: TelegramUpdate[]
	backoffMs: number
}

async function getUpdates(): Promise<PollResult> {
	const controller = new AbortController()
	activeController = controller
	// Guard against a long-poll that never returns; Telegram closes at POLL_TIMEOUT_S.
	const timeout = setTimeout(() => controller.abort(), (POLL_TIMEOUT_S + 5) * 1000)

	try {
		const response = await fetch(
			`${TELEGRAM_API}${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=${POLL_TIMEOUT_S}`,
			{ signal: controller.signal },
		)
		const data = await response.json()

		if (!data.ok) {
			if (data.error_code === 409) {
				logConflict(data.description)
				return { updates: [], backoffMs: CONFLICT_BACKOFF_MS }
			}
			logger.error('[telegram] getUpdates failed', { error: data.description })
			return { updates: [], backoffMs: ERROR_BACKOFF_MS }
		}
		return { updates: data.result || [], backoffMs: 0 }
	} catch (err) {
		// An abort during shutdown is expected, not an error worth reporting.
		if (!pollingActive) return { updates: [], backoffMs: 0 }
		logger.error('[telegram] getUpdates error', { error: err instanceof Error ? err.message : String(err) })
		return { updates: [], backoffMs: ERROR_BACKOFF_MS }
	} finally {
		clearTimeout(timeout)
		if (activeController === controller) activeController = null
	}
}

async function sendMessage(chatId: number, text: string): Promise<boolean> {
	try {
		const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text,
				parse_mode: 'HTML',
			}),
		})
		const data = await response.json()
		if (!data.ok) {
			logger.error('[telegram] sendMessage failed', { chatId, error: data.description })
			return false
		}
		return true
	} catch (err) {
		logger.error('[telegram] sendMessage error', { chatId, error: err instanceof Error ? err.message : String(err) })
		return false
	}
}

const messages = {
	uk: {
		userNotFound: '❌ Користувача не знайдено. Спочатку зареєструйтесь на сайті.',
		success: (firstName: string) =>
			`✅ <b>Успішно підключено до Telegram!</b>\n\n` +
			`Привіт, <b>${firstName}</b>! 👋\n\n` +
			`Тепер ви будете отримувати коди ігр прямо в цей чат. ` +
			`Це зручніше, ніж перевіряти email.`,
		invalidLink: '❌ Некоректне посилання. Спожалуйста, використовуйте посилання з сайту Games of Senses.',
		helpMessage: 'Я просто сповіщу вас про коди ігр. 🎮\n\nІнші команди поки недоступні.',
		noDirectLink: `👋 Привіт! Схоже, ви відкрили бота напряму.\n\nСпожалуйста, <a href="https://t.me/${BOT_USERNAME}?start=YOUR_USER_ID">перейдіть за посиланням на сайті</a>, щоб підключити Telegram.`,
	},
	en: {
		userNotFound: '❌ User not found. Please register on the website first.',
		success: (firstName: string) =>
			`✅ <b>Successfully connected to Telegram!</b>\n\n` +
			`Hi, <b>${firstName}</b>! 👋\n\n` +
			`Now you will receive game codes directly in this chat. ` +
			`It's more convenient than checking email.`,
		invalidLink: '❌ Invalid link. Please use the link from the Games of Senses website.',
		helpMessage: 'I just notify you about game codes. 🎮\n\nOther commands are not available yet.',
		noDirectLink: `👋 Hi! It looks like you opened the bot directly.\n\nPlease <a href="https://t.me/${BOT_USERNAME}?start=YOUR_USER_ID">follow the link on the website</a> to connect Telegram.`,
	},
}

async function handleStartCommand(userId: string, chatId: number, firstName: string): Promise<void> {
	try {
		// Try to find user by ID and update telegram_chat_id
		const user = await User.findByIdAndUpdate(
			userId,
			{ telegramChatId: String(chatId) },
			{ new: true }
		)

		if (!user) {
			const lang = (process.env.DEFAULT_LANGUAGE || 'uk') as 'uk' | 'en'
			await sendMessage(chatId, messages[lang].userNotFound)
			logger.warn('[telegram] Start command for non-existent user', { userId, chatId })
			return
		}

		// Use user's language
		const userLang = (user.language || 'uk') as 'uk' | 'en'
		const successMsg = messages[userLang].success(firstName)

		await sendMessage(chatId, successMsg)
		logger.info('[telegram] User linked successfully', { userId, chatId, firstName, language: userLang })
	} catch (err) {
		const lang = (process.env.DEFAULT_LANGUAGE || 'uk') as 'uk' | 'en'
		logger.error('[telegram] handleStartCommand error', { userId, chatId, error: err instanceof Error ? err.message : String(err) })
		await sendMessage(chatId, `⚠️ ${lang === 'uk' ? 'Сталась помилка. Спробуйте пізніше.' : 'An error occurred. Please try again later.'}`)
	}
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
	if (!update.message || !update.message.text) return

	const { chat, from, text } = update.message
	const chatId = chat.id
	const firstName = from.first_name
	const lang = (process.env.DEFAULT_LANGUAGE || 'uk') as 'uk' | 'en'

	// /start <token>, where the token is a short-lived signature over the
	// account id. A raw id would be enough to attach this chat to somebody
	// else's account — and ids are easy to come by.
	if (text.startsWith('/start')) {
		const payload = text.split(' ')[1] || ''

		if (!payload) {
			await sendMessage(chatId, messages[lang].noDirectLink)
			return
		}

		const userId = verifyTelegramLinkToken(payload)
		if (!userId) {
			await sendMessage(chatId, messages[lang].invalidLink)
			return
		}

		await handleStartCommand(userId, chatId, firstName)
	} else {
		// Any other message
		await sendMessage(chatId, messages[lang].helpMessage)
	}
}

export async function startTelegramPolling(): Promise<void> {
	if (!BOT_TOKEN) {
		logger.warn('[telegram] BOT_TOKEN not set — Telegram polling disabled')
		return
	}

	// Telegram allows a single getUpdates consumer per bot, so a second instance
	// (a developer machine, a one-off script) steals updates from the deployed
	// one. This lets such a run still send messages without taking the bot over.
	if (process.env.TELEGRAM_POLLING === 'off') {
		logger.warn('[telegram] Polling disabled by TELEGRAM_POLLING=off — sending still works')
		return
	}

	if (pollingActive) {
		logger.warn('[telegram] Polling already active, skipping restart')
		return
	}

	logger.info('[telegram] Starting polling...', { botUsername: BOT_USERNAME })

	// Test bot connectivity
	try {
		const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getMe`)
		const data = await response.json()
		if (!data.ok) {
			logger.error('[telegram] Bot token invalid', { error: data.description })
			return
		}
		const botInfo = data.result as TelegramUser
		logger.info('[telegram] Bot connected', { botId: botInfo.id, botUsername: botInfo.username })
	} catch (err) {
		logger.error('[telegram] Failed to connect to bot', { error: err instanceof Error ? err.message : String(err) })
		return
	}

	pollingActive = true
	pollLoop().catch(err => {
		pollingActive = false
		logger.error('[telegram] Polling loop crashed', { error: err instanceof Error ? err.message : String(err) })
	})
	logger.info('[telegram] Polling loop started')
}

// Sequential loop — exactly one getUpdates in flight at a time. getUpdates
// long-polls for up to POLL_TIMEOUT_S, so a fixed interval would stack
// overlapping requests and Telegram would kill each previous one with a 409.
async function pollLoop(): Promise<void> {
	while (pollingActive) {
		const { updates, backoffMs } = await getUpdates()
		if (!pollingActive) break

		for (const update of updates) {
			lastUpdateId = update.update_id
			try {
				await handleUpdate(update)
			} catch (err) {
				// A single bad update must not take the loop down.
				logger.error('[telegram] handleUpdate error', {
					updateId: update.update_id,
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}

		if (backoffMs > 0) await sleep(backoffMs)
	}
	logger.info('[telegram] Polling loop exited')
}

export function stopTelegramPolling(): void {
	if (!pollingActive) return
	pollingActive = false
	// Release the long-poll connection immediately, otherwise a redeploy spends
	// up to POLL_TIMEOUT_S with the incoming process losing 409s to this one.
	activeController?.abort()
	activeController = null
	logger.info('[telegram] Telegram polling stopped')
}

const gameNotificationMessages = {
	uk: {
		playerCode: (code: string, name: string) => `🎮 <b>Код гри:</b> <code>${code}</code>\n\n<b>${name}</b>\n👤 Роль: Гравець`,
		spectatorCode: (code: string, name: string) => `👁️ <b>Код глядача:</b> <code>${code}</code>\n\n<b>${name}</b>`,
		reminder: (name: string, minutesUntil: number, timeStr: string) =>
			`⏰ <b>Нагадування!</b>\n\n<b>${name}</b> починається через ${minutesUntil} хвилин\n⏱️ ${timeStr}`,
	},
	en: {
		playerCode: (code: string, name: string) => `🎮 <b>Game code:</b> <code>${code}</code>\n\n<b>${name}</b>\n👤 Role: Player`,
		spectatorCode: (code: string, name: string) => `👁️ <b>Spectator code:</b> <code>${code}</code>\n\n<b>${name}</b>`,
		reminder: (name: string, minutesUntil: number, timeStr: string) =>
			`⏰ <b>Reminder!</b>\n\n<b>${name}</b> starts in ${minutesUntil} minutes\n⏱️ ${timeStr}`,
	},
}

/** Telegram rejects anything longer than this in a single message. */
const TELEGRAM_MAX_MESSAGE = 4096

/** Notes are free text typed by the GM, and the bot posts with parse_mode HTML. */
function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Splits on line boundaries where possible, so a long game stays readable. */
function splitForTelegram(text: string, limit: number): string[] {
	const parts: string[] = []
	let rest = text
	while (rest.length > limit) {
		let cut = rest.lastIndexOf('\n', limit)
		if (cut < limit * 0.5) cut = limit    // one very long line: hard cut
		parts.push(rest.slice(0, cut))
		rest = rest.slice(cut).replace(/^\n/, '')
	}
	if (rest.length > 0) parts.push(rest)
	return parts
}

/**
 * Sends the GM's notes after a game. These exist only in the browser until
 * this runs — ending the game clears them — so a failure here loses them.
 */
export async function sendNotesToTelegram(
	telegramChatId: string,
	gameTitle: string,
	notes: string,
	language: string = 'uk',
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false

	const lang = (['uk', 'en'].includes(language) ? language : 'uk') as 'uk' | 'en'
	const header = lang === 'uk'
		? `📝 <b>Нотатки з гри</b>\n<b>${escapeHtml(gameTitle)}</b>\n\n`
		: `📝 <b>Notes from the game</b>\n<b>${escapeHtml(gameTitle)}</b>\n\n`

	const chatId = parseInt(telegramChatId, 10)
	if (!Number.isFinite(chatId)) return false

	const body = escapeHtml(notes)
	const chunks = splitForTelegram(body, TELEGRAM_MAX_MESSAGE - header.length - 32)

	let allSent = true
	for (let i = 0; i < chunks.length; i++) {
		const prefix = i === 0 ? header : `<b>(${i + 1}/${chunks.length})</b>\n\n`
		const ok = await sendMessage(chatId, prefix + chunks[i])
		if (!ok) allSent = false
	}
	return allSent
}

/**
 * The recording link only ever appeared in the observer window. When a
 * recording is closed after the gamemaster has already left — or salvaged by
 * the server — nobody is there to read it, so it goes to their chat instead.
 */
/**
 * Password recovery runs over Telegram: there is no mail service any more,
 * and this is the only channel we can prove belongs to the account.
 */
export async function sendPasswordResetToTelegram(
	telegramChatId: string,
	resetUrl: string,
	language: string = 'uk',
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false
	const chatId = parseInt(telegramChatId, 10)
	if (!Number.isFinite(chatId)) return false

	const lang = (['uk', 'en'].includes(language) ? language : 'uk') as 'uk' | 'en'
	const text = lang === 'uk'
		? [
			'\u{1F511} <b>\u0412\u0456\u0434\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043f\u0430\u0440\u043e\u043b\u044f</b>',
			'',
			resetUrl,
			'',
			'\u041f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0434\u0456\u0454 30 \u0445\u0432\u0438\u043b\u0438\u043d. \u042f\u043a\u0449\u043e \u0446\u0435 \u0431\u0443\u043b\u0438 \u043d\u0435 \u0432\u0438 \u2014 \u043f\u0440\u043e\u0441\u0442\u043e \u0437\u043d\u0435\u0445\u0442\u0443\u0439\u0442\u0435 \u0446\u0438\u043c \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u043b\u0435\u043d\u043d\u044f\u043c.',
		].join('\n')
		: [
			'\u{1F511} <b>Password reset</b>',
			'',
			resetUrl,
			'',
			'The link works for 30 minutes. If this was not you, ignore this message.',
		].join('\n')

	return sendMessage(chatId, text)
}

export async function sendRecordingLinkToTelegram(
	telegramChatId: string,
	gameTitle: string,
	shareLink: string,
	interrupted: boolean,
	language: string = 'uk',
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false
	const chatId = parseInt(telegramChatId, 10)
	if (!Number.isFinite(chatId)) return false

	const lang = (['uk', 'en'].includes(language) ? language : 'uk') as 'uk' | 'en'
	const titleLine = gameTitle ? '\n<b>' + escapeHtml(gameTitle) + '</b>' : ''

	const parts = lang === 'uk'
		? [
			'🎥 <b>Запис гри збережено</b>' + titleLine,
			'',
			shareLink,
			interrupted ? '\n⚠️ Запис було перервано — збережено те, що встигло завантажитись.' : '',
			'\n🗓 Файл видалиться через 7 днів.',
		]
		: [
			'🎥 <b>Recording saved</b>' + titleLine,
			'',
			shareLink,
			interrupted ? '\n⚠️ The recording was interrupted — whatever had been uploaded is kept.' : '',
			'\n🗓 The file is deleted after 7 days.',
		]

	return sendMessage(chatId, parts.filter(Boolean).join('\n'))
}

export async function sendGameCodeToTelegram(
	telegramChatId: string,
	gameCode: string,
	gameName: string,
	role: 'player' | 'spectator' = 'player',
	language: string = 'uk',
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false

	const lang = (['uk', 'en'].includes(language) ? language : 'uk') as 'uk' | 'en'
	const msgs = gameNotificationMessages[lang]
	const message = role === 'spectator'
		? msgs.spectatorCode(gameCode, gameName)
		: msgs.playerCode(gameCode, gameName)

	const chatId = parseInt(telegramChatId, 10)
	return sendMessage(chatId, message)
}

export async function sendGameReminderToTelegram(
	telegramChatId: string,
	gameName: string,
	minutesUntil: number,
	gameTime: string,
	language: string = 'uk',
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false

	const lang = (['uk', 'en'].includes(language) ? language : 'uk') as 'uk' | 'en'
	const msgs = gameNotificationMessages[lang]
	const message = msgs.reminder(gameName, minutesUntil, gameTime)

	const chatId = parseInt(telegramChatId, 10)
	return sendMessage(chatId, message)
}
