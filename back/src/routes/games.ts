import { Router, Response } from 'express'
import { Types } from 'mongoose'
import { Game } from '../models/Game'
import { User } from '../models/User'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendRegistrationEmail, sendSpectatorRegistrationEmail, sendNotesEmail } from '../services/email'

const router = Router()

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
async function generateUniqueCode(): Promise<string> {
	while (true) {
		const code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
		const exists = await Game.findOne({ gameCode: code })
		if (!exists) return code
	}
}

// GET /api/games/resolve/:code — resolve any code (player or spectator) to gameCode
router.get('/resolve/:code', async (req, res: Response): Promise<void> => {
	try {
		const code = req.params.code.toUpperCase()
		// Try player code first
		const byGameCode = await Game.findOne({ gameCode: code })
		if (byGameCode) { res.json({ gameCode: byGameCode.gameCode, isSpectator: false }); return }
		// Try spectator code
		const bySpectatorCode = await Game.findOne({ spectatorCode: code })
		if (bySpectatorCode) { res.json({ gameCode: bySpectatorCode.gameCode, isSpectator: true }); return }
		res.status(404).json({ message: 'Code not found' })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games — публічний список
router.get('/', async (_req, res: Response): Promise<void> => {
	try {
		const games = await Game.find().sort({ createdAt: -1 })
		res.json(games)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/code/:code — get game by gameCode
router.get('/code/:code', async (req, res: Response): Promise<void> => {
	try {
		const game = await Game.findOne({ gameCode: req.params.code })
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		res.json(game)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/:id — публічна карта гри
router.get('/:id', async (req, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		res.json(game)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/:id/edit — перевірка прав + дані для редагування
router.get('/:id/edit', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}
		res.json(game)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games — створити гру
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId)
		if (!user) { res.status(404).json({ message: 'User not found' }); return }

		const {
			title, description, minPlayers, maxPlayers, scenario,
			useCoins, coinsPerPlayer, useInfluence, influencePerPlayer, scheduledAt,
			coverImage, images,
		} = req.body

		if (!title || !String(title).trim()) {
			res.status(400).json({ message: 'Title is required' })
			return
		}

		const gameCode      = await generateUniqueCode()
		const spectatorCode = await generateUniqueCode()

		const game = await Game.create({
			title:              String(title).trim(),
			creatorId:          req.userId,
			creatorName:        [user.name, user.surname].filter(Boolean).join(' '),
			gameCode,
			spectatorCode,
			minPlayers:         Number(minPlayers) || 2,
			maxPlayers:         Number(maxPlayers) || 6,
			description:        String(description || '').slice(0, 500),
			scenario:           scenario || '',
			useCoins:           !!useCoins,
			coinsPerPlayer:     useCoins ? (Number(coinsPerPlayer) || 0) : 0,
			useInfluence:       !!useInfluence,
			influencePerPlayer: useInfluence ? (Number(influencePerPlayer) || 0) : 0,
			scheduledAt:        scheduledAt ? new Date(scheduledAt) : undefined,
			coverImage:         coverImage || '',
			images:             Array.isArray(images) ? images.slice(0, 10) : [],
		})

		res.status(201).json(game)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// PUT /api/games/:id — оновити гру (тільки автор)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const {
			title, description, minPlayers, maxPlayers, scenario,
			useCoins, coinsPerPlayer, useInfluence, influencePerPlayer, scheduledAt,
			coverImage, images,
		} = req.body

		if (title !== undefined)       game.title = String(title).trim()
		if (description !== undefined) game.description = String(description).slice(0, 500)
		if (minPlayers !== undefined)  game.minPlayers = Number(minPlayers)
		if (maxPlayers !== undefined)  game.maxPlayers = Number(maxPlayers)
		if (scenario !== undefined)    game.scenario = scenario
		if (useCoins !== undefined) {
			game.useCoins = !!useCoins
			game.coinsPerPlayer = game.useCoins ? (Number(coinsPerPlayer) || 0) : 0
		}
		if (useInfluence !== undefined) {
			game.useInfluence = !!useInfluence
			game.influencePerPlayer = game.useInfluence ? (Number(influencePerPlayer) || 0) : 0
		}
		if (scheduledAt !== undefined) {
			game.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined
		}
		if (coverImage !== undefined) game.coverImage = coverImage
		if (images !== undefined)     game.images = Array.isArray(images) ? images.slice(0, 10) : []

		await game.save()
		res.json(game)
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id — видалити гру (тільки автор)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}
		await Game.deleteOne({ _id: game._id })
		res.json({ ok: true })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games/:id/register — зареєструватися на гру
router.post('/:id/register', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId)
		if (!user) { res.status(404).json({ message: 'User not found' }); return }

		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		if (String(game.creatorId) === String(req.userId)) {
			res.status(400).json({ message: 'CREATOR_CANNOT_REGISTER' })
			return
		}

		const alreadyRegistered = game.registeredPlayers.some(p => String(p.userId) === String(req.userId))
		if (alreadyRegistered) {
			res.status(400).json({ message: 'ALREADY_REGISTERED' })
			return
		}

		if (game.registeredPlayers.length >= game.maxPlayers) {
			res.status(400).json({ message: 'MAX_PLAYERS_REACHED' })
			return
		}

		game.registeredPlayers.push({
			userId: user._id as unknown as Types.ObjectId,
			name: user.name,
			surname: user.surname || '',
			registeredAt: new Date(),
		})
		await game.save()

		// Надіслати лист гравцю (не блокуємо відповідь)
		const playerFullName = [user.name, user.surname].filter(Boolean).join(' ')
		sendRegistrationEmail(user.email, playerFullName, {
			title:              game.title,
			creatorName:        game.creatorName,
			minPlayers:         game.minPlayers,
			maxPlayers:         game.maxPlayers,
			description:        game.description || '',
			useCoins:           game.useCoins,
			coinsPerPlayer:     game.coinsPerPlayer,
			useInfluence:       game.useInfluence,
			influencePerPlayer: game.influencePerPlayer,
			scheduledAt:        game.scheduledAt,
			gameCode:           game.gameCode,
		}).catch(err => console.error('[email] failed to send registration email:', err))

		res.json({ gameCode: game.gameCode, registeredPlayers: game.registeredPlayers })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id/register — анулювати реєстрацію
router.delete('/:id/register', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		const idx = game.registeredPlayers.findIndex(p => String(p.userId) === String(req.userId))
		if (idx === -1) {
			res.status(400).json({ message: 'NOT_REGISTERED' })
			return
		}

		game.registeredPlayers.splice(idx, 1)
		await game.save()
		res.json({ registeredPlayers: game.registeredPlayers })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games/:id/register-spectator — зареєструватися глядачем
router.post('/:id/register-spectator', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId)
		if (!user) { res.status(404).json({ message: 'User not found' }); return }

		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		if (String(game.creatorId) === String(req.userId)) {
			res.status(400).json({ message: 'CREATOR_CANNOT_REGISTER' }); return
		}

		const alreadyPlayer = game.registeredPlayers.some(p => String(p.userId) === String(req.userId))
		if (alreadyPlayer) { res.status(400).json({ message: 'ALREADY_REGISTERED_AS_PLAYER' }); return }

		const alreadySpectator = game.spectators.some(p => String(p.userId) === String(req.userId))
		if (alreadySpectator) { res.status(400).json({ message: 'ALREADY_REGISTERED' }); return }

		game.spectators.push({
			userId: user._id as unknown as Types.ObjectId,
			name: user.name,
			surname: user.surname || '',
			registeredAt: new Date(),
		})
		await game.save()

		const spectatorName = [user.name, user.surname].filter(Boolean).join(' ')
		sendSpectatorRegistrationEmail(user.email, spectatorName, {
			title:         game.title,
			creatorName:   game.creatorName,
			spectatorCode: game.spectatorCode,
			scheduledAt:   game.scheduledAt,
		}).catch(err => console.error('[email] spectator registration email failed:', err))

		res.json({ spectators: game.spectators, spectatorCode: game.spectatorCode })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id/register-spectator — скасувати реєстрацію глядача
router.delete('/:id/register-spectator', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		const idx = game.spectators.findIndex(p => String(p.userId) === String(req.userId))
		if (idx === -1) { res.status(400).json({ message: 'NOT_REGISTERED' }); return }

		game.spectators.splice(idx, 1)
		await game.save()
		res.json({ spectators: game.spectators })
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games/send-notes — send GM notes by email after game ends
router.post('/send-notes', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { notes, gameTitle, gameCode } = req.body as { notes: string; gameTitle: string; gameCode: string }
		if (!notes?.trim()) { res.status(400).json({ message: 'Empty notes' }); return }
		const user = await User.findById(req.userId)
		if (!user) { res.status(404).json({ message: 'User not found' }); return }
		await sendNotesEmail(
			user.email,
			`${user.name}${user.surname ? ' ' + user.surname : ''}`,
			gameTitle || 'Без назви',
			gameCode || '',
			notes.trim(),
		)
		res.json({ ok: true })
	} catch (err) {
		console.error('[send-notes]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
