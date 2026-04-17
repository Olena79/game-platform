import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

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
		const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme') as { id: string }
		req.userId = decoded.id
		next()
	} catch {
		res.status(401).json({ message: 'Invalid token' })
	}
}
