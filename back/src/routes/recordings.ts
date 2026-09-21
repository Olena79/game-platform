import logger from '../config/logger'
import express, { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { Recording } from '../models/Recording'
import { User } from '../models/User'
import {
	uploadStreamToDrive,
	makeFilePublic,
	driveErrorReason,
	createResumableSession,
	ensureStorageUsable,
	uploadChunkToSession,
	DRIVE_CHUNK_UNIT,
} from '../services/googleDrive'
import { validateBody, validateParams } from '../middleware/validationMiddleware'
import { sendRecordingLinkToTelegram } from '../services/telegramBot'
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

		// Check storage before the game is recorded, not after: an unusable
		// Drive means the observer should record locally instead of streaming
		// into a session that can never be closed.
		const storage = await ensureStorageUsable()
		if (!storage.ok) {
			logger.error('[recordings/initiate] storage unusable', { reason: storage.detail })
			res.status(503).json({ message: 'Recording storage unavailable', reason: storage.detail })
			return
		}

		const filename = `recording-${gameCode}-${Date.now()}.webm`
		const uploadUri = await createResumableSession(filename)

		const recording = await Recording.create({
			gameCode,
			gameTitle: gameTitle || '',
			gmEmail: user.email,
			uploadUri,
			uploadedBytes: 0,
			status: 'uploading',
			expiresAt,
		})
		res.json({ recordingId: String(recording._id), chunkUnit: DRIVE_CHUNK_UNIT })
	} catch (err: any) {
		const reason = driveErrorReason(err)
		logger.error('[recordings/initiate]', { reason })
		res.status(500).json({ message: 'Failed to initiate recording', reason })
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
		// Surface the Drive reason: the GM is looking at a finished recording
		// that just failed to save and needs to know whether to retry or to
		// download the file instead.
		const reason = driveErrorReason(err)
		logger.error('[recordings/upload]', { recordingId: req.params.id, reason })
		res.status(500).json({ message: 'Upload failed', reason })
	}
})

/**
 * The most recent chunk of each active upload, held back on purpose.
 *
 * Drive only turns a resumable session into a real file when it receives a
 * chunk carrying the total size. By keeping the latest chunk here instead of
 * forwarding it immediately, the server can always close the file on its own
 * — so an observer tab that dies mid-game still leaves a playable recording
 * behind (see finalizeStaleUploads).
 */
const heldChunks = new Map<string, { buf: Buffer; driveOffset: number; touchedAt: number }>()

/**
 * Tells the gamemaster where the finished recording is.
 *
 * The link used to live only in the observer window, which is exactly the
 * window that is gone whenever a recording had to be closed on its own.
 */
async function notifyRecordingSaved(gmEmail: string, gameTitle: string, shareLink: string, interrupted: boolean): Promise<void> {
	try {
		const gm = await User.findOne({ email: gmEmail }).select('telegramChatId language')
		if (!gm?.telegramChatId) return
		await sendRecordingLinkToTelegram(
			gm.telegramChatId,
			gameTitle,
			shareLink,
			interrupted,
			(gm as { language?: string }).language || 'uk',
		)
	} catch (err) {
		logger.warn('[recordings] could not notify the gamemaster', {
			error: err instanceof Error ? err.message : String(err),
		})
	}
}

const rawChunkBody = express.raw({ type: () => true, limit: '64mb' })

router.post('/chunk/:id', authMiddleware, validateParams(recordingIdSchema), rawChunkBody, async (req: AuthRequest, res: Response): Promise<void> => {
	const id = req.params.id
	try {
		const recording = await Recording.findById(id)
		if (!recording) { res.status(404).json({ message: 'Recording not found' }); return }

		const uploader = await User.findById(req.userId).select('email')
		if (!uploader || uploader.email !== recording.gmEmail) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}
		if (recording.status === 'completed') {
			res.json({ shareLink: recording.shareLink, complete: true })
			return
		}
		if (!recording.uploadUri) { res.status(409).json({ message: 'No upload session' }); return }

		const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
		const isFinal = req.header('X-Chunk-Final') === '1'
		const offset = Number(req.header('X-Chunk-Offset'))

		if (!Number.isInteger(offset) || offset < 0) {
			res.status(400).json({ message: 'Invalid X-Chunk-Offset' })
			return
		}
		// The client and Drive must agree on the byte position, otherwise the
		// file silently ends up corrupt. Tell the client where to resume from.
		if (offset !== recording.uploadedBytes) {
			res.status(409).json({ message: 'Offset mismatch', expected: recording.uploadedBytes })
			return
		}
		if (!isFinal && body.length % DRIVE_CHUNK_UNIT !== 0) {
			res.status(400).json({ message: `Chunk must be a multiple of ${DRIVE_CHUNK_UNIT} bytes` })
			return
		}

		const held = heldChunks.get(id)

		if (isFinal) {
			// Whatever is still held, plus this tail, closes the file
			const buf = held ? Buffer.concat([held.buf, body]) : body
			const startAt = held ? held.driveOffset : recording.uploadedBytes
			if (buf.length === 0) {
				res.status(409).json({ message: 'Nothing to finalise' })
				return
			}
			const total = startAt + buf.length
			const { fileId } = await uploadChunkToSession(recording.uploadUri, buf, startAt, total)
			heldChunks.delete(id)
			const shareLink = await makeFilePublic(fileId!)
			await Recording.findByIdAndUpdate(id, {
				driveFileId: fileId,
				shareLink,
				status: 'completed',
				uploadedBytes: total,
			})
			// The GM may well have closed the room by now
			void notifyRecordingSaved(recording.gmEmail, recording.gameTitle, shareLink, false)

			res.json({ shareLink, complete: true, bytes: total })
			return
		}

		// Not final: push the chunk held from last time, then hold this one
		let driveOffset = recording.uploadedBytes
		if (held) {
			await uploadChunkToSession(recording.uploadUri, held.buf, held.driveOffset, null)
			driveOffset = held.driveOffset + held.buf.length
		}
		heldChunks.set(id, { buf: body, driveOffset, touchedAt: Date.now() })
		const accepted = driveOffset + body.length
		await Recording.findByIdAndUpdate(id, { uploadedBytes: accepted, status: 'uploading' })
		res.json({ complete: false, bytes: accepted })
	} catch (err: any) {
		const reason = driveErrorReason(err)
		logger.error('[recordings/chunk]', { recordingId: id, reason })
		res.status(500).json({ message: 'Chunk upload failed', reason })
	}
})

/**
 * Closes uploads whose observer went away. Without this, bytes already in
 * Drive would sit in an unfinished session and the game would be lost.
 */
export async function finalizeStaleUploads(idleMs = 5 * 60 * 1000): Promise<void> {
	for (const [id, held] of heldChunks) {
		if (Date.now() - held.touchedAt < idleMs) continue
		heldChunks.delete(id)
		try {
			const recording = await Recording.findById(id)
			if (!recording || recording.status === 'completed' || !recording.uploadUri) continue

			const total = held.driveOffset + held.buf.length
			const { fileId } = await uploadChunkToSession(recording.uploadUri, held.buf, held.driveOffset, total)
			const shareLink = await makeFilePublic(fileId!)
			await Recording.findByIdAndUpdate(id, {
				driveFileId: fileId,
				shareLink,
				status: 'completed',
				uploadedBytes: total,
				salvaged: true,
			})
			logger.warn(`Salvaged interrupted recording ${id} (${Math.round(total / 1048576)} MB)`, { task: 'recordings:salvage' })
			void notifyRecordingSaved(recording.gmEmail, recording.gameTitle, shareLink, true)
		} catch (err) {
			logger.error('[recordings/salvage]', { recordingId: id, reason: driveErrorReason(err) })
			await Recording.findByIdAndUpdate(id, { status: 'failed' }).catch(() => undefined)
		}
	}
}

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
