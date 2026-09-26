import { Router, Response } from 'express'
import { Server } from 'socket.io'
import { Types } from 'mongoose'
import { z } from 'zod'
import logger from '../config/logger'
import { authMiddleware, AuthRequest, forgetUser } from '../middleware/authMiddleware'
import { requireAdmin, ADMIN_TOKEN_HEADER } from '../middleware/adminMiddleware'
import { validateBody } from '../middleware/validationMiddleware'
import { User } from '../models/User'
import { Game } from '../models/Game'
import { Post } from '../models/Post'
import { Comment } from '../models/Comment'
import { Recording } from '../models/Recording'
import { AdminLog } from '../models/AdminLog'
import {
	checkCode, closeSession, isAdminConfigured, issueCode, lockedUntil,
	openSession, recordFailure, sessionFor, verifyPassphrase,
} from '../services/adminAuth'
import { adminEmail, isAdminUser, notifyAdmin } from '../services/adminNotify'
import { broadcastToAll, escapeHtml } from '../services/telegramBot'
import { revokeAllUserTokens } from '../services/tokenService'
import { deleteAccount } from '../services/accountDeletion'
import { deleteGame } from '../services/gameDeletion'
import { deleteRecording } from '../services/recording'
import { endRoomAsAdmin, kickUser, listRooms } from '../socket/gameRoom'

const COMMUNITY_ROOM = 'room:community'

const passphraseSchema = z.object({ passphrase: z.string().min(1).max(1000) })
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) })
const blockSchema = z.object({ reason: z.string().max(500).optional() })
const broadcastSchema = z.object({ text: z.string().trim().min(1).max(3500) })

const isId = (v: string) => Types.ObjectId.isValid(v) && String(new Types.ObjectId(v)) === v

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function log(req: AuthRequest, action: string, target = '', detail = ''): Promise<void> {
	await AdminLog.create({ action, target, detail: detail.slice(0, 1000), ip: req.ip ?? '' }).catch(err => {
		logger.warn('[admin] log entry not written', { error: err instanceof Error ? err.message : String(err) })
	})
}

function personName(u: { name?: string; surname?: string; email?: string }): string {
	return [u.name, u.surname].filter(Boolean).join(' ') || (u.email ?? '').split('@')[0]
}

export default function makeAdminRouter(io: Server): Router {
	const router = Router()

	// ── Getting in ──────────────────────────────────────────────────────────
	// Everything here answers 404 to anyone but the administrator's account,
	// so the panel does not even show that it exists.

	router.post('/login', authMiddleware, validateBody(passphraseSchema), async (req: AuthRequest, res: Response) => {
		try {
			if (!isAdminConfigured() || !(await isAdminUser(req.userId))) {
				res.status(404).json({ message: 'Not found' })
				return
			}
			const until = lockedUntil()
			if (until) { res.status(429).json({ message: 'LOCKED', until }); return }

			if (!(await verifyPassphrase(req.body.passphrase))) {
				recordFailure()
				await log(req, 'login-failed', '', 'wrong passphrase')
				void notifyAdmin(`⚠️ <b>Невдала спроба входу в адмінку</b> — невірна фраза.\nIP: ${escapeHtml(req.ip ?? '?')}\nЯкщо це були не ви — змініть пароль акаунта.`)
				res.status(401).json({ message: 'WRONG_PASSPHRASE', locked: !!lockedUntil() })
				return
			}

			const admin = await User.findById(req.userId).select('telegramChatId').lean()
			if (!admin?.telegramChatId) { res.status(409).json({ message: 'NO_TELEGRAM' }); return }

			const code = issueCode(String(req.userId))
			const delivered = await notifyAdmin(`🔐 Код входу в адмінку: <code>${code}</code>\nДіє 5 хвилин. Якщо це не ви — нікому його не кажіть і змініть пароль акаунта.`)
			if (!delivered) { res.status(502).json({ message: 'CODE_NOT_SENT' }); return }
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/login]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.post('/verify', authMiddleware, validateBody(codeSchema), async (req: AuthRequest, res: Response) => {
		try {
			if (!isAdminConfigured() || !(await isAdminUser(req.userId))) {
				res.status(404).json({ message: 'Not found' })
				return
			}
			const until = lockedUntil()
			if (until) { res.status(429).json({ message: 'LOCKED', until }); return }

			const result = checkCode(String(req.userId), req.body.code)
			if (result !== 'ok') {
				recordFailure()
				await log(req, 'login-failed', '', result === 'expired' ? 'code expired' : 'wrong code')
				res.status(401).json({ message: result === 'expired' ? 'CODE_EXPIRED' : 'WRONG_CODE', locked: !!lockedUntil() })
				return
			}
			const session = openSession(String(req.userId))
			await log(req, 'login')
			void notifyAdmin(`✅ Вхід в адмінку виконано.\nIP: ${escapeHtml(req.ip ?? '?')}`)
			res.json(session)
		} catch (err) {
			logger.error('[admin/verify]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.get('/session', authMiddleware, (req: AuthRequest, res: Response) => {
		const s = sessionFor(req.header(ADMIN_TOKEN_HEADER) || undefined, req.userId)
		if (!s) { res.status(401).json({ message: 'ADMIN_SESSION_REQUIRED' }); return }
		res.json({ ok: true, expiresAt: s.expiresAt })
	})

	router.post('/logout', authMiddleware, (req: AuthRequest, res: Response) => {
		closeSession(req.header(ADMIN_TOKEN_HEADER) || undefined)
		res.json({ ok: true })
	})

	// Everything below needs an open admin session
	router.use(authMiddleware, requireAdmin)

	// ── Overview ────────────────────────────────────────────────────────────
	router.get('/stats', async (_req: AuthRequest, res: Response) => {
		try {
			const now = new Date()
			const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
			const [users, telegram, blocked, muted, newUsers, games, upcoming, posts, comments, recordings, bytes] = await Promise.all([
				User.countDocuments(),
				User.countDocuments({ telegramChatId: { $exists: true, $nin: [null, ''] } }),
				User.countDocuments({ blockedAt: { $ne: null } }),
				User.countDocuments({ communityMuted: true }),
				User.countDocuments({ createdAt: { $gte: weekAgo } }),
				Game.countDocuments(),
				Game.countDocuments({ scheduledAt: { $gte: now } }),
				Post.countDocuments(),
				Comment.countDocuments(),
				Recording.countDocuments({ status: { $ne: 'failed' } }),
				Recording.aggregate([{ $match: { status: { $ne: 'failed' } } }, { $group: { _id: null, total: { $sum: '$uploadedBytes' } } }]),
			])
			const rooms = listRooms()
			res.json({
				users, telegram, blocked, muted, newUsers,
				games, upcoming, posts, comments,
				recordings, recordingBytes: bytes[0]?.total ?? 0,
				openRooms: rooms.length,
				activeRooms: rooms.filter(r => r.status === 'started').length,
			})
		} catch (err) {
			logger.error('[admin/stats]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Members ─────────────────────────────────────────────────────────────
	router.get('/users', async (req: AuthRequest, res: Response) => {
		try {
			const q = String(req.query.q ?? '').trim().slice(0, 100)
			const filter = String(req.query.filter ?? '')
			const where: Record<string, unknown> = {}
			if (q) {
				const rx = new RegExp(escapeRegex(q), 'i')
				where.$or = [{ name: rx }, { surname: rx }, { email: rx }]
			}
			if (filter === 'blocked') where.blockedAt = { $ne: null }
			if (filter === 'muted') where.communityMuted = true
			if (filter === 'no-telegram') where.telegramChatId = { $in: [null, ''] }

			const users = await User.find(where)
				.select('name surname email googleId telegramChatId blockedAt blockReason communityMuted newsOptOut createdAt')
				.sort({ createdAt: -1 }).limit(300).lean()
			const ids = users.map(u => u._id)
			const [created, played] = await Promise.all([
				Game.aggregate([{ $match: { creatorId: { $in: ids } } }, { $group: { _id: '$creatorId', n: { $sum: 1 } } }]),
				Game.aggregate([
					{ $match: { $or: [{ 'registeredPlayers.userId': { $in: ids } }, { 'spectators.userId': { $in: ids } }] } },
					{ $project: { who: { $setUnion: ['$registeredPlayers.userId', '$spectators.userId'] } } },
					{ $unwind: '$who' },
					{ $match: { who: { $in: ids } } },
					{ $group: { _id: '$who', n: { $sum: 1 } } },
				]),
			])
			const count = (rows: Array<{ _id: unknown; n: number }>) => new Map(rows.map(r => [String(r._id), r.n]))
			const createdBy = count(created)
			const playedBy = count(played)
			const admin = adminEmail()

			res.json(users.map(u => ({
				id: String(u._id),
				name: u.name ?? '',
				surname: u.surname ?? '',
				email: u.email,
				google: !!u.googleId,
				telegram: !!u.telegramChatId,
				newsOptOut: !!u.newsOptOut,
				blockedAt: u.blockedAt ?? null,
				blockReason: u.blockReason ?? '',
				communityMuted: !!u.communityMuted,
				createdAt: u.createdAt,
				gamesCreated: createdBy.get(String(u._id)) ?? 0,
				gamesJoined: playedBy.get(String(u._id)) ?? 0,
				isAdmin: u.email.toLowerCase() === admin,
			})))
		} catch (err) {
			logger.error('[admin/users]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	/** The member, if the id is valid, exists, and is not the administrator. */
	async function targetUser(req: AuthRequest, res: Response) {
		const id = String(req.params.id)
		if (!isId(id)) { res.status(400).json({ message: 'Invalid ID' }); return null }
		const user = await User.findById(id)
		if (!user) { res.status(404).json({ message: 'Not found' }); return null }
		if (user.email.toLowerCase() === adminEmail()) { res.status(400).json({ message: 'NOT_ON_ADMIN' }); return null }
		return user
	}

	router.post('/users/:id/block', validateBody(blockSchema), async (req: AuthRequest, res: Response) => {
		try {
			const user = await targetUser(req, res)
			if (!user) return
			user.blockedAt = new Date()
			user.blockReason = (req.body.reason ?? '').trim()
			// Every session ends now: access tokens by version, refresh tokens by deletion
			user.tokenVersion = (user.tokenVersion ?? 0) + 1
			await user.save()
			await revokeAllUserTokens(String(user._id))
			forgetUser(String(user._id))
			await kickUser(String(user._id))
			await log(req, 'block', `user:${user._id}`, `${personName(user)} <${user.email}>${user.blockReason ? ' — ' + user.blockReason : ''}`)
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/block]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.post('/users/:id/unblock', async (req: AuthRequest, res: Response) => {
		try {
			const user = await targetUser(req, res)
			if (!user) return
			user.blockedAt = null
			user.blockReason = ''
			await user.save()
			forgetUser(String(user._id))
			await log(req, 'unblock', `user:${user._id}`, `${personName(user)} <${user.email}>`)
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/unblock]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	for (const [path, muted] of [['mute', true], ['unmute', false]] as const) {
		router.post(`/users/:id/${path}`, async (req: AuthRequest, res: Response) => {
			try {
				const user = await targetUser(req, res)
				if (!user) return
				user.communityMuted = muted
				await user.save()
				await log(req, path === 'mute' ? 'community-mute' : 'community-unmute', `user:${user._id}`, `${personName(user)} <${user.email}>`)
				res.json({ ok: true })
			} catch (err) {
				logger.error(`[admin/${path}]`, err)
				res.status(500).json({ message: 'Server error' })
			}
		})
	}

	router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
		try {
			const user = await targetUser(req, res)
			if (!user) return
			const who = `${personName(user)} <${user.email}>`
			await kickUser(String(user._id))
			const summary = await deleteAccount(String(user._id))
			await log(req, 'delete-user', `user:${user._id}`, who)
			res.json({ ok: true, ...summary })
		} catch (err) {
			logger.error('[admin/delete-user]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Games ───────────────────────────────────────────────────────────────
	router.get('/games', async (_req: AuthRequest, res: Response) => {
		try {
			const games = await Game.find()
				.select('title creatorId creatorName scheduledAt participationCost maxPlayers registeredPlayers.userId spectators.userId createdAt')
				.sort({ scheduledAt: -1, createdAt: -1 }).limit(300).lean()
			const open = new Map(listRooms().map(r => [r.gameId, r]))
			res.json(games.map(g => ({
				id: String(g._id),
				title: g.title,
				creatorId: String(g.creatorId),
				creatorName: g.creatorName,
				scheduledAt: g.scheduledAt ?? null,
				participationCost: g.participationCost ?? 0,
				maxPlayers: g.maxPlayers,
				players: g.registeredPlayers?.length ?? 0,
				spectators: g.spectators?.length ?? 0,
				createdAt: g.createdAt,
				roomOpen: open.has(String(g._id)),
			})))
		} catch (err) {
			logger.error('[admin/games]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/games/:id', async (req: AuthRequest, res: Response) => {
		try {
			const id = String(req.params.id)
			if (!isId(id)) { res.status(400).json({ message: 'Invalid ID' }); return }
			const game = await Game.findById(id).select('title gameCode creatorName')
			if (!game) { res.status(404).json({ message: 'Not found' }); return }
			await deleteGame(game)
			await log(req, 'delete-game', `game:${id}`, `«${game.title}» — ${game.creatorName}`)
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/delete-game]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Rooms open right now ────────────────────────────────────────────────
	router.get('/rooms', (_req: AuthRequest, res: Response) => {
		res.json(listRooms())
	})

	router.post('/rooms/:gameId/close', async (req: AuthRequest, res: Response) => {
		const gameId = String(req.params.gameId)
		const room = listRooms().find(r => r.gameId === gameId)
		if (!room || !endRoomAsAdmin(gameId)) { res.status(404).json({ message: 'Not found' }); return }
		await log(req, 'close-room', `game:${gameId}`, `«${room.title}»`)
		res.json({ ok: true })
	})

	// ── Recordings ──────────────────────────────────────────────────────────
	router.get('/recordings', async (_req: AuthRequest, res: Response) => {
		try {
			const recs = await Recording.find().sort({ createdAt: -1 }).limit(200).lean()
			const gms = await User.find({ _id: { $in: recs.map(r => r.gmId) } }).select('name surname email').lean()
			const gmName = new Map(gms.map(u => [String(u._id), personName(u)]))
			res.json(recs.map(r => ({
				id: String(r._id),
				gameId: r.gameId,
				gameTitle: r.gameTitle,
				gmName: gmName.get(String(r.gmId)) ?? '—',
				mode: r.mode,
				contentType: r.contentType,
				status: r.status,
				interrupted: !!r.interrupted,
				error: r.error ?? '',
				bytes: r.uploadedBytes ?? 0,
				shareLink: r.status === 'completed' ? r.shareLink : '',
				createdAt: r.createdAt,
				expiresAt: r.expiresAt,
			})))
		} catch (err) {
			logger.error('[admin/recordings]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/recordings/:id', async (req: AuthRequest, res: Response) => {
		try {
			const id = String(req.params.id)
			if (!isId(id)) { res.status(400).json({ message: 'Invalid ID' }); return }
			const rec = await Recording.findById(id)
			if (!rec) { res.status(404).json({ message: 'Not found' }); return }
			const what = `«${rec.gameTitle}» ${rec.createdAt.toISOString().slice(0, 16)}`
			await deleteRecording(rec)
			await log(req, 'delete-recording', `recording:${id}`, what)
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/delete-recording]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Community ───────────────────────────────────────────────────────────
	router.delete('/posts/:id', async (req: AuthRequest, res: Response) => {
		try {
			const id = String(req.params.id)
			if (!isId(id)) { res.status(400).json({ message: 'Invalid ID' }); return }
			const post = await Post.findById(id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }
			await Promise.all([post.deleteOne(), Comment.deleteMany({ postId: post._id })])
			io.to(COMMUNITY_ROOM).emit('com:post-deleted', { postId: id })
			await log(req, 'delete-post', `post:${id}`, `${post.authorName} ${post.authorSurname}: ${post.text.slice(0, 300)}`)
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/delete-post]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/comments/:id', async (req: AuthRequest, res: Response) => {
		try {
			const id = String(req.params.id)
			if (!isId(id)) { res.status(400).json({ message: 'Invalid ID' }); return }
			const comment = await Comment.findById(id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }
			const postId = String(comment.postId)
			await Comment.deleteOne({ _id: comment._id })
			await Post.updateOne({ _id: postId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } })
			io.to(COMMUNITY_ROOM).emit('com:comment-deleted', { commentId: id, postId })
			await log(req, 'delete-comment', `comment:${id}`, `${comment.authorName} ${comment.authorSurname}: ${comment.text.slice(0, 300)}`)
			res.json({ ok: true })
		} catch (err) {
			logger.error('[admin/delete-comment]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── A message to everyone ───────────────────────────────────────────────
	router.post('/broadcast', validateBody(broadcastSchema), async (req: AuthRequest, res: Response) => {
		try {
			const recipients = await User.countDocuments({ telegramChatId: { $exists: true, $nin: [null, ''] }, blockedAt: null })
			await log(req, 'broadcast', '', req.body.text.slice(0, 1000))
			res.json({ ok: true, recipients })
			// Sent in the background, paced; the administrator hears how it went
			broadcastToAll(req.body.text)
				.then(r => notifyAdmin(`📢 Розсилку надіслано: ${r.sent} з ${r.recipients}${r.unlinked ? ` (ще ${r.unlinked} заблокували бота)` : ''}.`))
				.catch(() => undefined)
		} catch (err) {
			logger.error('[admin/broadcast]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Journal ─────────────────────────────────────────────────────────────
	router.get('/log', async (_req: AuthRequest, res: Response) => {
		try {
			const entries = await AdminLog.find().sort({ createdAt: -1 }).limit(300).lean()
			res.json(entries.map(e => ({ id: String(e._id), action: e.action, target: e.target, detail: e.detail, ip: e.ip, createdAt: e.createdAt })))
		} catch (err) {
			logger.error('[admin/log]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	return router
}
