import express, { Router, Response } from 'express'
import { z } from 'zod'
import logger from '../config/logger'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody, validateParams } from '../middleware/validationMiddleware'
import { Game } from '../models/Game'
import { Recording } from '../models/Recording'
import { resolveSeat } from '../services/roomAccess'
import { RECORDING_PART_SIZE } from '../services/storage'
import {
	finishBrowserRecording,
	normaliseContentType,
	RecordingError,
	recordingMode,
	startBrowserRecording,
	storeBrowserPart,
} from '../services/recording'

/**
 * The browser recorder's side of the conversation (RECORDING_MODE=browser).
 *
 * Only the gamemaster of the game may record it — the old upload endpoints
 * took anyone's recording into the club's storage. Parts arrive in order and
 * at a fixed size; see services/recording.ts.
 */
const router = Router()

const initiateSchema = z.object({
	// The code the gamemaster opened the room with
	code: z.string().min(4).max(12),
	contentType: z.string().max(100),
})

const idSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recording ID'),
	n: z.string().regex(/^\d{1,5}$/, 'Invalid part number').optional(),
})

router.post('/initiate', authMiddleware, validateBody(initiateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (recordingMode() !== 'browser') {
			res.status(409).json({ message: 'Recording is done by LiveKit on this server' })
			return
		}
		const userId = String(req.userId)
		const seat = await resolveSeat(req.body.code, userId)
		if (!seat?.isCreator) { res.status(403).json({ message: 'FORBIDDEN' }); return }

		const contentType = normaliseContentType(req.body.contentType)
		if (!contentType) { res.status(400).json({ message: 'Unsupported recording format' }); return }

		const game = await Game.findById(seat.gameId).select('title')
		const recording = await startBrowserRecording({
			gameId: seat.gameId,
			gameCode: seat.gameCode,
			gameTitle: game?.title ?? '',
			gmId: userId,
			contentType,
		})
		res.json({ recordingId: String(recording._id), partSize: RECORDING_PART_SIZE })
	} catch (err) {
		const message = err instanceof RecordingError ? err.message : 'Recording could not start'
		logger.error('[recordings/initiate]', { error: err instanceof Error ? err.message : String(err) })
		res.status(err instanceof RecordingError ? 409 : 500).json({ message })
	}
})

const rawPart = express.raw({ type: () => true, limit: RECORDING_PART_SIZE + 1024 })

// POST /api/recordings/:id/parts/:n — one part; `X-Final: 1` on the last one
// (which may be empty) closes the file and sends the link to Telegram.
router.post('/:id/parts/:n', authMiddleware, validateParams(idSchema), rawPart, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const recording = await Recording.findById(req.params.id)
		if (!recording || recording.mode !== 'browser') { res.status(404).json({ message: 'Recording not found' }); return }
		if (String(recording.gmId) !== String(req.userId)) { res.status(403).json({ message: 'FORBIDDEN' }); return }
		if (recording.status !== 'recording') {
			// Already closed — by the silence check, or a finish whose answer was lost
			res.status(409).json({ message: 'Recording is closed', status: recording.status })
			return
		}

		const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
		const isFinal = req.header('X-Final') === '1'
		const bytes = await storeBrowserPart(recording, Number(req.params.n), body, isFinal)

		if (isFinal) {
			const fresh = await Recording.findById(recording._id)
			if (fresh) await finishBrowserRecording(fresh, false)
			res.json({ bytes, complete: true })
			return
		}
		res.json({ bytes, complete: false })
	} catch (err) {
		if (err instanceof RecordingError) {
			// Tell the browser where the server stands, so it can pick up from there
			const current = await Recording.findById(req.params.id).select('parts').lean().catch(() => null)
			res.status(400).json({ message: err.message, expectedPart: (current?.parts?.length ?? 0) + 1 })
			return
		}
		logger.error('[recordings/part]', { recordingId: req.params.id, error: err instanceof Error ? err.message : String(err) })
		res.status(500).json({ message: 'Part upload failed' })
	}
})

// POST /api/recordings/:id/alive — "still recording". A voice-only recording
// fills a part only every ten minutes or so; without this the server would
// take the quiet for a closed tab and close the file.
router.post('/:id/alive', authMiddleware, validateParams(idSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const updated = await Recording.findOneAndUpdate(
			{ _id: req.params.id, gmId: req.userId, mode: 'browser', status: 'recording' },
			{ $set: { lastPartAt: new Date() } },
		)
		if (!updated) { res.status(409).json({ message: 'Recording is closed' }); return }
		res.json({ ok: true })
	} catch (err) {
		logger.error('[recordings/alive]', { error: err instanceof Error ? err.message : String(err) })
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
