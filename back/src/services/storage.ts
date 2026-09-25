import {
	S3Client,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadBucketCommand,
	CreateMultipartUploadCommand,
	UploadPartCommand,
	CompleteMultipartUploadCommand,
	AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Upload } from 'livekit-server-sdk'

/**
 * Where game recordings live: a Cloudflare R2 bucket.
 *
 * Two writers: the gamemaster's browser, through a multipart upload this
 * server relays part by part, or LiveKit Egress, which writes the file there
 * itself. Either way this server signs links to the file and deletes it when
 * it expires.
 *
 * R2 speaks the S3 API, so everything here is plain S3 with a custom endpoint.
 */
const {
	R2_ACCOUNT_ID,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_BUCKET,
	// Only for local testing against an S3 emulator; production leaves it unset
	R2_ENDPOINT,
} = process.env

/** A signed link cannot outlive this (SigV4 rule), which matches the 7-day expiry. */
export const MAX_LINK_SECONDS = 7 * 24 * 60 * 60

export function isStorageConfigured(): boolean {
	return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET)
}

function endpoint(): string {
	return R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
}

let client: S3Client | null = null
function s3(): S3Client {
	if (!isStorageConfigured()) throw new Error('Recording storage is not configured (R2_* variables)')
	if (!client) {
		client = new S3Client({
			region: 'auto',
			endpoint: endpoint(),
			credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
			forcePathStyle: Boolean(R2_ENDPOINT),
		})
	}
	return client
}

/** What Egress needs to upload the finished file into the bucket. */
export function egressUploadTarget(): S3Upload {
	if (!isStorageConfigured()) throw new Error('Recording storage is not configured (R2_* variables)')
	return new S3Upload({
		accessKey: R2_ACCESS_KEY_ID!,
		secret: R2_SECRET_ACCESS_KEY!,
		region: 'auto',
		endpoint: endpoint(),
		bucket: R2_BUCKET!,
		forcePathStyle: true,
	})
}

/**
 * A link anyone can open until `seconds` from now — the club's choice: the
 * gamemaster forwards it to the players. Capped at the 7 days SigV4 allows.
 */
export async function signedDownloadUrl(key: string, seconds: number, filename?: string): Promise<string> {
	const expiresIn = Math.max(60, Math.min(MAX_LINK_SECONDS, Math.floor(seconds)))
	return getSignedUrl(s3(), new GetObjectCommand({
		Bucket: R2_BUCKET!,
		Key: key,
		// Plays in the browser, and saves under a readable name when downloaded
		...(filename ? { ResponseContentDisposition: contentDisposition(filename) } : {}),
	}), { expiresIn })
}

/**
 * A download name that survives Cyrillic: an ASCII fallback for old clients,
 * and the real name in UTF-8 (RFC 5987) for everyone else.
 */
function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^A-Za-z0-9._-]/g, '_')
	return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

// ── Multipart uploads (the browser recorder) ─────────────────────────────────
//
// A recording arrives in parts while the game is played. The parts live in
// the bucket as soon as they are uploaded — not in this server's memory — so
// a restart loses nothing, and an upload whose browser went away can still be
// closed into a playable file from the parts that made it.
//
// R2 wants every part except the last to be at least 5 MiB and all of them
// the same size; the recorder sends parts of exactly RECORDING_PART_SIZE.

export const RECORDING_PART_SIZE = 8 * 1024 * 1024

export async function startMultipartUpload(key: string, contentType: string): Promise<string> {
	const res = await s3().send(new CreateMultipartUploadCommand({ Bucket: R2_BUCKET!, Key: key, ContentType: contentType }))
	if (!res.UploadId) throw new Error('Storage returned no upload id')
	return res.UploadId
}

export async function uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string> {
	const res = await s3().send(new UploadPartCommand({
		Bucket: R2_BUCKET!, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body, ContentLength: body.length,
	}))
	if (!res.ETag) throw new Error('Storage returned no ETag for the part')
	return res.ETag
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>): Promise<void> {
	await s3().send(new CompleteMultipartUploadCommand({
		Bucket: R2_BUCKET!, Key: key, UploadId: uploadId,
		MultipartUpload: { Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })) },
	}))
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
	await s3().send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET!, Key: key, UploadId: uploadId }))
}

/** Deletes the file. Deleting one that is already gone is not an error in S3. */
export async function deleteObject(key: string): Promise<void> {
	await s3().send(new DeleteObjectCommand({ Bucket: R2_BUCKET!, Key: key }))
}

/**
 * Startup probe: a misconfigured bucket should be found in the logs at
 * deploy time, not by a gamemaster pressing "record" in front of the club.
 */
export async function verifyStorageAccess(): Promise<{ ok: boolean; detail: string }> {
	if (!isStorageConfigured()) return { ok: false, detail: 'R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET not set' }
	try {
		await s3().send(new HeadBucketCommand({ Bucket: R2_BUCKET! }))
		return { ok: true, detail: `bucket ${R2_BUCKET}` }
	} catch (err) {
		const e = err as { name?: string; message?: string }
		return { ok: false, detail: `${e.name ?? 'Error'}: ${e.message ?? String(err)}` }
	}
}
