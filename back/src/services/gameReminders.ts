import { Game } from '../models/Game'
import { User } from '../models/User'
import { sendGameStartReminder } from './email'
import { sendGameReminderToTelegram } from './telegramBot'
import logger from '../config/logger'

export async function sendGameStartReminders(): Promise<void> {
	try {
		const now = new Date()
		const in30min = new Date(now.getTime() + 30 * 60 * 1000)
		const in35min = new Date(now.getTime() + 35 * 60 * 1000)

		const gamesToNotify = await Game.find({
			scheduledAt: { $gte: in30min, $lte: in35min },
			reminderSent: false,
		})

		for (const game of gamesToNotify) {
			try {
				await sendRemindersForGame(game)
			} catch (err) {
				logger.error(`Failed to send reminders for game ${game._id}`, err)
			}
		}
	} catch (err) {
		logger.error('Game reminder cron error', err)
	}
}

async function sendRemindersForGame(game: any): Promise<void> {
	const participants = new Set<string>()
	const emailData: Array<{ email: string; name: string; userId: string }> = []

	// Format game time for display
	const gameTime = game.scheduledAt ? new Date(game.scheduledAt).toLocaleString('uk-UA', {
		hour: '2-digit',
		minute: '2-digit',
		day: 'numeric',
		month: 'long',
	}) : 'N/A'

	// Add GM
	const gm = await User.findById(game.creatorId)
	if (gm) {
		const key = String(gm._id)
		if (!participants.has(key)) {
			participants.add(key)
			emailData.push({ email: gm.email, name: gm.name || gm.email, userId: String(gm._id) })
		}
	}

	// Add registered players
	for (const player of game.registeredPlayers) {
		const key = String(player.userId)
		if (!participants.has(key)) {
			participants.add(key)
			const user = await User.findById(player.userId)
			if (user) {
				emailData.push({ email: user.email, name: user.name || user.email, userId: String(user._id) })
			}
		}
	}

	// Add spectators
	for (const spectator of game.spectators) {
		const key = String(spectator.userId)
		if (!participants.has(key)) {
			participants.add(key)
			const user = await User.findById(spectator.userId)
			if (user) {
				emailData.push({ email: user.email, name: user.name || user.email, userId: String(user._id) })
			}
		}
	}

	// Send reminders to all (both email and Telegram)
	const reminderPromises = emailData.map(async participant => {
		try {
			// Send email reminder
			await sendGameStartReminder(participant.email, participant.name, {
				title: game.title,
				gameCode: game.gameCode,
				scheduledAt: game.scheduledAt,
			})

			// Also send Telegram reminder if user has Telegram connected
			const user = await User.findById(participant.userId)
			if (user?.telegramChatId) {
				const minutesUntil = Math.round((game.scheduledAt.getTime() - Date.now()) / 60000)
				await sendGameReminderToTelegram(
					user.telegramChatId,
					game.title,
					Math.max(minutesUntil, 1),
					gameTime,
					user.language || 'uk'
				)
			}
		} catch (err) {
			logger.error(`Failed to send reminder to ${participant.email}`, err)
		}
	})

	await Promise.all(reminderPromises)

	// Mark as sent
	game.reminderSent = true
	await game.save()

	logger.info(`Sent game start reminders for game ${game._id} to ${emailData.length} participants`)
}
