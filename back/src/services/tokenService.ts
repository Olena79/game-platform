import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { RefreshToken } from '../models/RefreshToken'
import { User } from '../models/User'
import logger from '../config/logger'

const JWT_SECRET = process.env.JWT_SECRET!
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET is not set.')

const ACCESS_TOKEN_EXPIRY = '1h'
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000

export interface TokenPair {
	accessToken: string
	refreshToken: string
}

export interface DecodedToken {
	id: string
	/** Token version: bumped on password reset, so older access tokens stop working */
	tv?: number
	iat: number
	exp: number
}

/**
 * Access tokens and single-purpose tokens (password reset) share one secret,
 * so a token is only an access token if it carries no `purpose`. Without this
 * check a reset link that leaked — forwarded chat, shared computer — was a
 * working session for its whole lifetime.
 */
export function verifyAccessToken(token: string): DecodedToken {
	const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken & { purpose?: string }
	if (decoded.purpose !== undefined || !decoded.id) {
		throw new jwt.JsonWebTokenError('not an access token')
	}
	return decoded
}

export function generateAccessToken(userId: string, tokenVersion = 0): string {
	return jwt.sign({ id: userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

// ── Password reset ──────────────────────────────────────────────────────────

/**
 * A fingerprint of the current password hash. The reset token carries it, so
 * the moment the password changes every reset link issued before that stops
 * working — the token is single-use without keeping any state for it.
 */
function passwordFingerprint(passwordHash: string): string {
	return crypto.createHash('sha256').update(passwordHash || 'no-password').digest('base64url').slice(0, 16)
}

/** Single-purpose, half-hour token behind a password reset link. */
export function generatePasswordResetToken(userId: string, passwordHash: string): string {
	return jwt.sign({ id: userId, purpose: 'pwd-reset', pf: passwordFingerprint(passwordHash) }, JWT_SECRET, { expiresIn: '30m' })
}

/** The user id, if the token is a reset token issued for the password the account still has. */
export async function verifyPasswordResetToken(token: string, currentPasswordHash: (userId: string) => Promise<string | null>): Promise<string | null> {
	let decoded: { id?: string; purpose?: string; pf?: string }
	try {
		decoded = jwt.verify(token, JWT_SECRET) as typeof decoded
	} catch {
		return null
	}
	if (decoded.purpose !== 'pwd-reset' || !decoded.id || !decoded.pf) return null
	const hash = await currentPasswordHash(decoded.id)
	if (hash === null) return null
	return decoded.pf === passwordFingerprint(hash) ? decoded.id : null
}

// ── Telegram linking ────────────────────────────────────────────────────────

/**
 * What the Telegram deep link carries.
 *
 * Telegram passes a `start` parameter only if it is at most 64 characters of
 * [A-Za-z0-9_-]; anything else is dropped silently and the bot sees a bare
 * /start. A JWT is ~200 characters with dots, so the old link could never
 * connect anybody. This is 32 random url-safe characters, stored hashed,
 * valid for 15 minutes and good for one use.
 */
export async function createTelegramLinkToken(userId: string): Promise<string> {
	const token = crypto.randomBytes(24).toString('base64url')
	await User.updateOne(
		{ _id: userId },
		{ telegramLinkTokenHash: hashToken(token), telegramLinkExpiresAt: new Date(Date.now() + TELEGRAM_LINK_TTL_MS) },
	)
	return token
}

/** The account the token was issued to, or null. Spends the token either way. */
export async function consumeTelegramLinkToken(token: string): Promise<string | null> {
	if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
	const user = await User.findOneAndUpdate(
		{ telegramLinkTokenHash: hashToken(token) },
		{ $unset: { telegramLinkTokenHash: 1, telegramLinkExpiresAt: 1 } },
	).select('telegramLinkExpiresAt')
	if (!user || !user.telegramLinkExpiresAt || user.telegramLinkExpiresAt < new Date()) return null
	return String(user._id)
}

function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex')
}

// ── Refresh tokens ──────────────────────────────────────────────────────────

/**
 * Generate refresh token string (random + secure)
 */
export function generateRefreshTokenString(): string {
	return crypto.randomBytes(32).toString('hex')
}

/**
 * Create and store refresh token in DB
 */
export async function createRefreshToken(userId: string): Promise<string> {
	const tokenString = generateRefreshTokenString()
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

	try {
		await RefreshToken.create({
			userId,
			token: tokenString,
			expiresAt,
		})
		return tokenString
	} catch (err) {
		logger.error('Failed to create refresh token', { userId, error: err })
		throw err
	}
}

/**
 * Issue both access and refresh tokens
 */
export async function issueTokenPair(userId: string, tokenVersion?: number): Promise<TokenPair> {
	let tv = tokenVersion
	if (tv === undefined) {
		const user = await User.findById(userId).select('tokenVersion').lean()
		tv = user?.tokenVersion ?? 0
	}
	const accessToken = generateAccessToken(userId, tv)
	const refreshToken = await createRefreshToken(userId)

	return { accessToken, refreshToken }
}

/**
 * Verify and refresh access token using refresh token
 */
export async function refreshAccessToken(refreshTokenString: string): Promise<TokenPair | null> {
	try {
		// Taking the token and deleting it is one step, so two tabs refreshing
		// at the same moment cannot both spend it.
		const storedToken = await RefreshToken.findOneAndDelete({
			token: refreshTokenString,
			expiresAt: { $gt: new Date() },
		})

		if (!storedToken) {
			logger.warn('Invalid or expired refresh token attempted')
			return null
		}

		// Blocking revokes refresh tokens too; this covers one issued in between
		const owner = await User.findById(storedToken.userId).select('blockedAt').lean()
		if (!owner || owner.blockedAt) return null

		return await issueTokenPair(String(storedToken.userId))
	} catch (err) {
		logger.error('Token refresh failed', { error: err })
		return null
	}
}

/**
 * Revoke all refresh tokens for user (logout everywhere)
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
	try {
		const result = await RefreshToken.deleteMany({ userId })
		logger.info('All refresh tokens revoked for user', { userId, count: result.deletedCount })
		return result.deletedCount
	} catch (err) {
		logger.error('Failed to revoke user tokens', { userId, error: err })
		return 0
	}
}
