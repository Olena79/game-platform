import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()

const signToken = (id: string) =>
	jwt.sign({ id }, process.env.JWT_SECRET || 'changeme', { expiresIn: '7d' })

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
	try {
		const { name, email, password } = req.body
		if (!name || !email || !password) {
			res.status(400).json({ message: 'All fields are required' })
			return
		}

		const exists = await User.findOne({ email })
		if (exists) {
			res.status(400).json({ message: 'Email already in use' })
			return
		}

		const hashed = await bcrypt.hash(password, 10)
		const user = await User.create({ name, email, password: hashed })
		const token = signToken(String(user._id))

		res.status(201).json({
			token,
			user: { id: user._id, name: user.name, email: user.email, role: user.role },
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
			res.status(400).json({ message: 'Invalid credentials' })
			return
		}

		const valid = await bcrypt.compare(password, user.password)
		if (!valid) {
			res.status(400).json({ message: 'Invalid credentials' })
			return
		}

		const token = signToken(String(user._id))
		res.json({
			token,
			user: { id: user._id, name: user.name, email: user.email, role: user.role },
		})
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/auth/me  — перевірка токена, повертає поточного юзера
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId).select('-password')
		if (!user) {
			res.status(404).json({ message: 'User not found' })
			return
		}
		res.json(user)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
