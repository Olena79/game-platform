import { EventEmitter } from 'events'
import logger from '../config/logger'
import { consumeTelegramLinkToken } from './tokenService'
import { User } from '../models/User'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'gamesofsenses_bot'
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

/** 'linked' { userId }: a member has just connected their Telegram */
export const telegramEvents = new EventEmitter()

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

export interface TelegramResult {
	ok: boolean
	/** The person blocked the bot or deleted their account: nothing will ever reach them */
	unreachable: boolean
}

/**
 * One Bot API call, with a single retry when Telegram asks us to slow down
 * (about one message a second per chat, thirty a second overall).
 */
async function callTelegram(method: string, payload: Record<string, unknown>, attempt = 0): Promise<TelegramResult> {
	try {
		const response = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/${method}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await response.json()
		if (data.ok) return { ok: true, unreachable: false }

		const retryAfter = data.parameters?.retry_after
		if (retryAfter && attempt === 0) {
			logger.warn('[telegram] rate limited, retrying', { method, retryAfter })
			await sleep((retryAfter + 1) * 1000)
			return callTelegram(method, payload, attempt + 1)
		}
		const unreachable = data.error_code === 403 || /chat not found|user is deactivated/i.test(String(data.description ?? ''))
		logger.error(`[telegram] ${method} failed`, { chatId: payload.chat_id, error: data.description })
		return { ok: false, unreachable }
	} catch (err) {
		logger.error(`[telegram] ${method} error`, { chatId: payload.chat_id, error: err instanceof Error ? err.message : String(err) })
		return { ok: false, unreachable: false }
	}
}

async function sendMessage(chatId: number, text: string): Promise<boolean> {
	const res = await callTelegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
	return res.ok
}

type Lang = 'uk' | 'en'

/**
 * One message (HTML) to one chat. For the rest of the server: the
 * administrator's notices, reminders. Says whether the chat is gone for good.
 */
export async function sendTelegramHtml(telegramChatId: string, text: string): Promise<TelegramResult> {
	if (!BOT_TOKEN) return { ok: false, unreachable: false }
	const chatId = parseInt(String(telegramChatId), 10)
	if (!Number.isFinite(chatId)) return { ok: false, unreachable: false }
	return callTelegram('sendMessage', { chat_id: chatId, text: text.slice(0, 4096), parse_mode: 'HTML', disable_web_page_preview: true })
}

function langOf(value: string | undefined | null): Lang {
	return value === 'en' ? 'en' : value === 'uk' ? 'uk' : ((process.env.DEFAULT_LANGUAGE === 'en' ? 'en' : 'uk'))
}

function siteUrl(): string {
	return (process.env.CLIENT_URL?.split(',')[0] ?? '').trim().replace(/\/$/, '')
}

/**
 * What the bot says. It is not there to talk: it carries news — new games,
 * entry codes, a gamemaster's notes and recordings, reset links — and every
 * message says so, so nobody waits for an answer that will not come.
 */
const messages = {
	uk: {
		welcome: () =>
			`👋 <b>Вітаю! Я бот клубу «Ігри Сенсів».</b>\n\n` +
			`Я не веду розмов — я надсилаю новини:\n` +
			`🎲 анонси нових ігор на платформі;\n` +
			`🔑 коди для входу в гру — щойно ви зареєструєтесь гравцем чи глядачем;\n` +
			`⏰ нагадування за 10 хвилин до початку гри;\n` +
			`📝 ведучим — нотатки після гри та посилання на запис;\n` +
			`🔐 посилання для відновлення пароля.\n\n` +
			`Щоб усе це приходило сюди, підключіть Telegram у своєму акаунті на сайті` +
			(siteUrl() ? `: ${siteUrl()}/account` : '.') +
			`\n\nНе хочете анонсів нових ігор? Надішліть /stop — коди й особисті повідомлення все одно приходитимуть. Повернути анонси — /news.`,
		linked: (firstName: string) =>
			`✅ <b>Telegram підключено!</b>\n\n` +
			`Привіт, <b>${escapeHtml(firstName)}</b>! 👋\n\n` +
			`Тепер сюди приходитимуть:\n` +
			`🎲 анонси нових ігор;\n` +
			`🔑 коди входу в ігри, на які ви зареєструвались (гравцем чи глядачем);\n` +
			`⏰ нагадування за 10 хвилин до початку гри;\n` +
			`📝 якщо ви ведете гру — нотатки й посилання на запис;\n` +
			`🔐 посилання для відновлення пароля.\n\n` +
			`Відповідати мені не потрібно — я лише надсилаю новини. Не хочете анонсів? /stop`,
		alreadyLinked: '✅ Ваш Telegram уже підключено до акаунта — новини приходитимуть сюди.\n\nНе хочете анонсів нових ігор? /stop · Повернути — /news',
		invalidLink: '❌ Посилання застаріло або вже використане. Відкрийте нове в розділі «Акаунт» на сайті — воно діє 15 хвилин.',
		notTalking: '🤖 Я не відповідаю на повідомлення — я лише надсилаю новини клубу: анонси ігор, коди входу, нотатки й записи.\n\n/stop — вимкнути анонси нових ігор\n/news — увімкнути їх знову',
		notLinked: 'Цей чат ще не підключено до акаунта. Підключіть Telegram у своєму акаунті на сайті' + (siteUrl() ? `: ${siteUrl()}/account` : '.'),
		newsOff: '🔕 Анонси нових ігор вимкнено. Коди входу, нотатки й записи приходитимуть як і раніше.\n\nУвімкнути знову — /news',
		newsOn: '🔔 Анонси нових ігор увімкнено.',
	},
	en: {
		welcome: () =>
			`👋 <b>Hi! I am the Games of Senses club bot.</b>\n\n` +
			`I don’t chat — I send news:\n` +
			`🎲 announcements of new games on the platform;\n` +
			`🔑 entry codes — as soon as you register as a player or a spectator;\n` +
			`⏰ a reminder 10 minutes before the game starts;\n` +
			`📝 for gamemasters — notes after a game and recording links;\n` +
			`🔐 password reset links.\n\n` +
			`To get all this here, connect Telegram in your account on the website` +
			(siteUrl() ? `: ${siteUrl()}/account` : '.') +
			`\n\nDon’t want new-game announcements? Send /stop — codes and personal messages still arrive. Turn them back on with /news.`,
		linked: (firstName: string) =>
			`✅ <b>Telegram connected!</b>\n\n` +
			`Hi, <b>${escapeHtml(firstName)}</b>! 👋\n\n` +
			`From now on you will get here:\n` +
			`🎲 announcements of new games;\n` +
			`🔑 entry codes for games you register for (as a player or spectator);\n` +
			`⏰ a reminder 10 minutes before the game starts;\n` +
			`📝 if you run a game — notes and the recording link;\n` +
			`🔐 password reset links.\n\n` +
			`No need to reply — I only send news. Don’t want announcements? /stop`,
		alreadyLinked: '✅ Your Telegram is already connected — news will arrive here.\n\nDon’t want new-game announcements? /stop · Back on — /news',
		invalidLink: '❌ This link has expired or was already used. Open a new one under “Account” on the website — it works for 15 minutes.',
		notTalking: '🤖 I don’t answer messages — I only send the club’s news: game announcements, entry codes, notes and recordings.\n\n/stop — turn off new-game announcements\n/news — turn them back on',
		notLinked: 'This chat is not connected to an account yet. Connect Telegram in your account on the website' + (siteUrl() ? `: ${siteUrl()}/account` : '.'),
		newsOff: '🔕 New-game announcements are off. Entry codes, notes and recordings still arrive.\n\nTurn them back on — /news',
		newsOn: '🔔 New-game announcements are on.',
	},
}

async function handleStartCommand(userId: string, chatId: number, firstName: string): Promise<void> {
	try {
		const user = await User.findByIdAndUpdate(
			userId,
			{ telegramChatId: String(chatId) },
			{ new: false }
		)
		const previousChat = user?.telegramChatId
		if (user) user.telegramChatId = String(chatId)

		if (!user) {
			await sendMessage(chatId, messages[langOf(null)].invalidLink)
			logger.warn('[telegram] Start command for non-existent user', { userId })
			return
		}

		const lang = langOf(user.language)
		await sendMessage(chatId, messages[lang].linked(firstName))
		logger.info('[telegram] User linked successfully', { userId, language: lang })

		// The account moved to another Telegram: its old chat hears about it,
		// so a takeover (codes, reset links now going elsewhere) is not silent
		if (previousChat && previousChat !== String(chatId)) {
			await sendTelegramHtml(previousChat, lang === 'uk'
				? '⚠️ <b>Ваш акаунт на сайті клубу щойно підключено до іншого Telegram.</b>\nНадалі повідомлення приходитимуть туди. Якщо це були не ви — одразу змініть пароль акаунта.'
				: '⚠️ <b>Your club account has just been connected to another Telegram.</b>\nMessages will go there from now on. If this was not you, change your account password at once.')
			logger.warn('[telegram] account moved to another chat', { userId })
		}
		telegramEvents.emit('linked', { userId })
	} catch (err) {
		const lang = langOf(null)
		logger.error('[telegram] handleStartCommand error', { userId, error: err instanceof Error ? err.message : String(err) })
		await sendMessage(chatId, `⚠️ ${lang === 'uk' ? 'Сталась помилка. Спробуйте пізніше.' : 'An error occurred. Please try again later.'}`)
	}
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
	if (!update.message || !update.message.text) return

	const { chat, from, text } = update.message
	const chatId = chat.id
	const firstName = from.first_name
	// The account this chat belongs to, if any: its language and settings apply
	const account = await User.findOne({ telegramChatId: String(chatId) }).select('language newsOptOut')
	const lang = langOf(account?.language)
	const command = text.trim().split(/\s+/)[0].split('@')[0].toLowerCase()

	// /start <token>, where the token is a short-lived, single-use value the
	// website issued to the account owner. A raw id would be enough to attach
	// this chat to somebody else's account — and ids are easy to come by.
	if (command === '/start') {
		const payload = (text.trim().split(/\s+/)[1] || '').trim()

		if (!payload) {
			await sendMessage(chatId, account ? messages[lang].alreadyLinked : messages[lang].welcome())
			return
		}

		const userId = await consumeTelegramLinkToken(payload)
		if (!userId) {
			await sendMessage(chatId, messages[lang].invalidLink)
			return
		}

		await handleStartCommand(userId, chatId, firstName)
		return
	}

	if (command === '/stop' || command === '/news') {
		if (!account) {
			await sendMessage(chatId, messages[lang].notLinked)
			return
		}
		const optOut = command === '/stop'
		await User.updateOne({ _id: account._id }, { newsOptOut: optOut })
		await sendMessage(chatId, optOut ? messages[lang].newsOff : messages[lang].newsOn)
		return
	}

	if (command === '/help') {
		await sendMessage(chatId, account ? messages[lang].notTalking : messages[lang].welcome())
		return
	}

	// Anything else: say plainly that nobody reads it
	await sendMessage(chatId, messages[lang].notTalking)
}

/**
 * What people see in the bot before pressing Start, in its profile, and in
 * the command menu. Set on every start, so the texts here stay the truth.
 */
async function describeBot(): Promise<void> {
	const texts = {
		uk: {
			description: 'Бот клубу «Ігри Сенсів». Не для розмов — лише новини: анонси нових ігор, коди входу для гравців і глядачів, нотатки й записи для ведучих, посилання для відновлення пароля. Щоб підключити, натисніть «Підключити Telegram» у своєму акаунті на сайті.',
			short: 'Новини клубу «Ігри Сенсів»: анонси ігор, коди входу, нотатки й записи.',
			commands: [
				{ command: 'stop', description: 'Вимкнути анонси нових ігор' },
				{ command: 'news', description: 'Увімкнути анонси нових ігор' },
				{ command: 'help', description: 'Що вміє цей бот' },
			],
		},
		en: {
			description: 'The Games of Senses club bot. Not for chatting — news only: new game announcements, entry codes for players and spectators, notes and recordings for gamemasters, password reset links. To connect, press “Connect Telegram” in your account on the website.',
			short: 'Games of Senses club news: game announcements, entry codes, notes and recordings.',
			commands: [
				{ command: 'stop', description: 'Turn off new-game announcements' },
				{ command: 'news', description: 'Turn on new-game announcements' },
				{ command: 'help', description: 'What this bot does' },
			],
		},
	}
	const def = langOf(null)
	// No language_code: the default everyone sees; then the English variant
	await callTelegram('setMyDescription', { description: texts[def].description })
	await callTelegram('setMyShortDescription', { short_description: texts[def].short })
	await callTelegram('setMyCommands', { commands: texts[def].commands })
	const other: Lang = def === 'uk' ? 'en' : 'uk'
	const otherCode = other === 'uk' ? 'uk' : 'en'
	await callTelegram('setMyDescription', { description: texts[other].description, language_code: otherCode })
	await callTelegram('setMyShortDescription', { short_description: texts[other].short, language_code: otherCode })
	await callTelegram('setMyCommands', { commands: texts[other].commands, language_code: otherCode })
}

// ── New game announcements ──────────────────────────────────────────────────

export interface GameAnnouncement {
	title: string
	description: string
	scheduledAt?: Date | null
	participationCost?: number
	/** "Name Surname", or empty when the gamemaster gave no name */
	creatorName: string
	/** Then: the part of their email before the @ */
	creatorAlias?: string
	coverImage?: string
}

/** "25 вересня 2026, 19:00 (за Києвом)" — the club lives in Kyiv time. */
export function formatGameDate(date: Date | null | undefined, lang: Lang): string {
	if (!date || isNaN(date.getTime())) return lang === 'uk' ? 'дату буде оголошено' : 'date to be announced'
	const locale = lang === 'uk' ? 'uk-UA' : 'en-GB'
	const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Kyiv' }).format(date)
	const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Kyiv' }).format(date)
	return lang === 'uk' ? `${day}, ${time} (за Києвом)` : `${day}, ${time} (Kyiv time)`
}

/** The announcement text; the same for the photo caption and the plain message. */
export function announcementText(game: GameAnnouncement, lang: Lang): string {
	const cost = Number(game.participationCost ?? 0)
	const price = cost > 0
		? (lang === 'uk' ? `💰 Платна: ${cost} грн` : `💰 Paid: ${cost} UAH`)
		: (lang === 'uk' ? '🎁 Безкоштовна' : '🎁 Free')
	const link = siteUrl() ? `${siteUrl()}/games` : ''
	const lines = [
		lang === 'uk' ? '🎲 <b>Нова гра на платформі!</b>' : '🎲 <b>A new game on the platform!</b>',
		'',
		`<b>${escapeHtml(game.title)}</b>`,
		game.description ? `\n${escapeHtml(game.description)}\n` : '',
		`📅 ${escapeHtml(formatGameDate(game.scheduledAt, lang))}`,
		price,
		`🎭 ${lang === 'uk' ? 'Ігромастер' : 'Gamemaster'}: ${escapeHtml(game.creatorName || `${lang === 'uk' ? 'Немає імені' : 'No name'} (${game.creatorAlias ?? ''})`)}`,
		'',
		link
			? (lang === 'uk' ? `Зареєструватися: ${link}` : `Register: ${link}`)
			: '',
		lang === 'uk' ? '<i>Вимкнути анонси — /stop</i>' : '<i>Turn off announcements — /stop</i>',
	]
	return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n').trim()
}

let announcing: Promise<void> = Promise.resolve()

/**
 * Tells every linked member about a new game — except its own gamemaster and
 * anyone who sent /stop. Queued, so two games created at once do not
 * interleave, and paced under Telegram's limit. A chat that blocked the bot
 * is unlinked: it would fail forever, and the site should show it as not
 * connected.
 */
export function announceNewGame(game: GameAnnouncement & { creatorId: string }): Promise<void> {
	if (!BOT_TOKEN) return Promise.resolve()
	announcing = announcing.then(() => sendAnnouncements(game)).catch(err => {
		logger.error('[telegram] announcement failed', { error: err instanceof Error ? err.message : String(err) })
	})
	return announcing
}

async function sendAnnouncements(game: GameAnnouncement & { creatorId: string }): Promise<void> {
	const recipients = await User.find({
		telegramChatId: { $exists: true, $nin: [null, ''] },
		newsOptOut: { $ne: true },
		blockedAt: null,
		_id: { $ne: game.creatorId },
	}).select('telegramChatId language').lean()

	let sent = 0
	let unlinked = 0
	// Two accounts linked to one Telegram (a member's second account) would
	// otherwise get the announcement twice in the same chat
	const seen = new Set<number>()
	for (const r of recipients) {
		const chatId = parseInt(String(r.telegramChatId), 10)
		if (!Number.isFinite(chatId) || seen.has(chatId)) continue
		seen.add(chatId)
		const text = announcementText(game, langOf(r.language))

		// A picture when the game has one and the text fits a caption (1024)
		let res: TelegramResult | null = null
		if (game.coverImage && /^https:\/\//.test(game.coverImage) && text.length <= 1024) {
			res = await callTelegram('sendPhoto', { chat_id: chatId, photo: game.coverImage, caption: text, parse_mode: 'HTML' })
		}
		if (!res?.ok && !res?.unreachable) {
			res = await callTelegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
		}

		if (res.ok) sent++
		else if (res.unreachable) {
			await User.updateOne({ _id: r._id }, { $unset: { telegramChatId: 1 } })
			unlinked++
		}
		await sleep(60)   // ~16 a second, well under Telegram's 30
	}
	logger.info('[telegram] new game announced', { recipients: recipients.length, sent, unlinked })
}

/**
 * A message from the club to everyone who linked Telegram — /stop included:
 * /stop turns off new-game announcements, not the club's own news. Queued
 * behind announcements, paced the same way. Resolves with the counts.
 */
export function broadcastToAll(text: string): Promise<{ recipients: number; sent: number; unlinked: number }> {
	const run = announcing.then(() => sendBroadcast(text))
	announcing = run.then(() => undefined, err => {
		logger.error('[telegram] broadcast failed', { error: err instanceof Error ? err.message : String(err) })
	})
	return run
}

export function broadcastText(text: string, lang: Lang): string {
	const header = lang === 'uk' ? '📢 <b>Новини клубу «Ігри Сенсів»</b>' : '📢 <b>Games of Senses club news</b>'
	return `${header}\n\n${escapeHtml(text.trim())}`
}

async function sendBroadcast(text: string): Promise<{ recipients: number; sent: number; unlinked: number }> {
	if (!BOT_TOKEN) return { recipients: 0, sent: 0, unlinked: 0 }
	const recipients = await User.find({
		telegramChatId: { $exists: true, $nin: [null, ''] },
		blockedAt: null,
	}).select('telegramChatId language').lean()

	let sent = 0
	let unlinked = 0
	const seen = new Set<string>()   // one message per chat, as above
	for (const r of recipients) {
		const chat = String(r.telegramChatId)
		if (seen.has(chat)) continue
		seen.add(chat)
		const res = await sendTelegramHtml(chat, broadcastText(text, langOf(r.language)))
		if (res.ok) sent++
		else if (res.unreachable) {
			await User.updateOne({ _id: r._id }, { $unset: { telegramChatId: 1 } })
			unlinked++
		}
		await sleep(60)
	}
	logger.info('[telegram] broadcast sent', { recipients: recipients.length, sent, unlinked })
	return { recipients: recipients.length, sent, unlinked }
}

/** "Your game starts in 10 minutes", with the way in. */
export function reminderText(opts: {
	title: string
	minutes: number
	role: 'player' | 'spectator' | 'gamemaster'
	code: string
}, lang: Lang): string {
	const link = siteUrl() ? `${siteUrl()}/room/${opts.code}` : ''
	const m = Math.max(1, opts.minutes)
	if (lang === 'en') {
		return [
			`⏰ <b>In ${m} min the game starts</b>`,
			`<b>${escapeHtml(opts.title)}</b>`,
			'',
			opts.role === 'gamemaster' ? '🎭 You are the gamemaster.' : opts.role === 'spectator' ? `👁 Spectator code: <code>${opts.code}</code>` : `🎮 Game code: <code>${opts.code}</code>`,
			link ? `Enter: ${link}` : '',
		].filter(Boolean).join('\n')
	}
	return [
		`⏰ <b>Через ${m} хв починається гра</b>`,
		`<b>${escapeHtml(opts.title)}</b>`,
		'',
		opts.role === 'gamemaster' ? '🎭 Ви — ведучий цієї гри.' : opts.role === 'spectator' ? `👁 Код глядача: <code>${opts.code}</code>` : `🎮 Код гри: <code>${opts.code}</code>`,
		link ? `Увійти: ${link}` : '',
	].filter(Boolean).join('\n')
}

export { langOf }

/** Waits between attempts to reach Telegram at startup: 5 s, 15 s, 30 s, then every minute */
const CONNECT_RETRY_MS = [5_000, 15_000, 30_000, 60_000]
let connectAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false

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
	if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
	stopped = false

	// Test bot connectivity. A network hiccup right after a deploy ("fetch
	// failed") used to leave the bot deaf until the next deploy: no linking,
	// no commands. Now it tries again, less and less often, until it gets
	// through; only a token Telegram rejects stops it.
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
		const delay = CONNECT_RETRY_MS[Math.min(connectAttempt, CONNECT_RETRY_MS.length - 1)]
		connectAttempt++
		logger.warn(`[telegram] Could not reach Telegram, retrying in ${delay / 1000}s`, { attempt: connectAttempt, error: err instanceof Error ? err.message : String(err) })
		if (!stopped) retryTimer = setTimeout(() => { retryTimer = null; void startTelegramPolling() }, delay)
		return
	}
	connectAttempt = 0

	void describeBot()

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
	stopped = true
	if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
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
		playerCode: (code: string, name: string) => `🎮 <b>Код гри:</b> <code>${code}</code>\n\n<b>${escapeHtml(name)}</b>\n👤 Роль: Гравець`,
		spectatorCode: (code: string, name: string) => `👁️ <b>Код глядача:</b> <code>${code}</code>\n\n<b>${escapeHtml(name)}</b>`,
	},
	en: {
		playerCode: (code: string, name: string) => `🎮 <b>Game code:</b> <code>${code}</code>\n\n<b>${escapeHtml(name)}</b>\n👤 Role: Player`,
		spectatorCode: (code: string, name: string) => `👁️ <b>Spectator code:</b> <code>${code}</code>\n\n<b>${escapeHtml(name)}</b>`,
	},
}

/** Telegram rejects anything longer than this in a single message. */
const TELEGRAM_MAX_MESSAGE = 4096

/** Notes are free text typed by the GM, and the bot posts with parse_mode HTML. */
export function escapeHtml(text: string): string {
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

	// A signed storage link is full of '&', which parse_mode HTML rejects as
	// bare text — so it travels escaped, inside an anchor.
	const link = (label: string) => `<a href="${escapeHtml(shareLink).replace(/"/g, '&quot;')}">${label}</a>`

	const parts = lang === 'uk'
		? [
			'🎥 <b>Запис гри збережено</b>' + titleLine,
			'',
			'▶️ ' + link('Відкрити / завантажити запис'),
			interrupted ? '\n⚠️ Запис було перервано — збережено те, що встигло записатись.' : '',
			'\n⚠️ Запис відкриє будь-хто, кому перешлеш це посилання.\n🗓 Посилання й файл діють 7 днів.',
		]
		: [
			'🎥 <b>Recording saved</b>' + titleLine,
			'',
			'▶️ ' + link('Open / download the recording'),
			interrupted ? '\n⚠️ The recording was interrupted — whatever was recorded is kept.' : '',
			'\n⚠️ Anyone you forward this link to can open the recording.\n🗓 The link and the file last 7 days.',
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
	if (!Number.isFinite(chatId)) return false
	return sendMessage(chatId, message)
}
