import logger from '../config/logger'
import { User } from '../models/User'
import { escapeHtml, formatGameDate, langOf, sendTelegramHtml } from './telegramBot'

type Lang = 'uk' | 'en'

export interface GameForNotice {
	_id: unknown
	title: string
	scheduledAt?: Date | null
	creatorId: unknown
	registeredPlayers: Array<{ userId: unknown }>
	spectators: Array<{ userId: unknown }>
}

/** A game that took place more than this long ago is history: no cancel notice */
const PAST_GAME_MS = 6 * 60 * 60 * 1000

export function rescheduledText(title: string, before: Date | null, after: Date | null, lang: Lang): string {
	return lang === 'en'
		? [`📅 <b>The game has been moved</b>`, `<b>${escapeHtml(title)}</b>`, '', `Was: ${escapeHtml(formatGameDate(before, lang))}`, `Now: <b>${escapeHtml(formatGameDate(after, lang))}</b>`].join('\n')
		: [`📅 <b>Гру перенесено</b>`, `<b>${escapeHtml(title)}</b>`, '', `Було: ${escapeHtml(formatGameDate(before, lang))}`, `Тепер: <b>${escapeHtml(formatGameDate(after, lang))}</b>`].join('\n')
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
async function tellParticipants(game: GameForNotice, text: (lang: Lang) => string, includeGm: boolean): Promise<number> {
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
			const res = await sendTelegramHtml(chat, text(langOf(person.language)))
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
	return tellParticipants(game, lang => rescheduledText(game.title, before, after, lang), false)
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
