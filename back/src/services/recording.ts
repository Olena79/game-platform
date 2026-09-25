import { EventEmitter } from 'events'
import { EgressStatus, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk'
import logger from '../config/logger'
import { Recording, IRecording } from '../models/Recording'
import { User } from '../models/User'
import { egressClient, roomNameFor } from './livekit'
import { deleteObject, egressUploadTarget, isStorageConfigured, signedDownloadUrl } from './storage'
import { sendRecordingLinkToTelegram } from './telegramBot'

/**
 * Game recording through LiveKit Egress.
 *
 * The server asks LiveKit to record the room; LiveKit composes everyone into
 * one video (grid layout) and uploads the MP4 to the R2 bucket itself. No
 * browser records anything, so it works from a phone, survives a closed tab,
 * and survives a restart of this server — the state lives in LiveKit and in
 * the Recording rows, and `syncRecordings` picks it up again.
 *
 * The gamemaster gets the link in Telegram when the file is ready. The file
 * and the link last 7 days from the start of the recording.
 */

export const RECORDING_TTL_MS = 7 * 24 * 60 * 60 * 1000
const LAYOUT = 'grid'

/** What the room shows the gamemaster */
export type RecordingUiStatus = 'recording' | 'stopping' | 'done' | 'error'

export interface RecordingEvent {
	gameId: string
	status: RecordingUiStatus
	/** Human-readable reason, for 'error' */
	detail?: string
}

/** The game room listens here to keep the gamemaster's controls current. */
export const recordingEvents = new EventEmitter()

function announce(event: RecordingEvent): void {
	recordingEvents.emit('status', event)
}

const ACTIVE: IRecording['status'][] = ['recording', 'stopping']

export async function activeRecording(gameId: string): Promise<IRecording | null> {
	return Recording.findOne({ gameId, status: { $in: ACTIVE } }).sort({ createdAt: -1 })
}

export class RecordingError extends Error {}

export async function startRecording(opts: {
	gameId: string
	gameCode: string
	gameTitle: string
	gmId: string
}): Promise<IRecording> {
	if (!isStorageConfigured()) {
		throw new RecordingError('Recording storage is not configured on the server')
	}
	const existing = await activeRecording(opts.gameId)
	if (existing?.status === 'recording') {
		announce({ gameId: opts.gameId, status: 'recording' })
		return existing
	}
	if (existing) {
		// LiveKit allows one file per egress; the last one is still uploading
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
		info = await egressClient.startRoomCompositeEgress(roomNameFor(opts.gameId), output, { layout: LAYOUT })
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		logger.error('[recording] egress start failed', { gameId: opts.gameId, error: message })
		throw new RecordingError(message)
	}

	const recording = await Recording.create({
		gameId: opts.gameId,
		gameCode: opts.gameCode,
		gameTitle: opts.gameTitle,
		gmId: opts.gmId,
		egressId: info.egressId,
		fileKey,
		status: 'recording',
		expiresAt: new Date(Date.now() + RECORDING_TTL_MS),
	})
	logger.info('[recording] started', { gameId: opts.gameId, egressId: info.egressId })
	announce({ gameId: opts.gameId, status: 'recording' })
	return recording
}

/** Asks LiveKit to finish the file; `syncRecordings` delivers it once uploaded. */
export async function stopRecording(gameId: string): Promise<boolean> {
	const recording = await activeRecording(gameId)
	if (!recording) return false
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
 * Brings every unfinished recording up to date with LiveKit.
 *
 * Runs every minute and after each stop. Idempotent, and the only place a
 * recording finishes — so it works the same after a restart, after the room
 * emptied and LiveKit ended the egress by itself, or after a normal stop.
 */
export async function syncRecordings(): Promise<void> {
	if (syncing) return
	syncing = true
	try {
		const open = await Recording.find({ status: { $in: ACTIVE } })
		for (const recording of open) {
			try {
				await syncOne(recording)
			} catch (err) {
				logger.warn('[recording] sync failed', { recordingId: String(recording._id), error: err instanceof Error ? err.message : String(err) })
			}
		}
	} finally {
		syncing = false
	}
}

async function syncOne(recording: IRecording): Promise<void> {
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

async function complete(recording: IRecording, interrupted: boolean): Promise<void> {
	const secondsLeft = (recording.expiresAt.getTime() - Date.now()) / 1000
	const shareLink = await signedDownloadUrl(recording.fileKey, secondsLeft)
	recording.status = 'completed'
	recording.interrupted = interrupted
	recording.shareLink = shareLink
	await recording.save()
	logger.info('[recording] completed', { recordingId: String(recording._id), interrupted })
	announce({ gameId: recording.gameId, status: 'done' })
	await notifyGamemaster(recording)
}

async function fail(recording: IRecording, reason: string): Promise<void> {
	recording.status = 'failed'
	recording.error = reason.slice(0, 500)
	await recording.save()
	logger.error('[recording] failed', { recordingId: String(recording._id), reason })
	announce({ gameId: recording.gameId, status: 'error', detail: reason })
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
	const expired = await Recording.find({ expiresAt: { $lte: new Date() }, status: { $nin: ACTIVE } })
	let removed = 0
	let kept = 0
	for (const rec of expired) {
		if (rec.fileKey) {
			try {
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

/** Everything a deleted account leaves behind: its recordings, file and row. */
export async function deleteRecordingsOf(gmId: string): Promise<number> {
	const recordings = await Recording.find({ gmId })
	for (const rec of recordings) {
		if (ACTIVE.includes(rec.status)) {
			await egressClient.stopEgress(rec.egressId).catch(() => undefined)
		}
		if (rec.fileKey) {
			await deleteObject(rec.fileKey).catch(err => {
				logger.warn('[account] could not remove a recording file', {
					recordingId: String(rec._id),
					error: err instanceof Error ? err.message : String(err),
				})
			})
		}
		await rec.deleteOne()
	}
	return recordings.length
}
