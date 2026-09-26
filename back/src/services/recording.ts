import { EventEmitter } from 'events'
import { EgressStatus, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk'
import logger from '../config/logger'
import { Recording, IRecording, RecordingMode } from '../models/Recording'
import { User } from '../models/User'
import { egressClient, roomNameFor } from './livekit'
import {
	abortMultipartUpload,
	completeMultipartUpload,
	deleteObject,
	egressUploadTarget,
	isStorageConfigured,
	RECORDING_PART_SIZE,
	signedDownloadUrl,
	startMultipartUpload,
	uploadPart,
} from './storage'
import { sendRecordingLinkToTelegram } from './telegramBot'
import { noticeRecordingEnded, noticeRecordingStarted } from './adminNotify'

/**
 * Game recording. Two ways to make one, chosen by RECORDING_MODE:
 *
 * - 'browser' (default, free): the gamemaster's browser draws everyone's video
 *   into one grid, mixes their voices, records that, and uploads it here part
 *   by part while the game runs. Works on phones — no screen capture is
 *   involved — but the gamemaster's room tab has to stay open and in front.
 *   The parts live in R2 from the moment they arrive, so if the browser
 *   disappears, `syncRecordings` closes the file from what made it.
 *
 * - 'egress' (LiveKit Ship plan or higher, ~$50/month): LiveKit records the
 *   room on its own servers into the same bucket. Nothing runs on any device.
 *   The free LiveKit plan allows only 60 minutes a month and refuses beyond
 *   that, which is why it is not the default.
 *
 * Either way the gamemaster gets a Telegram link when the file is ready; the
 * file and the link last 7 days from the start of the recording.
 */

export const RECORDING_TTL_MS = 7 * 24 * 60 * 60 * 1000
const EGRESS_LAYOUT = 'grid'
/** A browser that sent nothing for this long is gone; its parts become the file */
const BROWSER_SILENCE_MS = 3 * 60 * 1000
/** Room for a very long game at a generous bitrate, and a lid on abuse */
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024 * 1024
export const MAX_PARTS = Math.floor(MAX_RECORDING_BYTES / RECORDING_PART_SIZE)

export function recordingMode(): RecordingMode {
	return process.env.RECORDING_MODE === 'egress' ? 'egress' : 'browser'
}

/** What the room shows the gamemaster */
export type RecordingUiStatus = 'recording' | 'stopping' | 'done' | 'error'

export interface RecordingEvent {
	gameId: string
	status: RecordingUiStatus
	/** Human-readable reason, for 'error' */
	detail?: string
}

/**
 * The game room listens here: 'status' keeps everyone's recording indicator
 * and the gamemaster's controls current; 'stop-request' asks the
 * gamemaster's browser to finish a browser recording (game over).
 */
export const recordingEvents = new EventEmitter()

function announce(event: RecordingEvent): void {
	recordingEvents.emit('status', event)
}

const ACTIVE: IRecording['status'][] = ['recording', 'stopping']

export async function activeRecording(gameId: string): Promise<IRecording | null> {
	return Recording.findOne({ gameId, status: { $in: ACTIVE } }).sort({ createdAt: -1 })
}

export class RecordingError extends Error {}

function assertStorage(): void {
	if (!isStorageConfigured()) {
		throw new RecordingError('Recording storage is not configured on the server')
	}
}

// ── Browser mode ────────────────────────────────────────────────────────────

const EXTENSIONS: Record<string, string> = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }

/** The container the browser records in, reduced to what we accept */
export function normaliseContentType(raw: unknown): string | null {
	if (typeof raw !== 'string') return null
	const base = raw.split(';')[0].trim().toLowerCase()
	return base in EXTENSIONS ? base : null
}

export interface PartRules {
	expectedPart: number
	receivedPart: number
	size: number
	isFinal: boolean
}

/**
 * Which part may arrive now, and how big it may be. Parts come strictly in
 * order; every part but the last is exactly RECORDING_PART_SIZE (R2 needs
 * equal parts). A part already stored is acknowledged again, so a retry
 * after a lost response is harmless.
 */
export function checkPart({ expectedPart, receivedPart, size, isFinal }: PartRules): 'store' | 'duplicate' | string {
	if (!Number.isInteger(receivedPart) || receivedPart < 1) return 'Invalid part number'
	if (receivedPart < expectedPart) return 'duplicate'
	if (receivedPart > expectedPart) return `Expected part ${expectedPart}`
	if (receivedPart > MAX_PARTS) return 'Recording too long'
	if (isFinal ? size > RECORDING_PART_SIZE : size !== RECORDING_PART_SIZE) {
		return `Part must be ${isFinal ? 'at most' : 'exactly'} ${RECORDING_PART_SIZE} bytes`
	}
	return 'store'
}

/**
 * Opens a browser recording. A recording the same game still has open (the
 * gamemaster reloaded mid-game) is closed first, so nothing it holds is lost.
 */
export async function startBrowserRecording(opts: {
	gameId: string
	gameCode: string
	gameTitle: string
	gmId: string
	contentType: string
}): Promise<IRecording> {
	assertStorage()
	const previous = await activeRecording(opts.gameId)
	if (previous) {
		if (previous.mode === 'egress') throw new RecordingError('A LiveKit recording is still running for this game')
		await finishBrowserRecording(previous, true)
	}

	const ext = EXTENSIONS[opts.contentType] ?? 'webm'
	const fileKey = `recordings/${opts.gameId}/${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
	const uploadId = await startMultipartUpload(fileKey, opts.contentType)
	const recording = await Recording.create({
		mode: 'browser',
		gameId: opts.gameId,
		gameCode: opts.gameCode,
		gameTitle: opts.gameTitle,
		gmId: opts.gmId,
		uploadId,
		contentType: opts.contentType,
		fileKey,
		status: 'recording',
		lastPartAt: new Date(),
		expiresAt: new Date(Date.now() + RECORDING_TTL_MS),
	})
	logger.info('[recording] browser recording started', { gameId: opts.gameId, recordingId: String(recording._id) })
	announce({ gameId: opts.gameId, status: 'recording' })
	void noticeRecordingStarted(recording).catch(() => undefined)
	return recording
}

/** Stores one part. Returns the bytes the server now holds. */
export async function storeBrowserPart(recording: IRecording, partNumber: number, body: Buffer, isFinal: boolean): Promise<number> {
	const verdict = checkPart({ expectedPart: recording.parts.length + 1, receivedPart: partNumber, size: body.length, isFinal })
	if (verdict === 'duplicate') return recording.uploadedBytes
	if (verdict !== 'store') throw new RecordingError(verdict)
	if (body.length === 0) return recording.uploadedBytes

	const etag = await uploadPart(recording.fileKey, recording.uploadId, partNumber, body)
	// Pushed only if still the next part: two racing requests cannot both land
	const updated = await Recording.findOneAndUpdate(
		{ _id: recording._id, status: 'recording', parts: { $size: partNumber - 1 } },
		{ $push: { parts: { partNumber, etag } }, $inc: { uploadedBytes: body.length }, $set: { lastPartAt: new Date() } },
		{ new: true },
	)
	return updated?.uploadedBytes ?? recording.uploadedBytes
}

/**
 * Closes a browser recording into a file, from the parts that arrived.
 * `interrupted` marks one whose browser never said it was done.
 */
export async function finishBrowserRecording(recording: IRecording, interrupted: boolean): Promise<void> {
	// Claim it: the browser's "finish" and the silence check can meet here
	const claimed = await Recording.findOneAndUpdate(
		{ _id: recording._id, status: 'recording' },
		{ $set: { status: 'stopping' } },
		{ new: true },
	)
	if (!claimed) return
	announce({ gameId: claimed.gameId, status: 'stopping' })

	if (claimed.parts.length === 0) {
		await abortMultipartUpload(claimed.fileKey, claimed.uploadId).catch(() => undefined)
		await fail(claimed, 'Nothing was recorded')
		return
	}
	try {
		await completeMultipartUpload(claimed.fileKey, claimed.uploadId, claimed.parts.map(p => ({ partNumber: p.partNumber, etag: p.etag })))
	} catch (err) {
		await fail(claimed, err instanceof Error ? err.message : String(err))
		return
	}
	await complete(claimed, interrupted)
}

// ── Egress mode ─────────────────────────────────────────────────────────────

export async function startEgressRecording(opts: {
	gameId: string
	gameCode: string
	gameTitle: string
	gmId: string
}): Promise<IRecording> {
	assertStorage()
	const existing = await activeRecording(opts.gameId)
	if (existing?.status === 'recording' && existing.mode === 'egress') {
		announce({ gameId: opts.gameId, status: 'recording' })
		return existing
	}
	if (existing) {
		// LiveKit allows one file per egress; the last one is still being saved
		throw new RecordingError('The previous recording is still being saved — try again in a minute')
	}

	const fileKey = `recordings/${opts.gameId}/${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`
	const output = new EncodedFileOutput({
		fileType: EncodedFileType.MP4,
		filepath: fileKey,
		output: { case: 's3', value: egressUploadTarget() },
	})

	let info
	try {
		info = await egressClient.startRoomCompositeEgress(roomNameFor(opts.gameId), output, { layout: EGRESS_LAYOUT })
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		logger.error('[recording] egress start failed', { gameId: opts.gameId, error: message })
		throw new RecordingError(message)
	}

	const recording = await Recording.create({
		mode: 'egress',
		gameId: opts.gameId,
		gameCode: opts.gameCode,
		gameTitle: opts.gameTitle,
		gmId: opts.gmId,
		egressId: info.egressId,
		contentType: 'video/mp4',
		fileKey,
		status: 'recording',
		expiresAt: new Date(Date.now() + RECORDING_TTL_MS),
	})
	logger.info('[recording] egress started', { gameId: opts.gameId, egressId: info.egressId })
	announce({ gameId: opts.gameId, status: 'recording' })
	void noticeRecordingStarted(recording).catch(() => undefined)
	return recording
}

/**
 * The game is over (or the game deleted): whatever records it has to stop.
 * An egress is stopped here; a browser recording is asked to finish — its
 * browser uploads the last part — and if nobody answers, the silence check
 * closes it from the parts already stored.
 */
export async function stopRecording(gameId: string): Promise<boolean> {
	const recording = await activeRecording(gameId)
	if (!recording) return false

	if (recording.mode === 'browser') {
		recordingEvents.emit('stop-request', { gameId })
		return true
	}

	if (recording.status === 'recording') {
		try {
			await egressClient.stopEgress(recording.egressId)
		} catch (err) {
			// Already ending on its own (room closed, limit) — the sync will see it
			logger.warn('[recording] stopEgress failed', { gameId, error: err instanceof Error ? err.message : String(err) })
		}
		recording.status = 'stopping'
		await recording.save()
	}
	announce({ gameId, status: 'stopping' })
	// Upload usually takes seconds; look sooner than the next cron tick
	setTimeout(() => { void syncRecordings() }, 5_000)
	return true
}

let syncing = false

/**
 * Brings every unfinished recording to its end. Runs every minute and after
 * each stop; idempotent, so it works the same after a restart.
 *  - egress: follows LiveKit's job until the file is written;
 *  - browser: closes recordings whose browser has gone quiet.
 */
export async function syncRecordings(): Promise<void> {
	if (syncing) return
	syncing = true
	try {
		const open = await Recording.find({ status: { $in: ACTIVE } })
		for (const recording of open) {
			try {
				if (recording.mode === 'browser') await syncBrowser(recording)
				else await syncEgress(recording)
			} catch (err) {
				logger.warn('[recording] sync failed', { recordingId: String(recording._id), error: err instanceof Error ? err.message : String(err) })
			}
		}
	} finally {
		syncing = false
	}
}

async function syncBrowser(recording: IRecording): Promise<void> {
	if (recording.status === 'stopping') {
		// A finish that died halfway (restart): try closing it again
		if (Date.now() - recording.updatedAt.getTime() > BROWSER_SILENCE_MS) {
			recording.status = 'recording'
			await recording.save()
			await finishBrowserRecording(recording, true)
		}
		return
	}
	if (Date.now() - recording.lastPartAt.getTime() < BROWSER_SILENCE_MS) return
	logger.warn('[recording] browser went quiet, closing the file from the parts received', { recordingId: String(recording._id), parts: recording.parts.length })
	await finishBrowserRecording(recording, true)
}

async function syncEgress(recording: IRecording): Promise<void> {
	const [info] = await egressClient.listEgress({ egressId: recording.egressId })
	if (!info) {
		// LiveKit forgot it. After a day there is nothing left to wait for.
		if (Date.now() - recording.createdAt.getTime() > 24 * 60 * 60 * 1000) {
			await fail(recording, 'Egress not found')
		}
		return
	}

	switch (info.status) {
		case EgressStatus.EGRESS_STARTING:
		case EgressStatus.EGRESS_ACTIVE:
		case EgressStatus.EGRESS_ENDING:
			return
		case EgressStatus.EGRESS_COMPLETE:
			await complete(recording, false)
			return
		default: {
			// FAILED / ABORTED / LIMIT_REACHED: keep whatever was written
			const written = info.fileResults?.some(f => Number(f.size ?? 0) > 0)
			if (written) await complete(recording, true)
			else await fail(recording, info.error || EgressStatus[info.status] || 'Egress failed')
		}
	}
}

// ── Common ending ───────────────────────────────────────────────────────────

async function complete(recording: IRecording, interrupted: boolean): Promise<void> {
	const secondsLeft = (recording.expiresAt.getTime() - Date.now()) / 1000
	const ext = recording.fileKey.split('.').pop() ?? 'mp4'
	const date = recording.createdAt.toISOString().slice(0, 10)
	const shareLink = await signedDownloadUrl(recording.fileKey, secondsLeft, `${recording.gameTitle || 'game'}-${date}.${ext}`)
	recording.status = 'completed'
	recording.interrupted = interrupted
	recording.shareLink = shareLink
	await recording.save()
	logger.info('[recording] completed', { recordingId: String(recording._id), mode: recording.mode, interrupted })
	announce({ gameId: recording.gameId, status: 'done' })
	await notifyGamemaster(recording)
	void noticeRecordingEnded(recording).catch(() => undefined)
}

async function fail(recording: IRecording, reason: string): Promise<void> {
	recording.status = 'failed'
	recording.error = reason.slice(0, 500)
	await recording.save()
	logger.error('[recording] failed', { recordingId: String(recording._id), reason })
	announce({ gameId: recording.gameId, status: 'error', detail: reason })
	void noticeRecordingEnded(recording, reason).catch(() => undefined)
}

async function notifyGamemaster(recording: IRecording): Promise<void> {
	try {
		const gm = await User.findById(recording.gmId).select('telegramChatId language')
		if (!gm?.telegramChatId) {
			logger.warn('[recording] gamemaster has no Telegram linked, link not delivered', { recordingId: String(recording._id) })
			return
		}
		await sendRecordingLinkToTelegram(gm.telegramChatId, recording.gameTitle, recording.shareLink, recording.interrupted, gm.language || 'uk')
	} catch (err) {
		logger.warn('[recording] could not notify the gamemaster', { error: err instanceof Error ? err.message : String(err) })
	}
}

/**
 * Deletes recordings whose 7 days are up. A row whose file cannot be removed
 * stays, so the next run retries instead of leaking the file.
 *
 * Rows left by the old Google Drive recorder only lose the row: their files
 * sit in the Drive account, outside this server's reach now.
 */
export async function cleanupExpiredRecordings(): Promise<void> {
	const expired = await Recording.find({
		$or: [
			{ expiresAt: { $lte: new Date() }, status: { $nin: ACTIVE } },
			// Old Google Drive rows: often no expiry at all, and their files are
			// out of reach since Drive access was revoked — the row is all there is
			{ driveFileId: { $exists: true, $nin: [null, ''] }, fileKey: { $in: [null, ''] } },
		],
	})
	let removed = 0
	let kept = 0
	for (const rec of expired) {
		if (rec.fileKey) {
			try {
				if (rec.status === 'failed' && rec.uploadId) {
					await abortMultipartUpload(rec.fileKey, rec.uploadId).catch(() => undefined)
				}
				await deleteObject(rec.fileKey)
			} catch (err) {
				kept++
				logger.warn('[recording] could not delete expired file', {
					recordingId: String(rec._id),
					error: err instanceof Error ? err.message : String(err),
				})
				continue
			}
		}
		await rec.deleteOne()
		removed++
	}
	if (removed > 0 || kept > 0) {
		logger.info(`Cleaned up ${removed} expired recording(s), ${kept} retained for retry`, { task: 'cron:cleanup' })
	}
}

/**
 * Deletes one recording: stops it if it is still running, removes the file
 * (or the unfinished upload) and the row. A running browser recording hears
 * about it on its next part (409) and stops.
 */
export async function deleteRecording(rec: IRecording): Promise<void> {
	if (ACTIVE.includes(rec.status)) {
		if (rec.mode === 'egress') await egressClient.stopEgress(rec.egressId).catch(() => undefined)
		if (rec.uploadId) await abortMultipartUpload(rec.fileKey, rec.uploadId).catch(() => undefined)
		announce({ gameId: rec.gameId, status: 'error', detail: 'Recording deleted' })
	}
	if (rec.fileKey) {
		await deleteObject(rec.fileKey).catch(err => {
			logger.warn('[recording] could not remove a recording file', {
				recordingId: String(rec._id),
				error: err instanceof Error ? err.message : String(err),
			})
		})
	}
	await rec.deleteOne()
}

/** Everything a deleted account leaves behind: its recordings, file and row. */
export async function deleteRecordingsOf(gmId: string): Promise<number> {
	const recordings = await Recording.find({ gmId })
	for (const rec of recordings) await deleteRecording(rec)
	return recordings.length
}
