import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Fail fast at startup — never fall back to a weak secret in any environment
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
	throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start safely.')
}

export interface AuthRequest extends Request {
	userId?: string
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
	const header = req.headers.authorization
	if (!header || !header.startsWith('Bearer ')) {
		res.status(401).json({ message: 'No token provided' })
		return
	}

	const token = header.split(' ')[1]
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
		req.userId = decoded.id
		next()
	} catch {
		// Covers TokenExpiredError, JsonWebTokenError, NotBeforeError
		res.status(401).json({ message: 'Invalid or expired token' })
	}
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
