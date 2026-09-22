import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'

// Fail fast at startup — never fall back to a weak secret in any environment
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
	throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start safely.')
}

export interface AuthRequest extends Request {
	userId?: string
}

/**
 * Accounts confirmed to exist, and when we last looked.
 *
 * An access token is valid for an hour, so without this a deleted account
 * keeps working until its last token expires. Checking every request would
 * add a database round-trip to chatty endpoints like the recording upload, so
 * a confirmation is trusted for a minute.
 */
const seenUsers = new Map<string, number>()
const USER_CHECK_TTL_MS = 60_000

export function forgetUser(userId: string): void {
	seenUsers.delete(userId)
}

async function userStillExists(userId: string): Promise<boolean> {
	const seenAt = seenUsers.get(userId)
	if (seenAt && Date.now() - seenAt < USER_CHECK_TTL_MS) return true

	const exists = await User.exists({ _id: userId })
	if (!exists) {
		seenUsers.delete(userId)
		return false
	}
	seenUsers.set(userId, Date.now())
	return true
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	const header = req.headers.authorization
	if (!header || !header.startsWith('Bearer ')) {
		res.status(401).json({ message: 'No token provided' })
		return
	}

	const token = header.split(' ')[1]
	let userId: string
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
		userId = decoded.id
	} catch {
		// Covers TokenExpiredError, JsonWebTokenError, NotBeforeError
		res.status(401).json({ message: 'Invalid or expired token' })
		return
	}

	try {
		if (!(await userStillExists(userId))) {
			res.status(401).json({ message: 'Account no longer exists' })
			return
		}
	} catch {
		// A database hiccup should not sign everybody out mid-game
	}

	req.userId = userId
	next()
}

// Like authMiddleware but never blocks — sets req.userId if token is valid, otherwise continues
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
	const header = req.headers.authorization
	if (header?.startsWith('Bearer ')) {
		const token = header.split(' ')[1]
		try {
			const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
			req.userId = decoded.id
		} catch {
			// Invalid/expired token — treat as unauthenticated, continue without blocking
		}
	}
	next()
}
