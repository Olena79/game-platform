import logger from '../config/logger'
import { Router, Response } from 'express'
import { Types } from 'mongoose'
import { Game } from '../models/Game'
import { GameLike } from '../models/GameLike'
import { User } from '../models/User'
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/authMiddleware'
import { sendGameCodeToTelegram, sendGameReminderToTelegram } from '../services/telegramBot'
import { validateBody, validateParams } from '../middleware/validationMiddleware'
import { createGameSchema, updateGameSchema, gameIdSchema, gameCodeSchema } from '../validation/schemas'
const router = Router()

// Strip full card number from any response that goes outside the owner context.
// Returns hasGmCard (bool) and gmCardLast4 so the UI can show a "donate" button
// without ever sending the raw PAN to the client.
function publicGameView(game: { toObject(): Record<string, unknown> }) {
	const obj = game.toObject()
	const card = obj.gmCardNumber as string | undefined
	delete obj.gmCardNumber
	return {
		...obj,
		hasGmCard:   !!(card && card.length === 16),
		gmCardLast4: card && card.length === 16 ? card.slice(-4) : '',
	}
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
async function generateUniqueCode(): Promise<string> {
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
		const exists = await Game.findOne({ gameCode: code })
		if (!exists) return code
	}
	throw new Error('Could not generate a unique code after 20 attempts')
}

// GET /api/games/resolve/:code — resolve any code (player or spectator) to gameCode
router.get('/resolve/:code', validateParams(gameCodeSchema), async (req, res: Response): Promise<void> => {
	try {
		const code = req.params.code.toUpperCase()
		const byGameCode = await Game.findOne({ gameCode: code })
		if (byGameCode) { res.json({ gameCode: byGameCode.gameCode, isSpectator: false }); return }
		const bySpectatorCode = await Game.findOne({ spectatorCode: code })
		if (bySpectatorCode) { res.json({ gameCode: bySpectatorCode.gameCode, isSpectator: true }); return }
		res.status(404).json({ message: 'Code not found' })
	} catch (err: any) {
		logger.error('[games/resolve]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games — публічний список з likesCount та isLiked (якщо авторизований)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const games = await Game.find().sort({ createdAt: -1 })

		let likedSet = new Set<string>()
		if (req.userId) {
			const likedIds = await GameLike.find({ userId: req.userId }).distinct('gameId')
			likedSet = new Set(likedIds.map(id => String(id)))
		}

		res.json(games.map(g => {
			const obj = g.toObject() as any
			const card = obj.gmCardNumber as string | undefined
			delete obj.gmCardNumber
			return {
				...obj,
				isLiked:    likedSet.has(String(g._id)),
				hasGmCard:  !!(card && card.length === 16),
				gmCardLast4: (card && card.length === 16) ? card.slice(-4) : '',
			}
		}))
	} catch (err: any) {
		logger.error('[games GET]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/code/:code — get game by gameCode (public — card number stripped)
router.get('/code/:code', validateParams(gameCodeSchema), async (req, res: Response): Promise<void> => {
	try {
		const game = await Game.findOne({ gameCode: req.params.code })
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		res.json(publicGameView(game))
	} catch (err: any) {
		logger.error('[games/code]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/:id — публічна карта гри (card number stripped)
router.get('/:id', async (req, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		res.json(publicGameView(game))
	} catch (err: any) {
		logger.error('[games/:id GET]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/:id/payment-details
router.get('/:id/payment-details', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
		const game = await Game.findById(req.params.id)
			.select('gmCardNumber participationCost creatorId registeredPlayers spectators')
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		const uid          = String(req.userId)
		const isCreator    = String(game.creatorId) === uid
		const isRegistered = game.registeredPlayers.some(p => String(p.userId) === uid)
		const isSpectator  = game.spectators.some(p => String(p.userId) === uid)

		if (!isCreator && !isRegistered && !isSpectator) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const card    = game.gmCardNumber || ''
		const hasCard = card.length === 16

		res.json({
			gmCardNumber:      card,
			gmCardFormatted:   hasCard ? card.replace(/(\d{4})(?=\d)/g, '$1 ') : '',
			hasGmCard:         hasCard,
			participationCost: game.participationCost || 0,
		})
	} catch (err: any) {
		logger.error('[games/:id/payment-details]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/:id/edit — перевірка прав + дані для редагування
router.get('/:id/edit', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}
		res.json(game)
	} catch (err: any) {
		logger.error('[games/:id/edit]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games — створити гру
router.post('/', authMiddleware, validateBody(createGameSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const user = await User.findById(req.userId)
		if (!user) { res.status(404).json({ message: 'User not found' }); return }

		const { title, description } = req.body

		const gameCode      = await generateUniqueCode()
		const spectatorCode = await generateUniqueCode()

		const game = await Game.create({
			title:              title.trim(),
			creatorId:          req.userId,
			creatorName:        user.name || user.email,
			gameCode,
			spectatorCode,
			description:        description ? String(description).slice(0, 500) : '',
		})

		res.status(201).json(publicGameView(game))
	} catch (err: any) {
		logger.error('[games POST]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// PUT /api/games/:id — оновити гру (тільки автор)
router.put('/:id', authMiddleware, validateParams(gameIdSchema), validateBody(updateGameSchema), async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const { title, description } = req.body

		if (title !== undefined)       game.title = title
		if (description !== undefined) game.description = description

		await game.save()
		res.json(publicGameView(game))
	} catch (err: any) {
		logger.error('[games PUT]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id — видалити гру (тільки автор)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}
		await Game.deleteOne({ _id: game._id })
		res.json({ ok: true })
	} catch (err: any) {
		logger.error('[games/:id DELETE]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games/:id/register — зареєструватися на гру
router.post('/:id/register', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
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
			name: user.name || 'User',
			surname: user.surname || '',
			registeredAt: new Date(),
		})
		await game.save()

		const gmUser = await User.findById(game.creatorId)

		// Send Telegram notification if user has Telegram connected
		if (user.telegramChatId) {
			sendGameCodeToTelegram(
				user.telegramChatId,
				game.gameCode,
				game.title,
				'player',
				user.language || 'uk'
			).catch(err => logger.error('[telegram game code]', err))
		}


		res.json({ gameCode: game.gameCode, registeredPlayers: game.registeredPlayers })
	} catch (err: any) {
		logger.error('[games/:id/register]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id/register — анулювати реєстрацію
router.delete('/:id/register', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
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
	} catch (err: any) {
		logger.error('[games/:id/register DELETE]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games/:id/register-spectator — зареєструватися глядачем
router.post('/:id/register-spectator', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
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
			name: user.name || 'User',
			surname: user.surname || '',
			registeredAt: new Date(),
		})
		await game.save()

		const gmUser = await User.findById(game.creatorId)

		// Send Telegram notification if user has Telegram connected
		if (user.telegramChatId) {
			sendGameCodeToTelegram(
				user.telegramChatId,
				game.spectatorCode,
				game.title,
				'spectator',
				user.language || 'uk'
			).catch(err => logger.error('[telegram spectator code]', err))
		}

		res.json({ spectators: game.spectators, spectatorCode: game.spectatorCode })
	} catch (err: any) {
		logger.error('[games/:id/register-spectator]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id/register-spectator — скасувати реєстрацію глядача
router.delete('/:id/register-spectator', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		const idx = game.spectators.findIndex(p => String(p.userId) === String(req.userId))
		if (idx === -1) { res.status(400).json({ message: 'NOT_REGISTERED' }); return }

		game.spectators.splice(idx, 1)
		await game.save()
		res.json({ spectators: game.spectators })
	} catch (err: any) {
		logger.error('[games/:id/register-spectator DELETE]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// POST /api/games/:id/like — поставити лайк
router.post('/:id/like', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { id } = req.params
		if (!Types.ObjectId.isValid(id)) { res.status(400).json({ message: 'Invalid ID' }); return }

		const game = await Game.findById(id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }

		try {
			await GameLike.create({ userId: req.userId, gameId: id })
		} catch (e: any) {
			if (e.code === 11000) {
				res.json({ likesCount: game.likesCount, isLiked: true })
				return
			}
			throw e
		}

		const updated = await Game.findByIdAndUpdate(id, { $inc: { likesCount: 1 } }, { new: true })
		res.json({ likesCount: updated!.likesCount, isLiked: true })
	} catch (err: any) {
		logger.error('[games/:id/like]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

// DELETE /api/games/:id/like — прибрати лайк
router.delete('/:id/like', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		const { id } = req.params
		if (!Types.ObjectId.isValid(id)) { res.status(400).json({ message: 'Invalid ID' }); return }

		const result = await GameLike.deleteOne({ userId: req.userId, gameId: id })
		if (result.deletedCount === 0) {
			const game = await Game.findById(id)
			res.json({ likesCount: game?.likesCount ?? 0, isLiked: false })
			return
		}

		const updated = await Game.findByIdAndUpdate(
			id,
			[{ $set: { likesCount: { $max: [0, { $subtract: ['$likesCount', 1] }] } } }],
			{ new: true },
		)
		res.json({ likesCount: updated!.likesCount, isLiked: false })
	} catch (err: any) {
		logger.error('[games/:id/like DELETE]', err)
		res.status(500).json({ message: 'Server error' })
	}
})

export default router
