import { google } from 'googleapis'
import type { Readable } from 'stream'

function getDrive() {
	if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
		throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')
	}
	const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
	const auth = new google.auth.GoogleAuth({
		credentials,
		// Full drive scope, not drive.file: recordings go into a folder that was
		// shared with the service account through the Drive UI, and drive.file
		// only covers files the app itself created — it cannot see that folder.
		scopes: ['https://www.googleapis.com/auth/drive'],
	})
	return google.drive({ version: 'v3', auth })
}

/**
 * Human-readable reason behind a Drive rejection. The API buries the useful
 * part ('accessNotConfigured', 'storageQuotaExceeded', ...) inside the error,
 * and without it a failed upload looks like a generic 500 to everyone.
 */
export function driveErrorReason(err: unknown): string {
	const e = err as { code?: number | string; message?: string; errors?: Array<{ reason?: string; message?: string }> }
	const reason = e?.errors?.[0]?.reason
	const message = e?.errors?.[0]?.message ?? e?.message ?? 'unknown error'
	return reason ? `${reason}: ${message}` : message
}

export async function uploadStreamToDrive(
	stream: Readable,
	filename: string,
): Promise<{ fileId: string }> {
	const drive = getDrive()
	const requestBody: Record<string, unknown> = { name: filename }
	if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
		requestBody.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID]
	}
	const res = await drive.files.create({
		requestBody,
		media: { mimeType: 'video/webm', body: stream },
		fields: 'id',
		// Required when the target folder lives in a Shared Drive; harmless otherwise
		supportsAllDrives: true,
	})
	return { fileId: res.data.id! }
}

export async function makeFilePublic(fileId: string): Promise<string> {
	const drive = getDrive()
	await drive.permissions.create({
		fileId,
		requestBody: { role: 'reader', type: 'anyone' },
		supportsAllDrives: true,
	})
	return `https://drive.google.com/file/d/${fileId}/view`
}

/** Deletes the file. Returns false when it was already gone. */
export async function deleteFile(fileId: string): Promise<boolean> {
	const drive = getDrive()
	try {
		await drive.files.delete({ fileId, supportsAllDrives: true })
		return true
	} catch (err) {
		const code = (err as { code?: number }).code
		if (code === 404) return false   // nothing left to delete
		throw err
	}
}

/**
 * Startup probe. Recordings only fail at the moment someone finishes one, by
 * which point the video is already at risk — so check the configuration while
 * nobody is waiting on it.
 */
export async function verifyDriveAccess(): Promise<{ ok: boolean; detail: string }> {
	try {
		const drive = getDrive()
		const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
		if (!folderId) return { ok: false, detail: 'GOOGLE_DRIVE_FOLDER_ID is not set' }
		const res = await drive.files.get({
			fileId: folderId,
			fields: 'id,name,mimeType,driveId',
			supportsAllDrives: true,
		})
		const sharedDrive = Boolean(res.data.driveId)
		return {
			ok: true,
			detail: `folder "${res.data.name}" reachable (${sharedDrive ? 'shared drive' : 'my drive'})`,
		}
	} catch (err) {
		return { ok: false, detail: driveErrorReason(err) }
	}
}
