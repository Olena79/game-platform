import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { exportAccountData, deleteAccount } from '../services/accountDeletion'
import logger from '../config/logger'

const router = Router()

const deleteAccountSchema = z.object({
	// Accounts created through Google have no password to confirm with
	password: z.string().max(200).optional(),
	confirm: z.literal(true),
})

// GET /api/account/export — everything we hold about the caller, as JSON
router.get('/export', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const data = await exportAccountData(String(req.userId))
		res.setHeader('Content-Disposition', 'attachment; filename="games-of-senses-data.json"')
		res.json(data)
	} catch (err) {
		logger.error('[account/export]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

/**
 * DELETE /api/account — erases the caller's account.
 *
 * A password is required when the account has one: this is irreversible, and
 * a forgotten open session should not be able to do it.
 */
router.delete('/', authMiddleware, validateBody(deleteAccountSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId).select('password')
		if (!user) { res.status(404).json({ message: 'User not found' }); return }

		if (user.password) {
			const password = req.body.password ?? ''
			const valid = password ? await bcrypt.compare(password, user.password) : false
			if (!valid) { res.status(403).json({ message: 'INVALID_PASSWORD' }); return }
		}

		const summary = await deleteAccount(String(req.userId))
		res.json({ ok: true, ...summary })
	} catch (err) {
		logger.error('[account DELETE]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
