import { Request, Response, NextFunction } from 'express'
import { User } from '../models/User'
import { verifyAccessToken } from '../services/tokenService'

// Fail fast at startup — never fall back to a weak secret in any environment
if (!process.env.JWT_SECRET) {
	throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start safely.')
}

export interface AuthRequest extends Request {
	userId?: string
}

/**
 * Accounts confirmed to exist, their current token version, and when we last
 * looked.
 *
 * An access token is valid for an hour, so without this a deleted account —
 * or one whose password was just reset — keeps working until its last token
 * expires. Checking every request would add a database round-trip to chatty
 * endpoints, so a confirmation is trusted for a minute.
 */
const seenUsers = new Map<string, { at: number; tv: number }>()
const USER_CHECK_TTL_MS = 60_000

export function forgetUser(userId: string): void {
	seenUsers.delete(userId)
}

async function currentTokenVersion(userId: string): Promise<number | null> {
	const seen = seenUsers.get(userId)
	if (seen && Date.now() - seen.at < USER_CHECK_TTL_MS) return seen.tv

	const user = await User.findById(userId).select('tokenVersion blockedAt').lean()
	// A blocked account is treated as gone
	if (!user || user.blockedAt) {
		seenUsers.delete(userId)
		return null
	}
	const tv = user.tokenVersion ?? 0
	seenUsers.set(userId, { at: Date.now(), tv })
	return tv
}

/**
 * The user id behind an access token, or null when the token is invalid,
 * expired, not an access token, or belongs to an account that no longer
 * exists, is blocked, or has since reset its password.
 *
 * A database hiccup does not sign anybody out mid-game: the signature alone
 * is trusted until the database answers again.
 */
export async function authenticateAccessToken(token: string): Promise<string | null> {
	let decoded
	try {
		decoded = verifyAccessToken(token)
	} catch {
		return null
	}
	try {
		const tv = await currentTokenVersion(decoded.id)
		if (tv === null) return null
		if ((decoded.tv ?? 0) !== tv) return null
	} catch {
		// see above
	}
	return decoded.id
}

function bearer(req: Request): string | null {
	const header = req.headers.authorization
	if (!header || !header.startsWith('Bearer ')) return null
	return header.slice('Bearer '.length).trim() || null
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	const token = bearer(req)
	if (!token) {
		res.status(401).json({ message: 'No token provided' })
		return
	}
	const userId = await authenticateAccessToken(token)
	if (!userId) {
		res.status(401).json({ message: 'Invalid or expired token' })
		return
	}
	req.userId = userId
	next()
}

// Like authMiddleware but never blocks — sets req.userId if token is valid, otherwise continues
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
	const token = bearer(req)
	if (token) {
		const userId = await authenticateAccessToken(token)
		if (userId) req.userId = userId
	}
	next()
}
