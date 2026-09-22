import { Router, Request, Response } from 'express'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { telegramLinkSchema } from '../validation/schemas'
import { generateTelegramLinkToken } from '../services/tokenService'
import logger from '../config/logger'

const router = Router()

// GET /api/telegram/link-token
// The value the deep link carries. Expires in 15 minutes and only proves who
// asked for it — it is not a session token.
router.get('/link-token', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		res.json({ token: generateTelegramLinkToken(String(req.userId)) })
	} catch (err) {
		logger.error('[telegram/link-token]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/telegram/link
// Links the caller's OWN account. It used to take a user id from the body
// with no authentication at all, which handed anyone else's game codes,
// notes and recording links to whoever asked.
router.post('/link', authMiddleware, validateBody(telegramLinkSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { telegramChatId } = req.body

		const user = await User.findByIdAndUpdate(
			req.userId,
			{ telegramChatId },
			{ new: true }
		).select('-password')

		if (!user) {
			res.status(404).json({ message: 'User not found' })
			return
		}

		logger.info('[telegram/link] Telegram linked', { userId: String(req.userId) })
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
