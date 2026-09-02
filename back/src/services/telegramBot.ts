import logger from '../config/logger'
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

let lastUpdateId = 0

async function getUpdates(): Promise<TelegramUpdate[]> {
	try {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 35000)

		const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`, {
			signal: controller.signal,
		})
		clearTimeout(timeout)

		const data = await response.json()
		if (!data.ok) {
			logger.error('[telegram] getUpdates failed', { error: data.description })
			return []
		}
		return data.result || []
	} catch (err) {
		logger.error('[telegram] getUpdates error', { error: err instanceof Error ? err.message : String(err) })
		return []
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

	// Parse /start command with parameter: /start USER_ID
	if (text.startsWith('/start')) {
		const parts = text.split(' ')
		const userId = parts[1] || ''

		if (!userId) {
			await sendMessage(chatId, messages[lang].noDirectLink)
			return
		}

		// Validate userId format (MongoDB ObjectId)
		if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
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

	// Start polling loop
	const poll = async () => {
		const updates = await getUpdates()
		for (const update of updates) {
			lastUpdateId = update.update_id
			await handleUpdate(update)
		}
	}

	// Poll every 1 second
	setInterval(poll, 1000)
	logger.info('[telegram] Polling loop started')
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
