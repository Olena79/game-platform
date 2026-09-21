import logger from '../config/logger'
import { User } from '../models/User'
import { Game } from '../models/Game'
import { sendNotesToTelegram } from './telegramBot'

/**
 * Delivers a game's notes to its gamemaster and clears the stored draft.
 *
 * Called both when the GM ends the game properly and when they simply
 * vanish — closing the tab, hanging up, losing the connection — because the
 * notes only ever existed in that browser and are worth nothing unsent.
 *
 * Returns true when something was actually delivered.
 */
export async function deliverGameNotes(
	gameCode: string,
	notes: string,
	gamemasterId: string,
	gameTitle: string,
	reason: 'ended' | 'gm_left',
): Promise<boolean> {
	const text = notes.trim()
	if (!text) return false

	try {
		const gm = await User.findById(gamemasterId).select('telegramChatId language')
		if (!gm?.telegramChatId) {
			// Nothing we can do from here — the room warns the GM about this on
			// the way in, so the draft just stays until the game is reused.
			logger.warn('[notes] gamemaster has no Telegram linked', { gameCode, reason })
			return false
		}

		const sent = await sendNotesToTelegram(
			gm.telegramChatId,
			gameTitle,
			text,
			(gm as { language?: string }).language || 'uk',
		)
		if (!sent) {
			logger.error('[notes] delivery failed, draft kept', { gameCode, reason })
			return false
		}

		await Game.updateOne({ gameCode }, { gmNotes: '' }).catch(() => undefined)
		logger.info(`[notes] delivered to gamemaster (${reason})`, { gameCode, chars: text.length })
		return true
	} catch (err) {
		logger.error('[notes] delivery error', {
			gameCode,
			error: err instanceof Error ? err.message : String(err),
		})
		return false
	}
}
