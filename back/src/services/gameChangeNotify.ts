import logger from '../config/logger'
import { User } from '../models/User'
import { escapeHtml, formatGameDate, langOf, sendTelegramHtml, siteUrl } from './telegramBot'

type Lang = 'uk' | 'en'

export interface GameForNotice {
	_id: unknown
	title: string
	scheduledAt?: Date | null
	creatorId: unknown
	registeredPlayers: Array<{ userId: unknown }>
	spectators: Array<{ userId: unknown }>
	gameCode?: string
	spectatorCode?: string
}

type Seat = 'player' | 'spectator' | 'gamemaster'

/** A game that took place more than this long ago is history: no cancel notice */
const PAST_GAME_MS = 6 * 60 * 60 * 1000

export function rescheduledText(title: string, before: Date | null, after: Date | null, lang: Lang, code?: string, seat?: Seat): string {
	// The time changed, so did the codes: each person gets their own new one
	const link = code && siteUrl() ? `${siteUrl()}/room/${code}` : ''
	const codeLine = !code || seat === 'gamemaster' ? ''
		: lang === 'en'
			? (seat === 'spectator' ? `👁 New spectator code: <code>${code}</code>` : `🎮 New game code: <code>${code}</code>`)
			: (seat === 'spectator' ? `👁 Новий код глядача: <code>${code}</code>` : `🎮 Новий код гри: <code>${code}</code>`)
	const opens = lang === 'en'
		? 'The room opens 10 minutes before the start; the old codes no longer work.'
		: 'Кімната відкриється за 10 хвилин до початку; старі коди більше не діють.'
	return (lang === 'en'
		? [`📅 <b>The game has been moved</b>`, `<b>${escapeHtml(title)}</b>`, '', `Was: ${escapeHtml(formatGameDate(before, lang))}`, `Now: <b>${escapeHtml(formatGameDate(after, lang))}</b>`]
		: [`📅 <b>Гру перенесено</b>`, `<b>${escapeHtml(title)}</b>`, '', `Було: ${escapeHtml(formatGameDate(before, lang))}`, `Тепер: <b>${escapeHtml(formatGameDate(after, lang))}</b>`]
	).concat(codeLine ? ['', codeLine, opens] : [], link && seat !== 'gamemaster' ? [lang === 'en' ? `Enter: ${link}` : `Увійти: ${link}`] : []).join('\n')
}

export function cancelledText(title: string, when: Date | null, lang: Lang): string {
	return lang === 'en'
		? [`❌ <b>The game has been cancelled</b>`, `<b>${escapeHtml(title)}</b>`, `📅 ${escapeHtml(formatGameDate(when, lang))}`, '', 'Your registration is void. Look out for new games on the site.'].join('\n')
		: [`❌ <b>Гру скасовано</b>`, `<b>${escapeHtml(title)}</b>`, `📅 ${escapeHtml(formatGameDate(when, lang))}`, '', 'Вашу реєстрацію анульовано. Слідкуйте за новими іграми на сайті.'].join('\n')
}

/**
 * One message to everyone registered for the game (players and spectators,
 * and the gamemaster when someone else made the change), once per Telegram
 * chat. Never throws: it runs after the change is saved and answered.
 */
async function tellParticipants(game: GameForNotice, text: (lang: Lang, seat: Seat) => string, includeGm: boolean): Promise<number> {
	try {
		const ids = new Set<string>([
			...game.registeredPlayers.map(p => String(p.userId)),
			...game.spectators.map(s => String(s.userId)),
		])
		if (includeGm) ids.add(String(game.creatorId))
		else ids.delete(String(game.creatorId))
		if (ids.size === 0) return 0

		const people = await User.find({
			_id: { $in: [...ids] },
			telegramChatId: { $exists: true, $nin: [null, ''] },
			blockedAt: null,
		}).select('telegramChatId language').lean()

		const seen = new Set<string>()
		let sent = 0
		for (const person of people) {
			const chat = String(person.telegramChatId)
			if (seen.has(chat)) continue
			seen.add(chat)
			const id = String(person._id)
			const seat: Seat = String(game.creatorId) === id ? 'gamemaster'
				: game.registeredPlayers.some(p => String(p.userId) === id) ? 'player' : 'spectator'
			const res = await sendTelegramHtml(chat, text(langOf(person.language), seat))
			if (res.ok) sent++
		}
		logger.info('[telegram] game change told', { gameId: String(game._id), recipients: people.length, sent })
		return sent
	} catch (err) {
		logger.warn('[telegram] game change notice not sent', { error: err instanceof Error ? err.message : String(err) })
		return 0
	}
}

/** The date or time of a game changed: everyone registered hears the new one. */
export function notifyGameRescheduled(game: GameForNotice, before: Date | null): Promise<number> {
	const after = game.scheduledAt ?? null
	if ((before?.getTime() ?? null) === (after?.getTime() ?? null)) return Promise.resolve(0)
	return tellParticipants(game, (lang, seat) => rescheduledText(game.title, before, after, lang,
		seat === 'spectator' ? game.spectatorCode : game.gameCode, seat), false)
}

/**
 * A game was deleted: everyone registered hears it is cancelled. A game
 * that already took place is not "cancelled" — nobody is told. The
 * gamemaster is told too when it was not them (the administrator).
 */
export function notifyGameCancelled(game: GameForNotice, opts: { byGamemaster: boolean }, now = new Date()): Promise<number> {
	const when = game.scheduledAt ?? null
	if (when && when.getTime() < now.getTime() - PAST_GAME_MS) return Promise.resolve(0)
	return tellParticipants(game, lang => cancelledText(game.title, when, lang), !opts.byGamemaster)
}
