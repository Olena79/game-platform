import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Upload } from 'livekit-server-sdk'

/**
 * Where game recordings live: a Cloudflare R2 bucket.
 *
 * LiveKit Egress writes the file there directly — LiveKit Cloud keeps no
 * recordings of its own, and a request without storage fails. This server
 * only ever signs links to the file and deletes it when it expires.
 *
 * R2 speaks the S3 API, so everything here is plain S3 with a custom endpoint.
 */
const {
	R2_ACCOUNT_ID,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_BUCKET,
} = process.env

/** A signed link cannot outlive this (SigV4 rule), which matches the 7-day expiry. */
export const MAX_LINK_SECONDS = 7 * 24 * 60 * 60

export function isStorageConfigured(): boolean {
	return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET)
}

function endpoint(): string {
	return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
}

let client: S3Client | null = null
function s3(): S3Client {
	if (!isStorageConfigured()) throw new Error('Recording storage is not configured (R2_* variables)')
	if (!client) {
		client = new S3Client({
			region: 'auto',
			endpoint: endpoint(),
			credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
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
export async function signedDownloadUrl(key: string, seconds: number): Promise<string> {
	const expiresIn = Math.max(60, Math.min(MAX_LINK_SECONDS, Math.floor(seconds)))
	return getSignedUrl(s3(), new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key }), { expiresIn })
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
