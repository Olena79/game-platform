import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { Recording } from '../models/Recording'
import { User } from '../models/User'
import { uploadStreamToDrive, makeFilePublic } from '../services/googleDrive'
import { sendRecordingEmail } from '../services/email'

const router = Router()

router.post('/initiate', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { gameCode, gameTitle } = req.body
		if (!gameCode) { res.status(400).json({ message: 'gameCode required' }); return }

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
	} catch (err) {
		console.error('[recordings/initiate]', err)
		res.status(500).json({ message: 'Failed to initiate recording' })
	}
})

router.put('/upload/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const recording = await Recording.findById(req.params.id)
		if (!recording) { res.status(404).json({ message: 'Recording not found' }); return }

		// Ownership check: only the GM who initiated the recording may upload to it
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

		const platformEmail = process.env.SENDGRID_FROM || ''

		await Promise.allSettled([
			recording.gmEmail
				? sendRecordingEmail(recording.gmEmail, recording.gameTitle, recording.gameCode, shareLink)
				: Promise.resolve(),
			platformEmail && platformEmail !== recording.gmEmail
				? sendRecordingEmail(platformEmail, recording.gameTitle, recording.gameCode, shareLink)
				: Promise.resolve(),
		])

		res.json({ shareLink })
	} catch (err) {
		console.error('[recordings/upload]', err instanceof Error ? err.message : 'unknown error')
		res.status(500).json({ message: 'Upload failed' })
	}
})

router.get('/:id', async (req, res): Promise<void> => {
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
	} catch {
		res.status(500).json({ message: 'Error' })
	}
})

export default router
