import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendWelcomeEmail } from '../services/email'
import { validateBody } from '../middleware/validationMiddleware'
import { registerSchema, loginSchema, googleAuthSchema, refreshTokenSchema } from '../validation/schemas'
import {
	generateAccessToken,
	issueTokenPair,
	refreshAccessToken,
	revokeAllUserTokens,
} from '../services/tokenService'
import logger from '../config/logger'

interface GoogleUserInfo {
	sub: string
	email: string
	name?: string
	given_name?: string
	family_name?: string
}

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID)

async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken,
			audience: process.env.VITE_GOOGLE_CLIENT_ID,
		})
		const payload = ticket.getPayload()
		if (!payload || !payload.email) {
			throw new Error('Invalid Google ID token: missing email')
		}
		return {
			sub: payload.sub || '',
			email: payload.email,
			name: payload.name,
			given_name: payload.given_name,
			family_name: payload.family_name,
		}
	} catch (error) {
		logger.error('[verifyGoogleIdToken]', error instanceof Error ? error.message : String(error))
		throw new Error('Invalid Google ID token')
	}
}

const router = Router()

// POST /api/auth/register
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password, name, surname } = req.body

		const emailExists = await User.findOne({ email })
		if (emailExists) {
			res.status(400).json({ message: 'EMAIL_EXISTS' })
			return
		}

		const hashed = await bcrypt.hash(password, 10)
		const user = await User.create({ email, password: hashed, name, surname, googleId: null })
		const { accessToken, refreshToken } = await issueTokenPair(String(user._id))

		sendWelcomeEmail(email, name || 'User').catch(err =>
			logger.error('[register] Welcome email error', { error: err?.response?.body || err.message }),
		)

		res.status(201).json({
			accessToken,
			refreshToken,
			user: { id: user._id, email: user.email, name: user.name, surname: user.surname },
		})
	} catch (err: any) {
		logger.error('[register]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password } = req.body

		const user = await User.findOne({ email })
		if (!user) {
			res.status(400).json({ message: 'INVALID_CREDENTIALS' })
			return
		}

		const valid = await bcrypt.compare(password, user.password)
		if (!valid) {
			res.status(400).json({ message: 'INVALID_CREDENTIALS' })
			return
		}

		const { accessToken, refreshToken } = await issueTokenPair(String(user._id))
		res.json({
			accessToken,
			refreshToken,
			user: { id: user._id, email: user.email, name: user.name, surname: user.surname },
		})
	} catch (err) {
		logger.error('[login]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/auth/google — sign in / register via Google OAuth (ID token)
router.post('/google', validateBody(googleAuthSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const { token: idToken } = req.body

		const info = await verifyGoogleIdToken(idToken)

		let user = await User.findOne({ $or: [{ googleId: info.sub }, { email: info.email }] })

		if (!user) {
			user = await User.create({
				googleId: info.sub,
				email: info.email,
				name: info.given_name || info.name || '',
				surname: info.family_name || '',
				password: '',
			})
			sendWelcomeEmail(info.email, info.given_name || 'User').catch(err =>
				logger.error('[google auth] Welcome email error', { error: err?.response?.body || err.message }),
			)
		} else if (!user.googleId) {
			user.googleId = info.sub
			if (!user.name) user.name = info.given_name || info.name
			if (!user.surname) user.surname = info.family_name || ''
			await user.save()
		}

		const { accessToken: jwtAccessToken, refreshToken } = await issueTokenPair(String(user._id))
		res.json({
			accessToken: jwtAccessToken,
			refreshToken,
			user: { id: user._id, email: user.email, name: user.name, surname: user.surname },
		})
	} catch (err) {
		logger.error('[google auth]', err)
		res.status(400).json({ message: 'Invalid Google ID token' })
	}
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId).select('-password')
		if (!user) {
			res.status(404).json({ message: 'User not found' })
			return
		}
		res.json({ id: user._id, email: user.email, name: user.name, surname: user.surname })
	} catch (err) {
		logger.error('[me]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/auth/refresh — refresh access token using refresh token
router.post('/refresh', validateBody(refreshTokenSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const { refreshToken } = req.body

		if (!refreshToken) {
			res.status(401).json({ message: 'Refresh token required' })
			return
		}

		const tokens = await refreshAccessToken(refreshToken)

		if (!tokens) {
			res.status(401).json({ message: 'Invalid or expired refresh token' })
			return
		}

		res.json({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		})
	} catch (err) {
		logger.error('[refresh]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/auth/logout — logout user (revoke all refresh tokens)
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { refreshToken } = req.body

		if (refreshToken && req.userId) {
			// Revoke specific refresh token
			await revokeAllUserTokens(req.userId)
		}

		logger.info('User logged out', { userId: req.userId })
		res.json({ message: 'Logged out' })
	} catch (err) {
		logger.error('[logout]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
