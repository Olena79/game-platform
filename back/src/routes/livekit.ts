import logger from '../config/logger'
import { Router, Response } from 'express'
import { AccessToken } from 'livekit-server-sdk'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { livekitTokenSchema } from '../validation/schemas'
import { Game } from '../models/Game'

const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
const LIVEKIT_URL        = process.env.LIVEKIT_URL

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	throw new Error('FATAL: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set.')
}

const router = Router()

type Membership = { game: { gameCode: string }; isCreator: boolean; isSpectator: boolean } | null

/**
 * Who is this person in this game?
 *
 * The room name used to come straight from the request body, so any logged-in
 * user could mint a token for any game and walk into a private session — with
 * a microphone and camera, or silently through the observer endpoint.
 */
async function resolveMembership(gameCode: string, userId: string): Promise<Membership> {
	const game = await Game.findOne({ gameCode }).select('gameCode creatorId registeredPlayers spectators')
	if (!game) return null

	const uid = String(userId)
	const isCreator = String(game.creatorId) === uid
	const isPlayer = game.registeredPlayers.some(p => String(p.userId) === uid)
	const isSpectator = game.spectators.some(p => String(p.userId) === uid)
	if (!isCreator && !isPlayer && !isSpectator) return null

	return { game: { gameCode: game.gameCode }, isCreator, isSpectator: isSpectator && !isCreator && !isPlayer }
}

/** Only the server decides what a room is called. */
function roomNameFor(gameCode: string, breakoutId?: string): string {
	return breakoutId ? `mindflow-${gameCode}-${breakoutId}` : `mindflow-${gameCode}`
}

router.post('/token', authMiddleware, validateBody(livekitTokenSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { gameCode, breakoutId, userName } = req.body

		const membership = await resolveMembership(gameCode, String(req.userId))
		if (!membership) {
			logger.warn('[livekit/token] refused', { gameCode, userId: req.userId })
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const roomName = roomNameFor(membership.game.gameCode, breakoutId)
		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: String(req.userId), name: userName, ttl: '8h' },
		)

		at.addGrant({
			room: roomName,
			roomJoin: true,
			// Spectators watch; they have never had a reason to publish
			canPublish: !membership.isSpectator,
			canSubscribe: true,
		})

		const token = await at.toJwt()
		res.json({ token, url: LIVEKIT_URL })
	} catch (err: any) {
		logger.error('[livekit/token] Error:', { error: err.message })
		res.status(500).json({ message: 'Token generation failed' })
	}
})

// The observer window records the session, so it is the gamemaster's alone.
router.post('/observer-token', authMiddleware, validateBody(livekitTokenSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { gameCode } = req.body

		const membership = await resolveMembership(gameCode, String(req.userId))
		if (!membership?.isCreator) {
			logger.warn('[livekit/observer-token] refused', { gameCode, userId: req.userId })
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: `observer-${req.userId}`, name: 'Observer', ttl: '8h' },
		)
		at.addGrant({ room: roomNameFor(membership.game.gameCode), roomJoin: true, canPublish: false, canSubscribe: true })

		const token = await at.toJwt()
		res.json({ token, url: LIVEKIT_URL })
	} catch (err: any) {
		logger.error('[livekit/observer-token]', err)
		res.status(500).json({ message: 'Token generation failed' })
	}
})

export default router
