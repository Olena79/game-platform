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
		const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`, {
			timeout: 35000,
		})
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

async function handleStartCommand(userId: string, chatId: number, firstName: string): Promise<void> {
	try {
		// Try to find user by ID and update telegram_chat_id
		const user = await User.findByIdAndUpdate(
			userId,
			{ telegramChatId: String(chatId) },
			{ new: true }
		)

		if (!user) {
			await sendMessage(chatId, '❌ Пользователь не найден. Пожалуйста, сначала зарегистрируйтесь на сайте.')
			logger.warn('[telegram] Start command for non-existent user', { userId, chatId })
			return
		}

		// Success message
		const successMsg = `✅ <b>Успешно подключено к Telegram!</b>\n\n` +
			`Привет, <b>${firstName}</b>! 👋\n\n` +
			`Теперь вы будете получать коды игр прямо в этот чат. ` +
			`Это удобнее, чем проверять email.\n\n` +
			`<a href="${API_URL}">Вернуться на сайт</a>`

		await sendMessage(chatId, successMsg)
		logger.info('[telegram] User linked successfully', { userId, chatId, firstName })
	} catch (err) {
		logger.error('[telegram] handleStartCommand error', { userId, chatId, error: err instanceof Error ? err.message : String(err) })
		await sendMessage(chatId, '⚠️ Произошла ошибка. Пожалуйста, попробуйте позже.')
	}
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
	if (!update.message || !update.message.text) return

	const { chat, from, text } = update.message
	const chatId = chat.id
	const firstName = from.first_name

	// Parse /start command with parameter: /start USER_ID
	if (text.startsWith('/start')) {
		const parts = text.split(' ')
		const userId = parts[1] || ''

		if (!userId) {
			await sendMessage(chatId, `👋 Привет! Похоже, вы открыли бота напрямую.\n\nПожалуйста, <a href="https://t.me/${BOT_USERNAME}?start=YOUR_USER_ID">перейдите по ссылке на сайте</a>, чтобы подключить Telegram.`)
			return
		}

		// Validate userId format (MongoDB ObjectId)
		if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
			await sendMessage(chatId, '❌ Некорректная ссылка. Пожалуйста, используйте ссылку с сайта Games of Senses.')
			return
		}

		await handleStartCommand(userId, chatId, firstName)
	} else {
		// Any other message
		await sendMessage(chatId, `Я просто уведомляю вас о кодах игр. 🎮\n\nДругие команды пока недоступны.`)
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

/**
 * Send game code to user via Telegram
 */
export async function sendGameCodeToTelegram(
	telegramChatId: string,
	gameCode: string,
	gameName: string,
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false

	const message = `🎮 <b>Код вашей игры:</b>\n\n<code>${gameCode}</code>\n\n<b>${gameName}</b>`
	const chatId = parseInt(telegramChatId, 10)
	return sendMessage(chatId, message)
}

/**
 * Send reminder notification to user
 */
export async function sendGameReminderToTelegram(
	telegramChatId: string,
	gameName: string,
	minutesUntil: number,
): Promise<boolean> {
	if (!BOT_TOKEN || !telegramChatId) return false

	const message = `⏰ <b>Напоминание!</b>\n\nИгра <b>${gameName}</b> начнётся через <b>${minutesUntil} минут</b>. 🎮`
	const chatId = parseInt(telegramChatId, 10)
	return sendMessage(chatId, message)
}
