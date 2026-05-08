import { Router, Response } from 'express'
import { AccessToken } from 'livekit-server-sdk'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()

router.post('/token', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { roomName, participantName } = req.body
		if (!roomName || !participantName) {
			res.status(400).json({ message: 'Missing roomName or participantName' })
			return
		}

		const at = new AccessToken(
			process.env.LIVEKIT_API_KEY!,
			process.env.LIVEKIT_API_SECRET!,
			{ identity: String(req.userId), name: participantName },
		)

		at.addGrant({
			room: roomName,
			roomJoin: true,
			canPublish: true,
			canSubscribe: true,
		})

		const token = await at.toJwt()
		res.json({ token, url: process.env.LIVEKIT_URL })
	} catch {
		res.status(500).json({ message: 'Token generation failed' })
	}
})

router.post('/observer-token', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { roomName } = req.body
		if (!roomName) { res.status(400).json({ message: 'Missing roomName' }); return }

		const at = new AccessToken(
			process.env.LIVEKIT_API_KEY!,
			process.env.LIVEKIT_API_SECRET!,
			{ identity: `observer-${req.userId}`, name: 'Observer' },
		)
		at.addGrant({ room: roomName, roomJoin: true, canPublish: false, canSubscribe: true })

		const token = await at.toJwt()
		res.json({ token, url: process.env.LIVEKIT_URL })
	} catch {
		res.status(500).json({ message: 'Token generation failed' })
	}
})

export default router
