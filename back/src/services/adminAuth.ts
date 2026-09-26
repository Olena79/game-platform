import crypto from 'crypto'
import { promisify } from 'util'

const pbkdf2 = promisify(crypto.pbkdf2)

/**
 * Getting into the admin panel takes three things in a row:
 *  1. being signed in as the account ADMIN_EMAIL names;
 *  2. the passphrase, of which the server keeps only a PBKDF2 hash
 *     (ADMIN_PASSPHRASE_HASH = "pbkdf2$<iterations>$<salt b64>$<hash b64>");
 *  3. a six-digit code the bot sends to the administrator's Telegram.
 *
 * The session that results lives in this process's memory for an hour — a
 * restart signs the administrator out, which is the safe direction. Five
 * failures lock the door for an hour. The hidden button on the site only
 * saves looking for a URL; it protects nothing by itself.
 */

export const ADMIN_SESSION_TTL_MS = 60 * 60 * 1000
export const ADMIN_CODE_TTL_MS = 5 * 60 * 1000
export const MAX_FAILURES = 5
export const LOCKOUT_MS = 60 * 60 * 1000

/** The same normalisation as the snippet that made the hash (NFC, trimmed). */
export function normalisePassphrase(p: string): string {
	return p.normalize('NFC').trim()
}

export async function verifyPassphrase(passphrase: string, stored: string | undefined = process.env.ADMIN_PASSPHRASE_HASH): Promise<boolean> {
	if (!stored) return false
	const parts = stored.trim().split('$')
	if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
	const iterations = Number(parts[1])
	if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) return false
	const salt = Buffer.from(parts[2], 'base64')
	const expected = Buffer.from(parts[3], 'base64')
	if (salt.length < 8 || expected.length !== 32) return false
	const actual = await pbkdf2(normalisePassphrase(passphrase), salt, iterations, 32, 'sha256')
	return crypto.timingSafeEqual(actual, expected)
}

/** Makes a hash in the stored format — for tests and the npm script. */
export async function hashPassphrase(passphrase: string, iterations = 600_000): Promise<string> {
	const salt = crypto.randomBytes(16)
	const hash = await pbkdf2(normalisePassphrase(passphrase), salt, iterations, 32, 'sha256')
	return `pbkdf2$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function isAdminConfigured(): boolean {
	return !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSPHRASE_HASH)
}

// ── State: one administrator, one process ───────────────────────────────────

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex')

let failures: number[] = []
let pendingCode: { userId: string; hash: string; expiresAt: number; tries: number } | null = null
const sessions = new Map<string, { userId: string; expiresAt: number }>()   // sha(token) → session

export function lockedUntil(now = Date.now()): number | null {
	failures = failures.filter(t => now - t < LOCKOUT_MS)
	return failures.length >= MAX_FAILURES ? failures[0] + LOCKOUT_MS : null
}

export function recordFailure(now = Date.now()): void {
	failures.push(now)
}

/** Step 2 passed: a code to send. Replaces any code sent before. */
export function issueCode(userId: string): string {
	const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
	pendingCode = { userId, hash: sha(code), expiresAt: Date.now() + ADMIN_CODE_TTL_MS, tries: 0 }
	return code
}

export type CodeCheck = 'ok' | 'wrong' | 'expired'

/** Step 3. A code works once; three wrong tries spend it. */
export function checkCode(userId: string, code: string): CodeCheck {
	const pending = pendingCode
	if (!pending || pending.userId !== userId || pending.expiresAt < Date.now()) {
		pendingCode = null
		return 'expired'
	}
	const given = sha(String(code).trim())
	if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(pending.hash))) {
		pending.tries++
		if (pending.tries >= 3) pendingCode = null
		return 'wrong'
	}
	pendingCode = null
	return 'ok'
}

export function openSession(userId: string): { token: string; expiresAt: number } {
	const token = crypto.randomBytes(32).toString('base64url')
	const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS
	sessions.set(sha(token), { userId, expiresAt })
	return { token, expiresAt }
}

/** The session behind a token, if it is still good and was opened by this user. */
export function sessionFor(token: string | undefined, userId: string | undefined): { expiresAt: number } | null {
	if (!token || !userId) return null
	const key = sha(token)
	const s = sessions.get(key)
	if (!s) return null
	if (s.expiresAt < Date.now()) { sessions.delete(key); return null }
	if (s.userId !== userId) return null
	return { expiresAt: s.expiresAt }
}

export function closeSession(token: string | undefined): void {
	if (token) sessions.delete(sha(token))
}

/** For tests. */
export function resetAdminAuthState(): void {
	failures = []
	pendingCode = null
	sessions.clear()
}
