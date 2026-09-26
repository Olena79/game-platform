import logger from '../config/logger'
import { User } from '../models/User'
import { escapeHtml, formatGameDate, sendTelegramHtml, telegramEvents } from './telegramBot'

/**
 * The club's administrator: one account, named by ADMIN_EMAIL on the server.
 * Nothing in the database makes anyone an administrator, so nothing written
 * there can make someone one either.
 */
export function adminEmail(): string {
	return (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
}

export async function isAdminUser(userId: string | undefined | null): Promise<boolean> {
	const email = adminEmail()
	if (!email || !userId) return false
	const user = await User.findById(userId).select('email').lean()
	return !!user && user.email.toLowerCase() === email
}

/** The administrator's account id, if it exists (cached for a minute). */
interface AdminAccount {
	at: number
	id: string | null
	chat: string | null
	/** Their chat gets the public new-game announcement (linked, no /stop) */
	hearsAnnouncements: boolean
}
let adminCache: AdminAccount | null = null
async function adminAccount(): Promise<AdminAccount> {
	if (adminCache && Date.now() - adminCache.at < 60_000) return adminCache
	const email = adminEmail()
	const user = email ? await User.findOne({ email }).select('telegramChatId newsOptOut blockedAt').lean() : null
	adminCache = {
		at: Date.now(),
		id: user ? String(user._id) : null,
		chat: user?.telegramChatId || null,
		hearsAnnouncements: !!user?.telegramChatId && !user.newsOptOut && !user.blockedAt,
	}
	return adminCache
}

export function forgetAdminCache(): void {
	adminCache = null
}

/**
 * A message to the administrator's Telegram. Never throws and never delays
 * whatever it reports on; with no administrator or no Telegram it is dropped.
 */
export async function notifyAdmin(html: string): Promise<boolean> {
	try {
		const { chat } = await adminAccount()
		if (!chat) return false
		const res = await sendTelegramHtml(chat, html)
		return res.ok
	} catch (err) {
		logger.warn('[admin] notice not delivered', { error: err instanceof Error ? err.message : String(err) })
		return false
	}
}

async function isAdminId(userId: string): Promise<boolean> {
	const { id } = await adminAccount().catch(() => ({ id: null }))
	return !!id && id === String(userId)
}

function personName(u: { name?: string; surname?: string; email?: string }): string {
	return [u.name, u.surname].filter(Boolean).join(' ') || (u.email ?? '').split('@')[0] || '—'
}

function kyivNow(): string {
	return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Kyiv' }).format(new Date())
}

// ── What the administrator hears about ───────────────────────────────────────

export function noticeNewUser(user: { name?: string; surname?: string; email: string; telegramChatId?: string }, via: 'email' | 'google'): void {
	void notifyAdmin([
		'👤 <b>Новий користувач</b>',
		`${escapeHtml(personName(user))} · ${escapeHtml(user.email)}`,
		via === 'google' ? 'Реєстрація через Google' : 'Реєстрація з паролем',
		user.telegramChatId ? '📲 Telegram підключено' : '⚪ Telegram не підключено',
	].join('\n'))
}

export async function noticeTelegramLinked(userId: string): Promise<void> {
	if (await isAdminId(userId)) { forgetAdminCache(); return }
	const user = await User.findById(userId).select('name surname email').lean()
	if (!user) return
	await notifyAdmin(`📲 <b>${escapeHtml(personName(user))}</b> (${escapeHtml(user.email)}) підключив(-ла) Telegram`)
}

export async function noticeGameCreated(creatorId: string, game: { title: string; scheduledAt?: Date | null }): Promise<void> {
	if (await isAdminId(creatorId)) return
	// The announcement already names the game and its gamemaster: a second
	// message about the same game only when the administrator turned
	// announcements off (/stop)
	if ((await adminAccount().catch(() => null))?.hearsAnnouncements) return
	const user = await User.findById(creatorId).select('name surname email').lean()
	await notifyAdmin([
		'🎲 <b>Нова гра</b>',
		`${escapeHtml(personName(user ?? {}))} створив(-ла) гру «${escapeHtml(game.title)}»`,
		`📅 ${escapeHtml(formatGameDate(game.scheduledAt ?? null, 'uk'))}`,
	].join('\n'))
}

export async function noticeRecordingStarted(rec: { gmId: unknown; gameTitle: string; contentType?: string; mode: string }): Promise<void> {
	if (await isAdminId(String(rec.gmId))) return
	const gm = await User.findById(rec.gmId).select('name surname email').lean()
	await notifyAdmin([
		'🔴 <b>Почався запис гри</b>',
		`«${escapeHtml(rec.gameTitle || '—')}»`,
		`🎭 Ведучий: ${escapeHtml(personName(gm ?? {}))}`,
		(rec.contentType ?? '').startsWith('audio/') ? '🎙 Лише голос' : '🎥 Відео',
		`🕐 ${kyivNow()}`,
	].join('\n'))
}

export async function noticeRecordingEnded(rec: { gmId: unknown; gameTitle: string; shareLink?: string; interrupted?: boolean }, failed?: string): Promise<void> {
	if (await isAdminId(String(rec.gmId))) return
	const gm = await User.findById(rec.gmId).select('name surname email').lean()
	const head = failed
		? '⚠️ <b>Запис гри не вдався</b>'
		: rec.interrupted ? '🎥 <b>Запис гри збережено (перервано)</b>' : '🎥 <b>Запис гри збережено</b>'
	const link = rec.shareLink && !failed
		? `▶️ <a href="${escapeHtml(rec.shareLink).replace(/"/g, '&quot;')}">Відкрити запис</a> (7 днів)`
		: ''
	await notifyAdmin([
		head,
		`«${escapeHtml(rec.gameTitle || '—')}» · ${escapeHtml(personName(gm ?? {}))}`,
		failed ? escapeHtml(failed.slice(0, 200)) : '',
		link,
	].filter(Boolean).join('\n'))
}

telegramEvents.on('linked', ({ userId }: { userId: string }) => {
	noticeTelegramLinked(userId).catch(() => undefined)
})
