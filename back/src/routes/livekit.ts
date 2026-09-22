import logger from '../config/logger'
import { Router, Response } from 'express'
import { AccessToken } from 'livekit-server-sdk'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { livekitTokenSchema } from '../validation/schemas'
import { Game } from '../models/Game'
import { canEnterBreakout } from '../socket/gameRoom'

const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
const LIVEKIT_URL        = process.env.LIVEKIT_URL

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	throw new Error('FATAL: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set.')
}

const router = Router()

type Access = { game: { gameCode: string }; isCreator: boolean; asSpectator: boolean } | null

/**
 * May this person have a seat in this room, and with a voice or without?
 *
 * The code is the invitation: whoever holds it gets in, which is how the
 * gamemaster hands out a place minutes before a game. The spectator code
 * grants a silent seat. Registration on the site counts too, so a player who
 * signed up can walk in from their own list without retyping anything.
 *
 * What is gone is the old behaviour: the room name arrived in the request
 * body, so any logged-in user could mint a token for any session — with a
 * camera, or silently through the observer endpoint.
 */
async function resolveAccess(body: { code?: string; gameCode?: string }, userId: string): Promise<Access> {
	const uid = String(userId)
	const presented = (body.code ?? '').trim().toUpperCase()

	if (presented) {
		const game = await Game.findOne({ $or: [{ gameCode: presented }, { spectatorCode: presented }] })
			.select('gameCode spectatorCode creatorId')
		if (game) {
			const isCreator = String(game.creatorId) === uid
			// Which of the two codes they hold decides whether they may speak
			const asSpectator = !isCreator && game.spectatorCode === presented
			return { game: { gameCode: game.gameCode }, isCreator, asSpectator }
		}
	}

	// No code presented (or an unknown one): fall back to the participant lists
	const game = await Game.findOne({ gameCode: body.gameCode ?? presented })
		.select('gameCode creatorId registeredPlayers spectators')
	if (!game) return null

	const isCreator = String(game.creatorId) === uid
	const isPlayer = game.registeredPlayers.some(p => String(p.userId) === uid)
	const isSpectator = game.spectators.some(p => String(p.userId) === uid)
	if (!isCreator && !isPlayer && !isSpectator) return null

	return { game: { gameCode: game.gameCode }, isCreator, asSpectator: isSpectator && !isPlayer }
}

/** Only the server decides what a room is called. */
function roomNameFor(gameCode: string, breakoutId?: string): string {
	return breakoutId ? `mindflow-${gameCode}-${breakoutId}` : `mindflow-${gameCode}`
}

router.post('/token', authMiddleware, validateBody(livekitTokenSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { breakoutId, userName } = req.body

		const access = await resolveAccess(req.body, String(req.userId))
		if (!access) {
			logger.warn('[livekit/token] refused', { code: req.body.code, gameCode: req.body.gameCode, userId: req.userId })
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		// A breakout room is a private conversation; the invitation decides
		if (breakoutId && !canEnterBreakout(access.game.gameCode, breakoutId, String(req.userId))) {
			logger.warn('[livekit/token] breakout refused', { breakoutId, userId: req.userId })
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const roomName = roomNameFor(access.game.gameCode, breakoutId)
		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: String(req.userId), name: userName, ttl: '8h' },
		)

		at.addGrant({
			room: roomName,
			roomJoin: true,
			// Spectators watch; they have never had a reason to publish
			canPublish: !access.asSpectator,
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
		const access = await resolveAccess(req.body, String(req.userId))
		if (!access?.isCreator) {
			logger.warn('[livekit/observer-token] refused', { gameCode: req.body.gameCode, userId: req.userId })
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const at = new AccessToken(
			LIVEKIT_API_KEY,
			LIVEKIT_API_SECRET,
			{ identity: `observer-${req.userId}`, name: 'Observer', ttl: '8h' },
		)
		at.addGrant({ room: roomNameFor(access.game.gameCode), roomJoin: true, canPublish: false, canSubscribe: true })

		const token = await at.toJwt()
		res.json({ token, url: LIVEKIT_URL })
	} catch (err: any) {
		logger.error('[livekit/observer-token]', err)
		res.status(500).json({ message: 'Token generation failed' })
	}
})

export default router
