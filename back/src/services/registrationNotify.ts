import logger from '../config/logger'
import { User } from '../models/User'
import { escapeHtml, sendTelegramHtml } from './telegramBot'

export interface RegistrationNotice {
	creatorId: unknown
	title: string
	maxPlayers: number
	playersCount: number
	spectatorsCount: number
}

/** The message itself, in the gamemaster's language. */
export function registrationText(
	game: RegistrationNotice,
	who: { name?: string; surname?: string },
	role: 'player' | 'spectator',
	lang: 'uk' | 'en',
): string {
	const name = escapeHtml([who.name, who.surname].filter(Boolean).join(' ') || (lang === 'uk' ? 'Без імені' : 'No name'))
	const title = escapeHtml(game.title)
	if (lang === 'en') {
		return role === 'player'
			? `🎟 <b>New player for your game</b>\n«${title}»\n👤 ${name}\n👥 Players: ${game.playersCount} / ${game.maxPlayers}`
			: `👀 <b>New spectator for your game</b>\n«${title}»\n👤 ${name}\n👀 Spectators: ${game.spectatorsCount}`
	}
	return role === 'player'
		? `🎟 <b>Новий гравець на вашу гру</b>\n«${title}»\n👤 ${name}\n👥 Гравців: ${game.playersCount} / ${game.maxPlayers}`
		: `👀 <b>Новий глядач на вашу гру</b>\n«${title}»\n👤 ${name}\n👀 Глядачів: ${game.spectatorsCount}`
}

/**
 * Tells the gamemaster in Telegram that someone signed up for their game.
 *
 * Called after the registration has been saved and answered: it can only
 * fail on its own, never undo or delay a registration. A gamemaster without
 * Telegram simply hears nothing, as before.
 */
export async function notifyGmOfRegistration(
	game: RegistrationNotice,
	who: { name?: string; surname?: string },
	role: 'player' | 'spectator',
): Promise<void> {
	try {
		const gm = await User.findById(game.creatorId).select('telegramChatId language').lean()
		if (!gm?.telegramChatId) return
		const lang = gm.language === 'en' ? 'en' : 'uk'
		await sendTelegramHtml(String(gm.telegramChatId), registrationText(game, who, role, lang))
	} catch (err) {
		logger.warn('[telegram] registration notice not sent', { error: err instanceof Error ? err.message : String(err) })
	}
}
