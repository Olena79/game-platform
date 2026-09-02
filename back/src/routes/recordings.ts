import logger from '../config/logger'
import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { Recording } from '../models/Recording'
import { User } from '../models/User'
import { uploadStreamToDrive, makeFilePublic } from '../services/googleDrive'
import { validateBody, validateParams } from '../middleware/validationMiddleware'
import { recordingIdSchema } from '../validation/schemas'
import { z } from 'zod'

const initiateRecordingSchema = z.object({
	gameCode: z.string().min(1, 'Game code is required'),
	gameTitle: z.string().optional(),
})

const router = Router()

router.post('/initiate', authMiddleware, validateBody(initiateRecordingSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { gameCode, gameTitle } = req.body

		const user = await User.findById(req.userId)
		if (!user) { res.status(401).json({ message: 'Unauthorized' }); return }

		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		const recording = await Recording.create({
			gameCode,
			gameTitle: gameTitle || '',
			gmEmail: user.email,
			expiresAt,
		})
		res.json({ recordingId: String(recording._id) })
	} catch (err: any) {
		logger.error('[recordings/initiate]', err)
		res.status(500).json({ message: 'Failed to initiate recording' })
	}
})

router.put('/upload/:id', authMiddleware, validateParams(recordingIdSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const recording = await Recording.findById(req.params.id)
		if (!recording) { res.status(404).json({ message: 'Recording not found' }); return }

		const uploader = await User.findById(req.userId).select('email')
		if (!uploader || uploader.email !== recording.gmEmail) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		if (recording.status === 'completed') { res.json({ shareLink: recording.shareLink }); return }

		const filename = `recording-${recording.gameCode}-${Date.now()}.webm`

		const { fileId } = await uploadStreamToDrive(req as any, filename)
		const shareLink = await makeFilePublic(fileId)

		await Recording.findByIdAndUpdate(req.params.id, {
			driveFileId: fileId,
			shareLink,
			status: 'completed',
		})

		res.json({ shareLink })
	} catch (err: any) {
		logger.error('[recordings/upload]', err instanceof Error ? err.message : 'unknown error')
		res.status(500).json({ message: 'Upload failed' })
	}
})

router.get('/:id', validateParams(recordingIdSchema), async (req, res): Promise<void> => {
	try {
		const recording = await Recording.findById(req.params.id).select('shareLink status expiresAt gameTitle gameCode')
		if (!recording) { res.status(404).json({ message: 'Not found' }); return }
		if (recording.expiresAt < new Date()) { res.status(410).json({ message: 'Expired' }); return }
		res.json({
			shareLink: recording.shareLink,
			status: recording.status,
			gameTitle: recording.gameTitle,
			gameCode: recording.gameCode,
			expiresAt: recording.expiresAt,
		})
	} catch (err: any) {
		logger.error('[recordings/:id GET]', err)
		res.status(500).json({ message: 'Error' })
	}
})

export default router
