import { Router, Request, Response } from 'express'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { telegramLinkSchema } from '../validation/schemas'
import logger from '../config/logger'

const router = Router()

// POST /api/telegram/link
// Called by Telegram bot when user clicks /start USER_ID
router.post('/link', validateBody(telegramLinkSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const { userId, telegramChatId } = req.body

		const user = await User.findByIdAndUpdate(
			userId,
			{ telegramChatId },
			{ new: true }
		).select('-password')

		if (!user) {
			res.status(404).json({ message: 'User not found' })
			return
		}

		logger.info('[telegram/link] Telegram linked', { userId, telegramChatId })
		res.json({
			message: 'Telegram linked successfully',
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				surname: user.surname,
				telegramConnected: !!user.telegramChatId,
			},
		})
	} catch (err) {
		logger.error('[telegram/link]', err)
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
