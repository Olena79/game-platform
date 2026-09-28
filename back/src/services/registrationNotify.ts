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

/** 'joined' — signed up; 'left' — cancelled their registration */
export type RegistrationChange = 'joined' | 'left'

/** The message itself, in the gamemaster's language. */
export function registrationText(
	game: RegistrationNotice,
	who: { name?: string; surname?: string },
	role: 'player' | 'spectator',
	lang: 'uk' | 'en',
	change: RegistrationChange = 'joined',
): string {
	const name = escapeHtml([who.name, who.surname].filter(Boolean).join(' ') || (lang === 'uk' ? 'Без імені' : 'No name'))
	const title = escapeHtml(game.title)
	const count = role === 'player'
		? (lang === 'uk' ? `👥 Гравців: ${game.playersCount} / ${game.maxPlayers}` : `👥 Players: ${game.playersCount} / ${game.maxPlayers}`)
		: (lang === 'uk' ? `👀 Глядачів: ${game.spectatorsCount}` : `👀 Spectators: ${game.spectatorsCount}`)
	const head = {
		uk: {
			joined: { player: '🎟 <b>Новий гравець на вашу гру</b>', spectator: '👀 <b>Новий глядач на вашу гру</b>' },
			left:   { player: '🚪 <b>Гравець скасував реєстрацію</b>', spectator: '🚪 <b>Глядач скасував реєстрацію</b>' },
		},
		en: {
			joined: { player: '🎟 <b>New player for your game</b>', spectator: '👀 <b>New spectator for your game</b>' },
			left:   { player: '🚪 <b>A player cancelled their registration</b>', spectator: '🚪 <b>A spectator cancelled their registration</b>' },
		},
	}[lang][change][role]
	return `${head}\n«${title}»\n👤 ${name}\n${count}`
}

/**
 * Tells the gamemaster in Telegram that someone signed up for their game,
 * or cancelled.
 *
 * Called after the registration has been saved and answered: it can only
 * fail on its own, never undo or delay a registration. A gamemaster without
 * Telegram simply hears nothing, as before.
 */
export async function notifyGmOfRegistration(
	game: RegistrationNotice,
	who: { name?: string; surname?: string },
	role: 'player' | 'spectator',
	change: RegistrationChange = 'joined',
): Promise<void> {
	try {
		const gm = await User.findById(game.creatorId).select('telegramChatId language').lean()
		if (!gm?.telegramChatId) return
		const lang = gm.language === 'en' ? 'en' : 'uk'
		await sendTelegramHtml(String(gm.telegramChatId), registrationText(game, who, role, lang, change))
	} catch (err) {
		logger.warn('[telegram] registration notice not sent', { error: err instanceof Error ? err.message : String(err) })
	}
}
