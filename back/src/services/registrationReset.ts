import logger from '../config/logger'
import { Game } from '../models/Game'

/** A day after its time, a game's registrations belonged to a night that is over */
export const RESET_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Empties the lists of registered players and spectators (and the closed
 * accesses, which show only in that list) of every game whose time was more
 * than a day ago, so the gamemaster can give it a new date and people sign
 * up afresh (decided 2026-10-03). Nobody is told. Runs from a cron; never
 * throws.
 */
export async function clearPlayedRegistrations(now = new Date()): Promise<number> {
	try {
		const res = await Game.updateMany(
			{
				scheduledAt: { $lt: new Date(now.getTime() - RESET_AFTER_MS) },
				$or: [
					{ 'registeredPlayers.0': { $exists: true } },
					{ 'spectators.0': { $exists: true } },
					{ 'accessBlockedUserIds.0': { $exists: true } },
				],
			},
			{ $set: { registeredPlayers: [], spectators: [], accessBlockedUserIds: [] } },
		)
		if (res.modifiedCount) logger.info('[games] registrations of played games cleared', { games: res.modifiedCount })
		return res.modifiedCount
	} catch (err) {
		logger.error('[games] clearing played registrations failed', { error: err instanceof Error ? err.message : String(err) })
		return 0
	}
}
