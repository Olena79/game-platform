import logger from '../config/logger'
import { Router, Response } from 'express'
import { AccessToken } from 'livekit-server-sdk'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { livekitTokenSchema } from '../validation/schemas'
import { User } from '../models/User'
import { canEnterBreakout } from '../socket/gameRoom'
import { resolveSeat, wasRemovedFrom } from '../services/roomAccess'
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, roomNameFor } from '../services/livekit'

const router = Router()

/**
 * A media token for the seat the presented code earns (see resolveSeat).
 *
 * The room name comes back in the response: the client never builds it, and
 * it is derived from the game's id, so neither the token nor the response
 * tells a spectator what the entry code is.
 */
router.post('/token', authMiddleware, validateBody(livekitTokenSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { code, breakoutId } = req.body
		const userId = String(req.userId)

		const seat = await resolveSeat(code, userId)
		if (!seat) {
			logger.warn('[livekit/token] refused', { userId })
			res.status(403).json({ message: (await wasRemovedFrom(code, userId)) ? 'REMOVED' : 'FORBIDDEN' })
			return
		}

		// A breakout room is a private conversation; the invitation decides
		if (breakoutId && !canEnterBreakout(seat.gameCode, breakoutId, userId)) {
			logger.warn('[livekit/token] breakout refused', { breakoutId, userId })
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		// The name everybody sees is the account's, not whatever the browser sent
		const user = await User.findById(userId).select('name surname email').lean()
		const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'User'

		const roomName = roomNameFor(seat.gameId, breakoutId)
		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: userId, name: displayName, ttl: '8h' },
		)

		at.addGrant({
			room: roomName,
			roomJoin: true,
			// Spectators watch; they have never had a reason to publish anything
			canPublish: !seat.asSpectator,
			canPublishData: !seat.asSpectator,
			canSubscribe: true,
		})

		const token = await at.toJwt()
		res.json({ token, url: LIVEKIT_URL, roomName })
	} catch (err: any) {
		logger.error('[livekit/token] Error:', { error: err.message })
		res.status(500).json({ message: 'Token generation failed' })
	}
})

export default router
