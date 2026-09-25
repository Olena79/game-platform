import { Router, Response } from 'express'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { createTelegramLinkToken } from '../services/tokenService'
import logger from '../config/logger'

const router = Router()

// GET /api/telegram/link-token
// The value the bot deep link carries: 32 url-safe characters, valid for 15
// minutes and spent on first use. It only proves who asked for it — it is
// not a session token. The chat is attached when the person presses Start
// in the bot, which is the only proof that the chat is theirs.
router.get('/link-token', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		res.json({ token: await createTelegramLinkToken(String(req.userId)) })
	} catch (err) {
		logger.error('[telegram/link-token]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/telegram/status
// Check if user has Telegram connected
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId).select('telegramChatId')

		if (!user) {
			res.status(404).json({ message: 'User not found' })
			return
		}

		res.json({
			telegramConnected: !!user.telegramChatId,
		})
	} catch (err) {
		logger.error('[telegram/status]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
