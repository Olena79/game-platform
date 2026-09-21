import { google } from 'googleapis'
import type { Readable } from 'stream'

/** Scope for the OAuth path: only files this app creates, nothing else. */
export const DRIVE_APP_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const RECORDINGS_FOLDER_NAME = 'Games of Senses — recordings'

/**
 * Two ways to reach Drive:
 *
 * 1. OAuth as a real Google account (GOOGLE_OAUTH_*). Files are owned by that
 *    account and use its 15 GB. This is the only option on a personal gmail
 *    address — a service account has no storage of its own and every upload
 *    comes back as 'storageQuotaExceeded'.
 * 2. A service account (GOOGLE_SERVICE_ACCOUNT_JSON). Only works when the
 *    target folder lives in a Shared Drive (Google Workspace).
 *
 * OAuth wins when both are configured.
 */
function getAuthClient() {
	const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = process.env
	if (GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_REFRESH_TOKEN) {
		const client = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET)
		client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN })
		return client
	}
	if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
		throw new Error('No Drive credentials: set GOOGLE_OAUTH_* or GOOGLE_SERVICE_ACCOUNT_JSON')
	}
	const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
	return new google.auth.GoogleAuth({
		credentials,
		// Full drive scope: the folder was shared with the service account through
		// the Drive UI, which drive.file cannot see.
		scopes: ['https://www.googleapis.com/auth/drive'],
	})
}

export function usingOAuth(): boolean {
	return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_REFRESH_TOKEN)
}

function getDrive() {
	return google.drive({ version: 'v3', auth: getAuthClient() as never })
}

async function getRequestClient() {
	const auth = getAuthClient()
	return 'getClient' in auth ? await auth.getClient() : auth
}

let cachedFolderId: string | null = null

/**
 * Where recordings go.
 *
 * Under drive.file the app cannot see a folder that was shared with it by
 * hand, so it keeps its own: an existing one if this app created it before,
 * otherwise a fresh one. Files land in the account's Drive root only if even
 * that fails, which still beats losing the recording.
 */
export async function resolveFolderId(): Promise<string | null> {
	if (cachedFolderId) return cachedFolderId

	const configured = process.env.GOOGLE_DRIVE_FOLDER_ID
	const drive = getDrive()

	if (configured) {
		try {
			await drive.files.get({ fileId: configured, fields: 'id', supportsAllDrives: true })
			cachedFolderId = configured
			return cachedFolderId
		} catch {
			// Not visible under this scope/account — fall through and use our own
		}
	}

	try {
		const found = await drive.files.list({
			q: `name = '${RECORDINGS_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
			fields: 'files(id)',
			pageSize: 1,
		})
		const existing = found.data.files?.[0]?.id
		if (existing) {
			cachedFolderId = existing
			return cachedFolderId
		}
		const created = await drive.files.create({
			requestBody: { name: RECORDINGS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
			fields: 'id',
		})
		cachedFolderId = created.data.id ?? null
		return cachedFolderId
	} catch {
		return null
	}
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
	const folderId = await resolveFolderId()
	if (folderId) requestBody.parents = [folderId]
	const res = await drive.files.create({
		requestBody,
		media: { mimeType: 'video/webm', body: stream },
		fields: 'id',
		// Required when the target folder lives in a Shared Drive; harmless otherwise
		supportsAllDrives: true,
	})
	return { fileId: res.data.id! }
}

/** Chunks must line up with this, except for the very last one (Drive rule). */
export const DRIVE_CHUNK_UNIT = 256 * 1024

/**
 * Opens a resumable upload session and returns its URI. Chunks are PUT there
 * as the game is being recorded, so neither the browser nor this server ever
 * holds the whole video.
 */
export async function createResumableSession(filename: string): Promise<string> {
	const metadata: Record<string, unknown> = { name: filename }
	const folderId = await resolveFolderId()
	if (folderId) metadata.parents = [folderId]
	const client = await getRequestClient()
	const res = await client.request<unknown>({
		url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=UTF-8',
			'X-Upload-Content-Type': 'video/webm',
		},
		body: JSON.stringify(metadata),
	})
	const headers = res.headers as unknown as Record<string, string> & { get?: (k: string) => string | null }
	const location = (typeof headers.get === 'function' ? headers.get('location') : null) ?? headers.location
	if (!location) throw new Error('Drive returned no resumable session URI')
	return location
}

/**
 * Sends one chunk to an open session.
 * `totalSize` is null while more chunks are coming and the final byte count
 * when this is the last one — that is what makes Drive close the file.
 */
export async function uploadChunkToSession(
	sessionUri: string,
	chunk: Buffer,
	offset: number,
	totalSize: number | null,
): Promise<{ complete: boolean; fileId?: string }> {
	const client = await getRequestClient()
	const end = offset + chunk.length - 1
	const res = await client.request<{ id?: string }>({
		url: sessionUri,
		method: 'PUT',
		headers: {
			'Content-Range': `bytes ${offset}-${end}/${totalSize ?? '*'}`,
			'Content-Type': 'video/webm',
		},
		body: chunk,
		// 308 "Resume Incomplete" is the success case mid-upload, not an error
		validateStatus: (status: number) => status === 308 || (status >= 200 && status < 300),
		responseType: 'json',
	})
	if (res.status === 308) return { complete: false }
	const fileId = res.data?.id
	if (!fileId) throw new Error(`Drive closed the upload without a file id (HTTP ${res.status})`)
	return { complete: true, fileId }
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
let lastProbe: { at: number; ok: boolean; detail: string } | null = null

/**
 * Cached form of verifyDriveAccess, used before a recording starts: better to
 * tell the GM up front that Drive is unusable — so the observer records
 * locally — than to stream a whole game into a session that can never close.
 */
export async function ensureStorageUsable(maxAgeMs = 10 * 60 * 1000): Promise<{ ok: boolean; detail: string }> {
	if (lastProbe && lastProbe.ok && Date.now() - lastProbe.at < maxAgeMs) {
		return { ok: lastProbe.ok, detail: lastProbe.detail }
	}
	const res = await verifyDriveAccess()
	lastProbe = { at: Date.now(), ...res }
	return res
}

export async function verifyDriveAccess(): Promise<{ ok: boolean; detail: string }> {
	try {
		const drive = getDrive()
		const mode = usingOAuth() ? 'oauth' : 'service account'

		const about = await drive.about.get({ fields: 'user(emailAddress),storageQuota(limit,usage)' })
		const email = about.data.user?.emailAddress ?? 'unknown'
		const quota = about.data.storageQuota
		const freeGb = quota?.limit
			? ((Number(quota.limit) - Number(quota.usage ?? 0)) / 1073741824).toFixed(1) + ' GB free'
			: 'no quota of its own'

		const folderId = await resolveFolderId()
		if (!folderId) return { ok: false, detail: `${mode} as ${email}, but no writable folder` }

		// Actually write something. Reading the account tells us nothing about
		// whether it may store files — a service account passes every read and
		// then fails every upload with storageQuotaExceeded.
		const probe = await drive.files.create({
			requestBody: { name: '.gos-storage-check', parents: [folderId] },
			media: { mimeType: 'text/plain', body: 'ok' },
			fields: 'id',
			supportsAllDrives: true,
		})
		if (probe.data.id) await deleteFile(probe.data.id).catch(() => undefined)

		return { ok: true, detail: `${mode} as ${email}, ${freeGb}, folder ${folderId}` }
	} catch (err) {
		return { ok: false, detail: driveErrorReason(err) }
	}
}
