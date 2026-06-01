import { Router, Response } from 'express'
import { Types } from 'mongoose'
import { Game } from '../models/Game'
import { GameLike } from '../models/GameLike'
import { User } from '../models/User'
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/authMiddleware'
import { sendRegistrationEmail, sendSpectatorRegistrationEmail, sendNotesEmail } from '../services/email'

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
			const obj = g.toObject() as Record<string, unknown>
			const card = obj.gmCardNumber as string | undefined
			delete obj.gmCardNumber          // never expose full number in list
			return {
				...obj,
				isLiked:    likedSet.has(String(g._id)),
				hasGmCard:  !!(card && card.length === 16),
				gmCardLast4: (card && card.length === 16) ? card.slice(-4) : '',
			}
		}))
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/code/:code — get game by gameCode (public — card number stripped)
router.get('/code/:code', async (req, res: Response): Promise<void> => {
	try {
		const game = await Game.findOne({ gameCode: req.params.code })
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		res.json(publicGameView(game))
	} catch {
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
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// GET /api/games/:id/payment-details
// Returns the full card number for manual bank-transfer donations.
// Access rules:
//   - creator    → always (they own the card)
//   - registered player / spectator → yes (they need the number to send money)
//   - any other authenticated user  → 403
//   - unauthenticated               → 401 (authMiddleware)
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
			gmCardNumber:      card,                                               // full PAN — only reaches authorised participants
			gmCardFormatted:   hasCard ? card.replace(/(\d{4})(?=\d)/g, '$1 ') : '', // "1234 5678 9012 3456"
			hasGmCard:         hasCard,
			participationCost: game.participationCost || 0,
		})
	} catch {
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
			coverImage, images, participationCost, gmCardNumber, defaultTimerSeconds,
		} = req.body

		if (!title || !String(title).trim()) {
			res.status(400).json({ message: 'Title is required' })
			return
		}

		// Sanitize card number: keep digits only, must be exactly 16
		const rawCard     = String(gmCardNumber || '').replace(/\D/g, '')
		const storedCard  = rawCard.length === 16 ? rawCard : ''

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
			participationCost:  Math.max(0, Number(participationCost) || 0),
			gmCardNumber:       storedCard,
			scheduledAt:        scheduledAt ? new Date(scheduledAt) : undefined,
			coverImage:          coverImage || '',
			images:              Array.isArray(images) ? images.slice(0, 10) : [],
			defaultTimerSeconds: Number(defaultTimerSeconds) > 0 ? Number(defaultTimerSeconds) : null,
		})

		// Never return the raw card in the HTTP response — client uses /card endpoint when needed
		res.status(201).json(publicGameView(game))
	} catch {
		res.status(500).json({ message: 'Server error' })
	}
})

// PUT /api/games/:id — оновити гру (тільки автор)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
	try {
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
		const game = await Game.findById(req.params.id)
		if (!game) { res.status(404).json({ message: 'Game not found' }); return }
		if (String(game.creatorId) !== String(req.userId)) {
			res.status(403).json({ message: 'FORBIDDEN' })
			return
		}

		const {
			title, description, minPlayers, maxPlayers, scenario,
			useCoins, coinsPerPlayer, useInfluence, influencePerPlayer, scheduledAt,
			coverImage, images, participationCost, gmCardNumber, defaultTimerSeconds,
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
		if (participationCost !== undefined) {
			game.participationCost = Math.max(0, Number(participationCost) || 0)
		}
		if (gmCardNumber !== undefined) {
			const rawCard = String(gmCardNumber).replace(/\D/g, '')
			game.gmCardNumber = rawCard.length === 16 ? rawCard : ''
		}
		if (scheduledAt !== undefined) {
			game.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined
		}
		if (coverImage !== undefined) game.coverImage = coverImage
		if (images !== undefined)     game.images = Array.isArray(images) ? images.slice(0, 10) : []
		if (defaultTimerSeconds !== undefined) {
			game.defaultTimerSeconds = Number(defaultTimerSeconds) > 0 ? Number(defaultTimerSeconds) : null
		}

		await game.save()
		// Never return the raw card in the HTTP response — client uses /card endpoint when needed
		res.json(publicGameView(game))
	} catch {
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
	} catch {
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
	} catch {
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
		if (!Types.ObjectId.isValid(req.params.id)) { res.status(400).json({ message: 'Invalid ID' }); return }
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
				// Already liked — idempotent
				res.json({ likesCount: game.likesCount, isLiked: true })
				return
			}
			throw e
		}

		const updated = await Game.findByIdAndUpdate(id, { $inc: { likesCount: 1 } }, { new: true })
		res.json({ likesCount: updated!.likesCount, isLiked: true })
	} catch {
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
			// Not liked — idempotent
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
