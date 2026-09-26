import { Response, NextFunction } from 'express'
import { AuthRequest } from './authMiddleware'
import { sessionFor } from '../services/adminAuth'

export const ADMIN_TOKEN_HEADER = 'x-admin-token'

/**
 * After authMiddleware: the request carries an open admin session of this
 * very user. The session was only ever opened for the ADMIN_EMAIL account,
 * after its passphrase and its Telegram code.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
	const token = req.header(ADMIN_TOKEN_HEADER) || undefined
	if (!sessionFor(token, req.userId)) {
		res.status(401).json({ message: 'ADMIN_SESSION_REQUIRED' })
		return
	}
	next()
}
