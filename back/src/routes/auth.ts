import https from 'https'
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendWelcomeEmail } from '../services/email'

interface GoogleTokenPayload {
	sub: string
	email: string
	name: string
	given_name?: string
	family_name?: string
	aud: string
	email_verified: string
}

function verifyGoogleToken(credential: string): Promise<GoogleTokenPayload> {
	return new Promise((resolve, reject) => {
		const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
		https.get(url, res => {
			let data = ''
			res.on('data', (chunk: Buffer) => { data += chunk.toString() })
			res.on('end', () => {
				if (res.statusCode !== 200) { reject(new Error('Invalid Google token')); return }
				try { resolve(JSON.parse(data) as GoogleTokenPayload) }
				catch (e) { reject(e) }
			})
		}).on('error', reject)
	})
}

const router = Router()

const signToken = (id: string) =>
	jwt.sign({ id }, process.env.JWT_SECRET || 'changeme', { expiresIn: '7d' })

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
	try {
		const { name, surname, email, phone, password } = req.body

		if (!name || !email || !phone || !password) {
			res.status(400).json({ message: 'All fields are required' })
			return
		}

		const cleanPhone = String(phone).replace(/\D/g, '')
		if (cleanPhone.length < 10 || cleanPhone.length > 12) {
			res.status(400).json({ message: 'Phone must be 10 digits' })
			return
		}

		const emailExists = await User.findOne({ email })
		if (emailExists) {
			res.status(400).json({ message: 'EMAIL_EXISTS' })
			return
		}

		const phoneExists = await User.findOne({ phone: cleanPhone })
		if (phoneExists) {
			res.status(400).json({ message: 'PHONE_EXISTS' })
			return
		}

		const hashed = await bcrypt.hash(password, 10)
		const user = await User.create({ name, surname: surname || '', email, phone: cleanPhone, password: hashed })
		const token = signToken(String(user._id))

		sendWelcomeEmail(email, name).catch(err =>
			console.error('Welcome email error:', err?.response?.body || err.message),
		)

		res.status(201).json({
			token,
			user: { id: user._id, name: user.name, surname: user.surname, email: user.email, phone: user.phone },
		})
	} catch {
		res.status(500).json({ message: 'Server error' })
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
			user: { id: user._id, name: user.name, surname: user.surname, email: user.email, phone: user.phone },
		})
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/auth/google — sign in / register via Google ID token
// Requires env: GOOGLE_CLIENT_ID
router.post('/google', async (req: Request, res: Response): Promise<void> => {
	try {
		const { credential } = req.body as { credential?: string }
		if (!credential) { res.status(400).json({ message: 'Google credential required' }); return }

		const info = await verifyGoogleToken(credential)

		const expectedClientId = process.env.GOOGLE_CLIENT_ID
		if (expectedClientId && info.aud !== expectedClientId) {
			res.status(401).json({ message: 'GOOGLE_CLIENT_ID_MISMATCH' })
			return
		}

		let user = await User.findOne({ $or: [{ googleId: info.sub }, { email: info.email }] })

		if (!user) {
			user = await User.create({
				googleId: info.sub,
				name: info.given_name || info.name.split(' ')[0] || 'User',
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
		res.json({ token, user: { id: user._id, name: user.name, surname: user.surname, email: user.email, phone: user.phone } })
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
		res.json({ id: user._id, name: user.name, surname: user.surname, email: user.email, phone: user.phone })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
