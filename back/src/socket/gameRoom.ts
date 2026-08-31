import { Server, Socket } from 'socket.io'
import { Game } from '../models/Game'
import { GameMessage } from '../models/GameMessage'
import {
	RoomPlayer, GameRoomState, ChatMessage,
	ActiveVote, BreakoutRoom, RoomTimer,
} from './types'
import { validateSocketEvent } from './eventValidation'
import {
	grChatSchema,
	grTimerSchema,
	grVoteCreateSchema,
	grVoteCastSchema,
	grVoteCloseSchema,
	grVoteClearSchema,
	grBreakoutCreateSchema,
	grReactSchema,
	grHandSchema,
	grRoleSchema,
	grStartSchema,
	grEndSchema,
	grCoinsTransferSchema,
	grCoinsBankSchema,
	grInfluenceSchema,
	grMuteAllSchema,
	grMutePlayerSchema,
	grAnnounceSchema,
	grBreakoutAssignSchema,
	grBreakoutReturnSchema,
	grImageShowSchema,
	grRecordControlSchema,
	grObserverConnectSchema,
	grRecordStatusSchema,
	grSpectatorVoteCreateSchema,
	grSpectatorVoteCastSchema,
	grSpectatorVoteCloseSchema,
	grSpectatorVoteClearSchema,
	grBreakoutJoinSchema,
	grBreakoutLeaveSchema,
	grBreakoutEndSchema,
} from '../validation/schemas'
import logger from '../config/logger'

const rooms = new Map<string, GameRoomState>()
const endTimers = new Map<string, ReturnType<typeof setTimeout>>()
const observerSockets = new Map<string, string>() // gameCode → socketId
const loadingRooms = new Map<string, Promise<GameRoomState | null>>() // deduplicate concurrent loadRoom calls
const breakoutTimers = new Map<string, ReturnType<typeof setTimeout>>() // `${gameCode}:${roomId}`
const userSockets = new Map<string, Set<string>>() // `${gameCode}:${userId}` → active socket IDs

function initials(name: string): string {
	return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '??'
}

function uid(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emit(io: Server, gameCode: string, event: string, data: unknown) {
	io.to(`gr-${gameCode}`).emit(event, data)
}

function pushState(io: Server, state: GameRoomState) {
	emit(io, state.gameCode, 'gr:state', state)
}

function makeDefaultTimer(seconds: number | null): RoomTimer | null {
	if (!seconds || seconds <= 0) return null
	return { label: 'Таймер', totalSeconds: seconds, endsAt: null, running: false }
}

async function loadRoom(gameCode: string): Promise<GameRoomState | null> {
	const game = await Game.findOne({ gameCode })
	if (!game) return null
	const gameId = String(game._id)

	// Load last 100 public messages from DB (recipients empty = public)
	const dbMsgs = await GameMessage.find({ gameId, recipients: { $size: 0 } })
		.sort({ createdAt: 1 })
		.limit(100)
		.lean()

	const messages: ChatMessage[] = dbMsgs.map(m => ({
		id: String(m._id),
		userId: m.senderId,
		name: m.senderName,
		text: m.text,
		ts: (m.createdAt as Date).getTime(),
		recipients: [],
		recipientNames: [],
		spectatorChat: m.spectatorChat ?? false,
	}))

	const state: GameRoomState = {
		gameCode,
		gameId,
		status: 'lobby',
		coinsPerPlayer:     game.useCoins    ? game.coinsPerPlayer    : 0,
		influencePerPlayer: game.useInfluence ? game.influencePerPlayer : 0,
		players: [],
		bankCoins: 0,
		messages,
		reactions: { '👍': 0, '❤️': 0, '😂': 0, '🔥': 0, '🤔': 0, '👏': 0, '😢': 0, '😡': 0 },
		announcement: null,
		timer: makeDefaultTimer(game.defaultTimerSeconds ?? null),
		activeVote: null,
		spectatorVote: null,
		breakoutRooms: [],
		images: game.images ?? [],
		coverImage: game.coverImage ?? '',
		scenario: game.scenario ?? '',
		title: game.title,
		gamemasterId: String(game.creatorId),
		shownImageUrl: game.coverImage || game.images?.[0] || null,
		defaultTimerSeconds: game.defaultTimerSeconds ?? null,
		hasObserver: false,
	}
	rooms.set(gameCode, state)
	return state
}

// Deduplicates concurrent loadRoom calls for the same gameCode.
// Without this, two simultaneous gr:join events both call loadRoom(), each
// producing a fresh state with players:[], and the second overwrites the first.
async function getOrLoadRoom(gameCode: string): Promise<GameRoomState | null> {
	if (rooms.has(gameCode)) return rooms.get(gameCode)!
	if (!loadingRooms.has(gameCode)) {
		loadingRooms.set(gameCode, loadRoom(gameCode).finally(() => loadingRooms.delete(gameCode)))
	}
	return loadingRooms.get(gameCode)!
}

function isGM(state: GameRoomState, userId: string): boolean {
	return state.players.find(p => p.userId === userId)?.isGamemaster ?? false
}

export function registerGameRoom(io: Server) {
	io.on('connection', (socket: Socket) => {
		let curCode: string | null = null
		let curUser: string | null = null

		// ── Join ────────────────────────────────────────────────────────────
		// userId is taken exclusively from the JWT verified at handshake (socket.data.userId),
		// NOT from the client payload. This prevents identity spoofing / IDOR.
		socket.on('gr:join', async (d: { gameCode: string; name: string; isSpectatorJoin?: boolean }) => {
			const userId = socket.data.userId as string | null
			if (!userId) { socket.emit('gr:error', 'Unauthorized'); return }

			const state = await getOrLoadRoom(d.gameCode)
			if (!state) { socket.emit('gr:error', 'Room not found'); return }

			curCode = d.gameCode
			curUser = userId
			socket.join(`gr-${d.gameCode}`)

			// Track this socket for multi-tab / multi-connection deduplication
			const uKey = `${d.gameCode}:${userId}`
			if (!userSockets.has(uKey)) userSockets.set(uKey, new Set())
			userSockets.get(uKey)!.add(socket.id)

			const isGamemaster = userId === state.gamemasterId

			// Determine spectator status: the code type is authoritative.
			// A registered player always keeps player status regardless of code used.
			// Anyone else: spectator iff they explicitly used the spectator code.
			let isSpectator = false
			if (!isGamemaster) {
				try {
					const game = await Game.findOne({ gameCode: d.gameCode })
					const inPlayers = game?.registeredPlayers?.some(s => String(s.userId) === userId) ?? false
					isSpectator = !inPlayers && d.isSpectatorJoin === true
				} catch { /* ignore */ }
			}

			const existing = state.players.find(p => p.userId === userId)
			if (existing) {
				logger.info(`[gr:join] reconnect userId=${userId} gameCode=${d.gameCode} socketId=${socket.id} prevSocketId=${existing.socketId}`)
				existing.socketId = socket.id
				existing.connected = true
				// Fix: update role if user rejoined with a different code (spectator → player or vice versa)
				if (existing.isSpectator !== isSpectator || existing.isGamemaster !== isGamemaster) {
					existing.isSpectator = isSpectator
					existing.isGamemaster = isGamemaster
					if (!isSpectator && !isGamemaster) {
						if (existing.coins === 0) existing.coins = state.coinsPerPlayer
						if (existing.influence === 0) existing.influence = state.influencePerPlayer
					} else {
						existing.coins = 0
						existing.influence = 0
					}
				}
			} else {
				logger.info(`[gr:join] new player userId=${userId} gameCode=${d.gameCode} socketId=${socket.id} isGamemaster=${isGamemaster} isSpectator=${isSpectator}`)
				const p: RoomPlayer = {
					socketId: socket.id,
					userId,
					name: d.name,
					initials: initials(d.name),
					role: '',
					coins: isGamemaster || isSpectator ? 0 : state.coinsPerPlayer,
					influence: isGamemaster || isSpectator ? 0 : state.influencePerPlayer,
					handRaised: false,
					breakoutRoomId: null,
					isGamemaster,
					isSpectator,
					connected: true,
				}
				state.players.push(p)
			}
			pushState(io, state)

			// Send per-user chat history (public + messages where user is sender or recipient)
			try {
				const dbHistory = await GameMessage.find({
					gameId: state.gameId,
					$or: [
						{ recipients: { $size: 0 } },
						{ senderId: userId },
						{ recipients: userId },
					],
				}).sort({ createdAt: 1 }).limit(200).lean()

				const history: ChatMessage[] = dbHistory.map(m => ({
					id: String(m._id),
					userId: m.senderId,
					name: m.senderName,
					text: m.text,
					ts: (m.createdAt as Date).getTime(),
					recipients: m.recipients,
					recipientNames: m.recipientNames,
					spectatorChat: m.spectatorChat ?? false,
				}))
				socket.emit('gr:chat-history', history)
			} catch { /* non-critical */ }
		})

		// ── Chat ────────────────────────────────────────────────────────────
		socket.on('gr:chat', validateSocketEvent(grChatSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player) return

			const text = d.text.trim().slice(0, 500)
			if (!text) return

			// Spectators can only send public messages; filter out spectator recipients too
			const recipientIds = (player.isSpectator || !d.recipients?.length)
				? []
				: d.recipients.filter((id: any) => {
					if (id === curUser) return false
					const target = state.players.find(p => p.userId === id)
					return target && !target.isSpectator
				})

			const isPrivate = recipientIds.length > 0
			const spectatorChat = player.isSpectator && !isPrivate
			const recipientNames = isPrivate
				? recipientIds.map((id: any) => state.players.find(p => p.userId === id)?.name ?? '').filter(Boolean)
				: []

			const msg: ChatMessage = {
				id: uid(), userId: curUser,
				name: player.name,
				text,
				ts: Date.now(),
				recipients: recipientIds,
				recipientNames,
				spectatorChat,
			}

			if (!isPrivate) {
				// Public: store in room history and broadcast to all
				state.messages.push(msg)
				if (state.messages.length > 100) state.messages.shift()
				emit(io, d.gameCode, 'gr:chat', msg)
			} else {
				// Private: deliver only to sender + recipients (not stored in shared history)
				socket.emit('gr:chat', msg)
				recipientIds.forEach((recipientId: any) => {
					const target = state.players.find(p => p.userId === recipientId)
					if (target?.socketId) io.to(target.socketId).emit('gr:chat', msg)
				})
			}

			// Persist to DB (fire-and-forget)
			GameMessage.create({
				gameId: state.gameId,
				senderId: curUser,
				senderName: player.name,
				text,
				recipients: recipientIds,
				recipientNames,
				spectatorChat,
			}).catch(() => { /* ignore */ })
		}))

		// ── Reactions ───────────────────────────────────────────────────────
		socket.on('gr:react', validateSocketEvent(grReactSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			if (d.emoji in state.reactions) state.reactions[d.emoji]++
			emit(io, d.gameCode, 'gr:reactions', state.reactions)
			emit(io, d.gameCode, 'gr:player-reacted', { userId: curUser, emoji: d.emoji })
		}))

		// ── Hand raise ──────────────────────────────────────────────────────
		socket.on('gr:hand', validateSocketEvent(grHandSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const p = state.players.find(p => p.userId === curUser)
			if (!p || p.isSpectator) return
			p.handRaised = d.raised
			pushState(io, state)
		}))

		// ── Set role ────────────────────────────────────────────────────────
		socket.on('gr:role', validateSocketEvent(grRoleSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const requester = state.players.find(p => p.userId === curUser)
			if (!requester) return
			if (d.targetUserId !== curUser && !requester.isGamemaster) return
			const target = state.players.find(p => p.userId === d.targetUserId)
			if (target && !target.isSpectator) { target.role = d.role.slice(0, 60); pushState(io, state) }
		}))

		// ── Start / End ─────────────────────────────────────────────────────
		socket.on('gr:start', validateSocketEvent(grStartSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return

			// Cancel any pending delete timer (allows restart after game end)
			const existing = endTimers.get(d.gameCode)
			if (existing) { clearTimeout(existing); endTimers.delete(d.gameCode) }

			// Reset transient game state for clean restart
			state.status = 'started'
			state.activeVote = null
			state.spectatorVote = null
			state.timer = makeDefaultTimer(state.defaultTimerSeconds)
			state.announcement = null
			state.breakoutRooms = []
			state.players.forEach(p => {
				p.handRaised = false
				p.breakoutRoomId = null
				if (!p.isGamemaster && !p.isSpectator) {
					p.coins = state.coinsPerPlayer
					p.influence = state.influencePerPlayer
				}
			})

			pushState(io, state)
		}))

		socket.on('gr:end', validateSocketEvent(grEndSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			// Cancel all breakout auto-return timers for this game
			state.breakoutRooms.forEach(br => {
				const tKey = `${d.gameCode}:${br.id}`
				const tid = breakoutTimers.get(tKey)
				if (tid) { clearTimeout(tid); breakoutTimers.delete(tKey) }
			})
			state.status = 'ended'
			state.messages = []
			pushState(io, state)
			emit(io, d.gameCode, 'gr:end-anim', {})
			// Delete all messages for this game from DB
			GameMessage.deleteMany({ gameId: state.gameId }).catch(() => { /* ignore */ })
			const t = setTimeout(() => rooms.delete(d.gameCode), 60_000)
			endTimers.set(d.gameCode, t)
		}))

		// ── Coins: player → player ──────────────────────────────────────────
		socket.on('gr:coins-transfer', validateSocketEvent(grCoinsTransferSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const from = state.players.find(p => p.userId === curUser)
			const to   = state.players.find(p => p.userId === d.toUserId)
			if (!from || !to || d.amount <= 0 || from.coins < d.amount) return
			from.coins -= d.amount
			to.coins   += d.amount
			pushState(io, state)
		}))

		// ── Coins: player → bank ────────────────────────────────────────────
		socket.on('gr:coins-bank', validateSocketEvent(grCoinsBankSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const p = state.players.find(p => p.userId === curUser)
			if (!p || d.amount <= 0 || p.coins < d.amount) return
			p.coins -= d.amount
			state.bankCoins += d.amount
			pushState(io, state)
		}))

		// ── Influence (GM only) ─────────────────────────────────────────────
		socket.on('gr:influence', validateSocketEvent(grInfluenceSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const target = state.players.find(p => p.userId === d.targetUserId)
			if (target) { target.influence = Math.max(0, target.influence + d.delta); pushState(io, state) }
		}))

		// ── Mute all (GM only — sets a flag, audio handled by LiveKit) ──────
		socket.on('gr:mute-all', validateSocketEvent(grMuteAllSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			emit(io, d.gameCode, 'gr:mute-all', {})
		}))

		// ── Mute player (GM only — mutes a single player's mic via LiveKit) ─
		socket.on('gr:mute-player', validateSocketEvent(grMutePlayerSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const uKey = `${d.gameCode}:${d.targetUserId}`
			const sockets = userSockets.get(uKey)
			if (sockets) sockets.forEach(sid => io.to(sid).emit('gr:mute-player', {}))
		}))

		// ── Announcement ────────────────────────────────────────────────────
		socket.on('gr:announce', validateSocketEvent(grAnnounceSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.announcement = d.text ? d.text.slice(0, 500) : null
			pushState(io, state)
		}))

		// ── Timer ───────────────────────────────────────────────────────────
		socket.on('gr:timer', validateSocketEvent(grTimerSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const gmPlayer = state.players.find(p => p.userId === curUser)
			const brId = gmPlayer?.breakoutRoomId ?? null
			const br = brId ? state.breakoutRooms.find(r => r.id === brId) : null

			if (br) {
				// Timer scoped to the GM's current breakout room
				if (d.action === 'set' && d.label && d.seconds) {
					const secs = Math.floor(Number(d.seconds))
					if (!Number.isFinite(secs) || secs < 1 || secs > 86400) return
					br.timer = { label: String(d.label).slice(0, 100), totalSeconds: secs, endsAt: null, running: false }
				} else if (d.action === 'start' && br.timer) {
					br.timer.running = true
					br.timer.endsAt  = Date.now() + br.timer.totalSeconds * 1000
				} else if (d.action === 'stop' && br.timer) {
					br.timer.running = false
					br.timer.endsAt  = null
				} else if (d.action === 'clear') {
					br.timer = null
				}
			} else {
				// Timer scoped to the main room
				if (d.action === 'set' && d.label && d.seconds) {
					const secs = Math.floor(Number(d.seconds))
					if (!Number.isFinite(secs) || secs < 1 || secs > 86400) return
					state.timer = { label: String(d.label).slice(0, 100), totalSeconds: secs, endsAt: null, running: false }
				} else if (d.action === 'start' && state.timer) {
					state.timer.running = true
					state.timer.endsAt  = Date.now() + state.timer.totalSeconds * 1000
				} else if (d.action === 'stop' && state.timer) {
					state.timer.running = false
					state.timer.endsAt  = null
				} else if (d.action === 'clear') {
					state.timer = null
				}
			}
			pushState(io, state)
		}))

		// ── Voting (players only) ───────────────────────────────────────────
		socket.on('gr:vote-create', validateSocketEvent(grVoteCreateSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const vote: ActiveVote = {
				id: uid(),
				question: d.question.slice(0, 300),
				options: d.options.map((t: any, i: any) => ({ id: `o${i}`, text: t.slice(0, 100), voterIds: [] })),
				isAnonymous: d.isAnonymous,
				multipleChoice: d.multipleChoice,
				closed: false,
			}
			state.activeVote = vote
			pushState(io, state)
		}))

		socket.on('gr:vote-cast', validateSocketEvent(grVoteCastSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !state.activeVote || state.activeVote.closed) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player || player.isSpectator) return
			const vote = state.activeVote
			vote.options.forEach(o => { o.voterIds = o.voterIds.filter(id => id !== curUser) })
			const toVote = vote.multipleChoice ? d.optionIds : [d.optionIds[0]]
			toVote.forEach((oid: any) => {
				const o = vote.options.find(o => o.id === oid)
				if (o && curUser) o.voterIds.push(curUser)
			})
			pushState(io, state)
		}))

		socket.on('gr:vote-close', validateSocketEvent(grVoteCloseSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (state.activeVote) { state.activeVote.closed = true; pushState(io, state) }
		}))

		socket.on('gr:vote-clear', validateSocketEvent(grVoteClearSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.activeVote = null
			pushState(io, state)
		}))

		// ── Spectator voting ────────────────────────────────────────────────
		socket.on('gr:spectator-vote-create', validateSocketEvent(grSpectatorVoteCreateSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const vote: ActiveVote = {
				id: uid(),
				question: d.question.slice(0, 300),
				options: d.options.map((t: string, i: number) => ({ id: `o${i}`, text: t.slice(0, 100), voterIds: [] })),
				isAnonymous: d.isAnonymous,
				multipleChoice: d.multipleChoice,
				closed: false,
				spectatorOnly: true,
			}
			state.spectatorVote = vote
			pushState(io, state)
		}))

		socket.on('gr:spectator-vote-cast', validateSocketEvent(grSpectatorVoteCastSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !state.spectatorVote || state.spectatorVote.closed) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player || (!player.isSpectator && !player.isGamemaster)) return
			const vote = state.spectatorVote
			vote.options.forEach(o => { o.voterIds = o.voterIds.filter(id => id !== curUser) })
			const toVote = vote.multipleChoice ? d.optionIds : [d.optionIds[0]]
			toVote.forEach((oid: string) => {
				const o = vote.options.find(o => o.id === oid)
				if (o && curUser) o.voterIds.push(curUser)
			})
			pushState(io, state)
		}))

		socket.on('gr:spectator-vote-close', validateSocketEvent(grSpectatorVoteCloseSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (state.spectatorVote) { state.spectatorVote.closed = true; pushState(io, state) }
		}))

		socket.on('gr:spectator-vote-clear', validateSocketEvent(grSpectatorVoteClearSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.spectatorVote = null
			pushState(io, state)
		}))

		// ── Breakout rooms ──────────────────────────────────────────────────
		socket.on('gr:breakout-create', validateSocketEvent(grBreakoutCreateSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (state.breakoutRooms.length >= 5) { socket.emit('gr:error', 'Max 5 breakout rooms'); return }
			const br: BreakoutRoom = {
				id: uid(), name: d.name.slice(0, 50),
				imageUrl: d.imageUrl || '',
				timerSeconds: d.timerSeconds,
				endsAt: null, playerIds: [],
				timer: null,
				shownImageUrl: null,
			}
			state.breakoutRooms.push(br)
			pushState(io, state)
		}))

		socket.on('gr:breakout-invite', validateSocketEvent(grBreakoutAssignSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			d.playerIds.forEach((playerId: string) => {
				const target = state!.players.find(p => p.userId === playerId)
				if (target?.socketId) {
					io.to(target.socketId).emit('gr:breakout-invited', {
						roomId: d.roomId, roomName: br.name, imageUrl: br.imageUrl,
					})
				}
			})
		}))

		socket.on('gr:breakout-join', validateSocketEvent(grBreakoutJoinSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			// Remove from any current breakout
			state.breakoutRooms.forEach(r => { r.playerIds = r.playerIds.filter(id => id !== curUser) })
			br.playerIds.push(curUser!)
			const p = state.players.find(p => p.userId === curUser)
			if (p) p.breakoutRoomId = d.roomId
			// Start timer if first join
			if (br.timerSeconds && !br.endsAt) {
				br.endsAt = Date.now() + br.timerSeconds * 1000
				const tKey = `${d.gameCode}:${d.roomId}`
				const tid = setTimeout(() => {
					breakoutTimers.delete(tKey)
					const s = rooms.get(d.gameCode)
					if (!s) return
					const r = s.breakoutRooms.find(r => r.id === d.roomId)
					if (!r) return
					logger.info(`[breakout-timer] expired roomId=${d.roomId} gameCode=${d.gameCode} returning ${r.playerIds.length} players`)
					r.playerIds.forEach(playerId => {
						const pl = s.players.find(p => p.userId === playerId)
						if (pl) {
							pl.breakoutRoomId = null
							if (pl.socketId) io.to(pl.socketId).emit('gr:breakout-return', {})
						}
					})
					r.playerIds = []
					r.endsAt = null
					pushState(io, s)
				}, br.timerSeconds * 1000)
				breakoutTimers.set(tKey, tid)
			}
			pushState(io, state)
		}))

		socket.on('gr:breakout-leave', validateSocketEvent(grBreakoutLeaveSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			state.breakoutRooms.forEach(r => { r.playerIds = r.playerIds.filter(id => id !== curUser) })
			const p = state.players.find(p => p.userId === curUser)
			if (p) p.breakoutRoomId = null
			pushState(io, state)
		}))

		socket.on('gr:breakout-end', validateSocketEvent(grBreakoutEndSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			// Cancel any running auto-return timer for this room
			const tKey = `${d.gameCode}:${d.roomId}`
			const tid = breakoutTimers.get(tKey)
			if (tid) { clearTimeout(tid); breakoutTimers.delete(tKey) }
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			br.playerIds.forEach(playerId => {
				const pl = state!.players.find(p => p.userId === playerId)
				if (pl) {
					pl.breakoutRoomId = null
					if (pl.socketId) io.to(pl.socketId).emit('gr:breakout-return', {})
				}
			})
			state.breakoutRooms = state.breakoutRooms.filter(r => r.id !== d.roomId)
			pushState(io, state)
		}))

		// ── Show image ──────────────────────────────────────────────────────
		socket.on('gr:image-show', validateSocketEvent(grImageShowSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const gmPlayer = state.players.find(p => p.userId === curUser)
			const brId = gmPlayer?.breakoutRoomId ?? null
			const br = brId ? state.breakoutRooms.find(r => r.id === brId) : null
			if (br) {
				br.shownImageUrl = d.imageUrl
			} else {
				state.shownImageUrl = d.imageUrl
			}
			pushState(io, state)
		}))

		// ── Observer connect ─────────────────────────────────────────────────────
		// The observer is the GM's automated recording tool — not a person.
		// Identity comes from the verified JWT (socket.data.userId), not the client payload.
		socket.on('gr:observer-connect', validateSocketEvent(grObserverConnectSchema, async (d: any) => {
			const userId = socket.data.userId as string | null
			if (!userId) { socket.emit('gr:error', 'Unauthorized'); return }

			const state = await getOrLoadRoom(d.gameCode)
			if (!state) { socket.emit('gr:error', 'Room not found'); return }
			if (userId !== state.gamemasterId) {
				socket.emit('gr:error', 'Observer access denied')
				return
			}

			curCode = d.gameCode
			socket.join(`gr-${d.gameCode}`)

			observerSockets.set(d.gameCode, socket.id)
			state.hasObserver = true
			pushState(io, state)
			socket.emit('gr:state', state)

			try {
				const dbHistory = await GameMessage.find({
					gameId: state.gameId,
					recipients: { $size: 0 },
				}).sort({ createdAt: 1 }).limit(100).lean()
				const history = dbHistory.map(m => ({
					id: String(m._id),
					userId: m.senderId,
					name: m.senderName,
					text: m.text,
					ts: (m.createdAt as Date).getTime(),
					recipients: [],
					recipientNames: [],
					spectatorChat: m.spectatorChat ?? false,
				}))
				socket.emit('gr:chat-history', history)
			} catch { /* non-critical */ }
		}))

		// ── Recording control (GM → observer) ───────────────────────────────────
		socket.on('gr:record-control', validateSocketEvent(grRecordControlSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const obsSocketId = observerSockets.get(d.gameCode)
			if (obsSocketId) io.to(obsSocketId).emit('gr:record-signal', { action: d.action })
		}))

		// ── Recording status (observer → GM + room broadcast) ────────────────────
		socket.on('gr:record-status', validateSocketEvent(grRecordStatusSchema, async (d: any) => {
			const state = rooms.get(d.gameCode)
			if (!state || observerSockets.get(d.gameCode) !== socket.id) return
			const gm = state.players.find(p => p.isGamemaster && p.connected)
			if (gm?.socketId) io.to(gm.socketId).emit('gr:record-status', { status: d.status })
			// Notify all room members when recording starts or ends
			if (d.status === 'recording') emit(io, d.gameCode, 'gr:recording-notify', { active: true })
			if (d.status === 'done' || d.status === 'error' || d.status === 'idle') {
				emit(io, d.gameCode, 'gr:recording-notify', { active: false })
			}
		}))

		// ── Disconnect ──────────────────────────────────────────────────────
		socket.on('disconnect', () => {
			if (!curCode) return

			if (observerSockets.get(curCode) === socket.id) {
				observerSockets.delete(curCode)
				const state = rooms.get(curCode)
				if (state) { state.hasObserver = false; pushState(io, state) }
				return
			}

			if (!curUser) return
			const state = rooms.get(curCode)
			if (!state) return

			// Remove this socket from per-user tracking to handle multi-tab correctly
			const uKey = `${curCode}:${curUser}`
			const sockets = userSockets.get(uKey)
			if (sockets) {
				sockets.delete(socket.id)
				if (sockets.size === 0) {
					// No remaining connections for this user — mark disconnected
					userSockets.delete(uKey)
					const p = state.players.find(p => p.userId === curUser)
					if (p) { p.connected = false; p.socketId = '' }
					logger.info(`[disconnect] userId=${curUser} gameCode=${curCode} fully disconnected`)
					pushState(io, state)
				} else {
					// User still has another tab open — keep them connected,
					// update socketId to a still-alive socket so private messages deliver
					const p = state.players.find(p => p.userId === curUser)
					if (p && p.socketId === socket.id) {
						p.socketId = [...sockets][sockets.size - 1]
						logger.info(`[disconnect] userId=${curUser} gameCode=${curCode} tab closed, ${sockets.size} connection(s) remain, socketId→${p.socketId}`)
					}
				}
			} else {
				// No tracking entry (join predates this fix) — fall back to marking disconnected
				const p = state.players.find(p => p.userId === curUser)
				if (p) { p.connected = false; p.socketId = '' }
				logger.info(`[disconnect] userId=${curUser} gameCode=${curCode} disconnected (no tracking)`)
				pushState(io, state)
			}
		})
	})
}
