import https from 'https'
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendWelcomeEmail } from '../services/email'

interface GoogleUserInfo {
	sub: string
	email: string
	name: string
	given_name?: string
	family_name?: string
}

function getUserInfoFromAccessToken(accessToken: string): Promise<GoogleUserInfo> {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: 'www.googleapis.com',
			path: '/oauth2/v3/userinfo',
			headers: { Authorization: `Bearer ${accessToken}` },
		}
		https.get(options, res => {
			let data = ''
			res.on('data', (chunk: Buffer) => { data += chunk.toString() })
			res.on('end', () => {
				if (res.statusCode !== 200) { reject(new Error('Invalid Google token')); return }
				try { resolve(JSON.parse(data) as GoogleUserInfo) }
				catch (e) { reject(e) }
			})
		}).on('error', reject)
	})
}

const router = Router()

// JWT_SECRET is validated at startup inside authMiddleware.ts — safe to assert here
const signToken = (id: string) =>
	jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: '7d' })

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
	try {
		const { name, surname, email, password } = req.body

		if (!name || !email || !password) {
			res.status(400).json({ message: 'All fields are required' })
			return
		}

		const emailExists = await User.findOne({ email })
		if (emailExists) {
			res.status(400).json({ message: 'EMAIL_EXISTS' })
			return
		}

		const hashed = await bcrypt.hash(password, 10)
		const user = await User.create({ name, surname: surname || '', email, password: hashed })
		const token = signToken(String(user._id))

		sendWelcomeEmail(email, name).catch(err =>
			console.error('Welcome email error:', err?.response?.body || err.message),
		)

		res.status(201).json({
			token,
			user: { id: user._id, name: user.name, surname: user.surname, email: user.email },
		})
	} catch (err: any) {
		console.error('[register]', err)
		if (err?.code === 11000) {
			res.status(400).json({ message: 'EMAIL_EXISTS' })
		} else {
			res.status(500).json({ message: 'Server error' })
		}
	}
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password } = req.body
		if (!email || !password) {
			res.status(400).json({ message: 'Email and password are required' })
			return
		}

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

		const token = signToken(String(user._id))
		res.json({
			token,
			user: { id: user._id, name: user.name, surname: user.surname, email: user.email },
		})
	} catch (err) {
		console.error('[login]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/auth/google — sign in / register via Google OAuth (access token)
router.post('/google', async (req: Request, res: Response): Promise<void> => {
	try {
		const { accessToken } = req.body as { accessToken?: string }
		if (!accessToken) { res.status(400).json({ message: 'Google access token required' }); return }

		const info = await getUserInfoFromAccessToken(accessToken)

		let user = await User.findOne({ $or: [{ googleId: info.sub }, { email: info.email }] })

		if (!user) {
			user = await User.create({
				googleId: info.sub,
				name: info.given_name || info.name?.split(' ')[0] || 'User',
				surname: info.family_name || '',
				email: info.email,
				password: '',
			})
			sendWelcomeEmail(info.email, user.name).catch(console.error)
		} else if (!user.googleId) {
			user.googleId = info.sub
			await user.save()
		}

		const token = signToken(String(user._id))
		res.json({ token, user: { id: user._id, name: user.name, surname: user.surname, email: user.email } })
	} catch (err) {
		console.error('[google auth]', err)
		res.status(500).json({ message: 'Server error' })
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
		res.json({ id: user._id, name: user.name, surname: user.surname, email: user.email })
	} catch (err) {
		console.error('[me]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
