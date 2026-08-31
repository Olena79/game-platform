import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { RefreshToken } from '../models/RefreshToken'
import logger from '../config/logger'

const JWT_SECRET = process.env.JWT_SECRET!
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET is not set.')

const ACCESS_TOKEN_EXPIRY = '1h'
const REFRESH_TOKEN_EXPIRY = '30d'
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

export interface TokenPair {
	accessToken: string
	refreshToken: string
}

export interface DecodedToken {
	id: string
	iat: number
	exp: number
}

/**
 * Generate access token (1h expiry)
 */
export function generateAccessToken(userId: string): string {
	return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

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
		logger.info('Refresh token created', { userId, expiresAt })
		return tokenString
	} catch (err) {
		logger.error('Failed to create refresh token', { userId, error: err })
		throw err
	}
}

/**
 * Issue both access and refresh tokens
 */
export async function issueTokenPair(userId: string): Promise<TokenPair> {
	const accessToken = generateAccessToken(userId)
	const refreshToken = await createRefreshToken(userId)

	return { accessToken, refreshToken }
}

/**
 * Verify and refresh access token using refresh token
 */
export async function refreshAccessToken(refreshTokenString: string): Promise<TokenPair | null> {
	try {
		// Find refresh token in DB
		const storedToken = await RefreshToken.findOne({
			token: refreshTokenString,
			expiresAt: { $gt: new Date() },
		})

		if (!storedToken) {
			logger.warn('Invalid or expired refresh token attempted', { tokenHash: refreshTokenString.slice(0, 8) })
			return null
		}

		// Delete old refresh token
		await RefreshToken.deleteOne({ _id: storedToken._id })

		// Issue new token pair
		const newPair = await issueTokenPair(String(storedToken.userId))
		logger.info('Access token refreshed', { userId: storedToken.userId })

		return newPair
	} catch (err) {
		logger.error('Token refresh failed', { error: err })
		return null
	}
}

/**
 * Revoke refresh token (logout everywhere)
 */
export async function revokeRefreshToken(refreshTokenString: string): Promise<boolean> {
	try {
		const result = await RefreshToken.deleteOne({ token: refreshTokenString })
		if (result.deletedCount > 0) {
			logger.info('Refresh token revoked')
			return true
		}
		return false
	} catch (err) {
		logger.error('Failed to revoke refresh token', { error: err })
		return false
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

/**
 * Verify access token (throws if invalid)
 */
export function verifyAccessToken(token: string): DecodedToken {
	return jwt.verify(token, JWT_SECRET) as DecodedToken
}
