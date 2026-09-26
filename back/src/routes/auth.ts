import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { User } from '../models/User'
import { authMiddleware, AuthRequest, forgetUser } from '../middleware/authMiddleware'
import { forgotPasswordLimiter } from '../middleware/rateLimitMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { registerSchema, loginSchema, googleAuthSchema, refreshTokenSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas'
import {
	issueTokenPair,
	refreshAccessToken,
	revokeAllUserTokens,
	generatePasswordResetToken,
	verifyPasswordResetToken,
} from '../services/tokenService'
import { sendPasswordResetToTelegram } from '../services/telegramBot'
import { noticeNewUser } from '../services/adminNotify'
import logger from '../config/logger'

interface GoogleUserInfo {
	sub: string
	email: string
	name?: string
	given_name?: string
	family_name?: string
}

// Audience is what ties an ID token to THIS app. Without it verifyIdToken
// skips the check entirely and accepts any token Google ever issued, to any
// application — which is a full account takeover through /auth/google.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
if (!GOOGLE_CLIENT_ID) {
	throw new Error('FATAL: GOOGLE_CLIENT_ID is not set — Google sign-in would accept tokens from any app')
}
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken,
			audience: GOOGLE_CLIENT_ID,
		})
		const payload = ticket.getPayload()
		if (!payload || !payload.email) {
			throw new Error('Invalid Google ID token: missing email')
		}
		// Accounts are matched by email below, so an address Google has not
		// verified must not be trusted: whoever registered it with Google
		// without owning it would walk into the real owner's account here.
		if (payload.email_verified !== true) {
			throw new Error('Invalid Google ID token: email not verified')
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
		const language = req.headers['accept-language']?.split(',')[0]?.split('-')[0]?.toLowerCase() || 'uk'

		const emailExists = await User.findOne({ email })
		if (emailExists) {
			res.status(400).json({ message: 'EMAIL_EXISTS' })
			return
		}

		const hashed = await bcrypt.hash(password, 10)
		const user = await User.create({ email, password: hashed, name, surname, googleId: null, language: ['uk', 'en'].includes(language) ? language : 'uk' })
		logger.info('[register] User created', { userId: String(user._id), language: user.language })
		noticeNewUser(user, 'email')
		const { accessToken, refreshToken } = await issueTokenPair(String(user._id), user.tokenVersion ?? 0)


		res.status(201).json({
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				surname: user.surname,
				telegramConnected: !!user.telegramChatId,
			},
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
		// Said only after the right password: nobody learns it from a guess
		if (user.blockedAt) {
			res.status(403).json({ message: 'ACCOUNT_BLOCKED' })
			return
		}

		const { accessToken, refreshToken } = await issueTokenPair(String(user._id), user.tokenVersion ?? 0)
		res.json({
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				surname: user.surname,
				telegramConnected: !!user.telegramChatId,
			},
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
			noticeNewUser(user, 'google')
		} else if (user.blockedAt) {
			res.status(403).json({ message: 'ACCOUNT_BLOCKED' })
			return
		} else if (!user.googleId) {
			user.googleId = info.sub
			if (!user.name) user.name = info.given_name || info.name
			if (!user.surname) user.surname = info.family_name || ''
			await user.save()
		}

		const { accessToken: jwtAccessToken, refreshToken } = await issueTokenPair(String(user._id), user.tokenVersion ?? 0)
		res.json({
			accessToken: jwtAccessToken,
			refreshToken,
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				surname: user.surname,
				telegramConnected: !!user.telegramChatId,
			},
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
		res.json({
			id: user._id,
			email: user.email,
			name: user.name,
			surname: user.surname,
			telegramConnected: !!user.telegramChatId,
		})
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
		// Revoke on the strength of the authenticated request itself: the old
		// code only did so if the client happened to send a refresh token,
		// which the frontend never did, so sessions outlived every logout.
		if (req.userId) await revokeAllUserTokens(req.userId)

		logger.info('User logged out', { userId: req.userId })
		res.json({ message: 'Logged out' })
	} catch (err) {
		logger.error('[logout]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

/**
 * Password recovery.
 *
 * The answer never varies, whatever the email: a different reply for a known
 * address would turn this into a way of asking whether somebody has an
 * account here. Delivery goes over Telegram, the one channel tied to the
 * account that still exists.
 */
router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
	try {
		const user = await User.findOne({ email: req.body.email })
		if (user?.telegramChatId) {
			const resetUrl = `${process.env.CLIENT_URL?.split(',')[0] ?? ''}/auth/reset?token=${generatePasswordResetToken(String(user._id), user.password)}`
			await sendPasswordResetToTelegram(user.telegramChatId, resetUrl, user.language || 'uk')
			logger.info('[forgot-password] reset link sent', { userId: String(user._id) })
		} else if (user) {
			logger.warn('[forgot-password] account has no Telegram linked', { userId: String(user._id) })
		}
		res.json({ ok: true })
	} catch (err) {
		logger.error('[forgot-password]', err)
		res.json({ ok: true })   // still say nothing about the account
	}
})

router.post('/reset-password', validateBody(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		// The token is bound to the password it was issued for, so it stops
		// working the moment that password changes — a link is good once.
		const userId = await verifyPasswordResetToken(req.body.token, async id => {
			const u = await User.findById(id).select('password').lean()
			return u ? u.password ?? '' : null
		})
		if (!userId) { res.status(400).json({ message: 'INVALID_OR_EXPIRED_TOKEN' }); return }

		const password = await bcrypt.hash(req.body.password, 10)
		// Whoever knew the old password is no longer welcome: refresh tokens
		// are revoked, and the version bump retires every access token too.
		await User.updateOne({ _id: userId }, { $set: { password }, $inc: { tokenVersion: 1 } })
		await revokeAllUserTokens(userId)
		forgetUser(userId)

		logger.info('[reset-password] password changed', { userId })
		res.json({ ok: true })
	} catch (err) {
		logger.error('[reset-password]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
