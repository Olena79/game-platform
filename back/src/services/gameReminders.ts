import logger from '../config/logger'
import { Game } from '../models/Game'
import { User } from '../models/User'
import { langOf, reminderText, sendTelegramHtml } from './telegramBot'

export const REMINDER_LEAD_MS = 10 * 60 * 1000

let running = false

/**
 * "The game starts in 10 minutes" to everyone registered for it — players,
 * spectators, and the gamemaster — who linked Telegram. Runs every minute.
 *
 * A game is claimed (reminderSentAt) before anything is sent, so a slow run
 * and the next tick cannot both remind. Changing the game's time clears the
 * mark (routes/games.ts), so the new time gets its own reminder. A game
 * created less than ten minutes ahead is reminded straight away.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
	if (running) return 0
	running = true
	let sent = 0
	try {
		const due = await Game.find({
			scheduledAt: { $gt: now, $lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
			reminderSentAt: null,
		}).select('title scheduledAt gameCode spectatorCode creatorId registeredPlayers.userId spectators.userId')

		for (const game of due) {
			const claimed = await Game.updateOne({ _id: game._id, reminderSentAt: null }, { $set: { reminderSentAt: now } })
			if (!claimed.modifiedCount) continue

			const minutes = Math.round((game.scheduledAt!.getTime() - now.getTime()) / 60000)
			const seats = new Map<string, { role: 'player' | 'spectator' | 'gamemaster'; code: string }>()
			for (const s of game.spectators) seats.set(String(s.userId), { role: 'spectator', code: game.spectatorCode })
			for (const p of game.registeredPlayers) seats.set(String(p.userId), { role: 'player', code: game.gameCode })
			seats.set(String(game.creatorId), { role: 'gamemaster', code: game.gameCode })

			const people = await User.find({
				_id: { $in: [...seats.keys()] },
				telegramChatId: { $exists: true, $nin: [null, ''] },
				blockedAt: null,
			}).select('telegramChatId language').lean()

			for (const person of people) {
				const seat = seats.get(String(person._id))!
				const res = await sendTelegramHtml(String(person.telegramChatId), reminderText({ title: game.title, minutes, role: seat.role, code: seat.code }, langOf(person.language)))
				if (res.ok) sent++
			}
			logger.info('[reminders] game reminder sent', { gameId: String(game._id), recipients: people.length })
		}
	} catch (err) {
		logger.error('[reminders] failed', { error: err instanceof Error ? err.message : String(err) })
	} finally {
		running = false
	}
	return sent
}
