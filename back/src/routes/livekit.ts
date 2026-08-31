import logger from '../config/logger'
import { Router, Response } from 'express'
import { AccessToken } from 'livekit-server-sdk'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { livekitTokenSchema } from '../validation/schemas'

const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
const LIVEKIT_URL        = process.env.LIVEKIT_URL

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	throw new Error('FATAL: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set.')
}

const router = Router()

router.post('/token', authMiddleware, validateBody(livekitTokenSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { roomName, userName } = req.body
		logger.info('[livekit/token] Request received', { roomName, userName, userId: req.userId })

		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: String(req.userId), name: userName },
		)

		at.addGrant({
			room: roomName,
			roomJoin: true,
			canPublish: true,
			canSubscribe: true,
		})

		const token = await at.toJwt()
		logger.info('[livekit/token] Token generated successfully', { roomName, userId: req.userId })
		res.json({ token, url: LIVEKIT_URL })
	} catch (err: any) {
		logger.error('[livekit/token] Error:', { error: err.message, stack: err.stack })
		res.status(500).json({ message: 'Token generation failed' })
	}
})

router.post('/observer-token', authMiddleware, validateBody(livekitTokenSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { roomName } = req.body

		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: `observer-${req.userId}`, name: 'Observer' },
		)
		at.addGrant({ room: roomName, roomJoin: true, canPublish: false, canSubscribe: true })

		const token = await at.toJwt()
		res.json({ token, url: LIVEKIT_URL })
	} catch (err: any) {
		logger.error('[livekit/observer-token]', err)
		res.status(500).json({ message: 'Token generation failed' })
	}
})

export default router
