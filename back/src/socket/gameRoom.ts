import { Server, Socket } from 'socket.io'
import { Game } from '../models/Game'
import {
	RoomPlayer, GameRoomState, ChatMessage,
	ActiveVote, BreakoutRoom,
} from './types'

const rooms = new Map<string, GameRoomState>()
const endTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

async function loadRoom(gameCode: string): Promise<GameRoomState | null> {
	const game = await Game.findOne({ gameCode })
	if (!game) return null
	const state: GameRoomState = {
		gameCode,
		status: 'lobby',
		coinsPerPlayer:     game.useCoins    ? game.coinsPerPlayer    : 0,
		influencePerPlayer: game.useInfluence ? game.influencePerPlayer : 0,
		players: [],
		bankCoins: 0,
		messages: [],
		reactions: { '👍': 0, '❤️': 0, '😂': 0, '🔥': 0, '🤔': 0, '👏': 0, '😢': 0, '😡': 0 },
		announcement: null,
		timer: null,
		activeVote: null,
		spectatorVote: null,
		breakoutRooms: [],
		images: game.images ?? [],
		coverImage: game.coverImage ?? '',
		scenario: game.scenario ?? '',
		title: game.title,
		gamemasterId: String(game.creatorId),
		shownImageUrl: game.coverImage || null,
	}
	rooms.set(gameCode, state)
	return state
}

function isGM(state: GameRoomState, userId: string): boolean {
	return state.players.find(p => p.userId === userId)?.isGamemaster ?? false
}

export function registerGameRoom(io: Server) {
	io.on('connection', (socket: Socket) => {
		let curCode: string | null = null
		let curUser: string | null = null

		// ── Join ────────────────────────────────────────────────────────────
		socket.on('gr:join', async (d: { gameCode: string; userId: string; name: string; isSpectatorJoin?: boolean }) => {
			let state = rooms.get(d.gameCode) ?? await loadRoom(d.gameCode)
			if (!state) { socket.emit('gr:error', 'Room not found'); return }

			curCode = d.gameCode
			curUser = d.userId
			socket.join(`gr-${d.gameCode}`)

			const isGamemaster = d.userId === state.gamemasterId

			// Determine spectator status via single DB lookup.
			// A user registered as a player cannot be treated as spectator (and vice-versa).
			let isSpectator = false
			if (!isGamemaster) {
				try {
					const game = await Game.findOne({ gameCode: d.gameCode })
					const inPlayers   = game?.registeredPlayers.some(s => String(s.userId) === d.userId) ?? false
					const inSpectators = game?.spectators.some(s => String(s.userId) === d.userId) ?? false
					if (!inPlayers && (d.isSpectatorJoin === true || inSpectators)) {
						isSpectator = true
					}
				} catch { /* ignore */ }
			}

			const existing = state.players.find(p => p.userId === d.userId)
			if (existing) {
				existing.socketId = socket.id
				existing.connected = true
			} else {
				const p: RoomPlayer = {
					socketId: socket.id,
					userId: d.userId,
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
		})

		// ── Chat ────────────────────────────────────────────────────────────
		socket.on('gr:chat', (d: { gameCode: string; text: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player) return
			const rawText = d.text.trim().slice(0, 500)
			const text = player.isSpectator ? `[Глядач] ${rawText}` : rawText
			const msg: ChatMessage = {
				id: uid(), userId: curUser,
				name: player.name,
				text,
				ts: Date.now(),
			}
			state.messages.push(msg)
			if (state.messages.length > 100) state.messages.shift()
			emit(io, d.gameCode, 'gr:chat', msg)
		})

		// ── Reactions ───────────────────────────────────────────────────────
		socket.on('gr:react', (d: { gameCode: string; emoji: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			if (d.emoji in state.reactions) state.reactions[d.emoji]++
			emit(io, d.gameCode, 'gr:reactions', state.reactions)
			emit(io, d.gameCode, 'gr:player-reacted', { userId: curUser, emoji: d.emoji })
		})

		// ── Hand raise ──────────────────────────────────────────────────────
		socket.on('gr:hand', (d: { gameCode: string; raised: boolean }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const p = state.players.find(p => p.userId === curUser)
			if (!p || p.isSpectator) return
			p.handRaised = d.raised
			pushState(io, state)
		})

		// ── Set role ────────────────────────────────────────────────────────
		socket.on('gr:role', (d: { gameCode: string; targetUserId: string; role: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const requester = state.players.find(p => p.userId === curUser)
			if (!requester) return
			if (d.targetUserId !== curUser && !requester.isGamemaster) return
			const target = state.players.find(p => p.userId === d.targetUserId)
			if (target && !target.isSpectator) { target.role = d.role.slice(0, 60); pushState(io, state) }
		})

		// ── Start / End ─────────────────────────────────────────────────────
		socket.on('gr:start', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return

			// Cancel any pending delete timer (allows restart after game end)
			const existing = endTimers.get(d.gameCode)
			if (existing) { clearTimeout(existing); endTimers.delete(d.gameCode) }

			// Reset transient game state for clean restart
			state.status = 'started'
			state.activeVote = null
			state.spectatorVote = null
			state.timer = null
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
		})

		socket.on('gr:end', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.status = 'ended'
			pushState(io, state)
			emit(io, d.gameCode, 'gr:end-anim', {})
			const t = setTimeout(() => rooms.delete(d.gameCode), 60_000)
			endTimers.set(d.gameCode, t)
		})

		// ── Coins: player → player ──────────────────────────────────────────
		socket.on('gr:coins-transfer', (d: { gameCode: string; toUserId: string; amount: number }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const from = state.players.find(p => p.userId === curUser)
			const to   = state.players.find(p => p.userId === d.toUserId)
			if (!from || !to || d.amount <= 0 || from.coins < d.amount) return
			from.coins -= d.amount
			to.coins   += d.amount
			pushState(io, state)
		})

		// ── Coins: player → bank ────────────────────────────────────────────
		socket.on('gr:coins-bank', (d: { gameCode: string; amount: number }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			const p = state.players.find(p => p.userId === curUser)
			if (!p || d.amount <= 0 || p.coins < d.amount) return
			p.coins -= d.amount
			state.bankCoins += d.amount
			pushState(io, state)
		})

		// ── Influence (GM only) ─────────────────────────────────────────────
		socket.on('gr:influence', (d: { gameCode: string; targetUserId: string; delta: number }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const target = state.players.find(p => p.userId === d.targetUserId)
			if (target) { target.influence = Math.max(0, target.influence + d.delta); pushState(io, state) }
		})

		// ── Mute all (GM only — sets a flag, audio handled by LiveKit) ──────
		socket.on('gr:mute-all', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			emit(io, d.gameCode, 'gr:mute-all', {})
		})

		// ── Announcement ────────────────────────────────────────────────────
		socket.on('gr:announce', (d: { gameCode: string; text: string | null }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.announcement = d.text ? d.text.slice(0, 300) : null
			pushState(io, state)
		})

		// ── Timer ───────────────────────────────────────────────────────────
		socket.on('gr:timer', (d: {
			gameCode: string
			action: 'set' | 'start' | 'stop' | 'clear'
			label?: string; seconds?: number
		}) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (d.action === 'set' && d.label && d.seconds) {
				state.timer = { label: d.label, totalSeconds: d.seconds, endsAt: null, running: false }
			} else if (d.action === 'start' && state.timer) {
				state.timer.running = true
				state.timer.endsAt  = Date.now() + state.timer.totalSeconds * 1000
			} else if (d.action === 'stop' && state.timer) {
				state.timer.running = false
				state.timer.endsAt  = null
			} else if (d.action === 'clear') {
				state.timer = null
			}
			pushState(io, state)
		})

		// ── Voting (players only) ───────────────────────────────────────────
		socket.on('gr:vote-create', (d: {
			gameCode: string; question: string; options: string[]
			isAnonymous: boolean; multipleChoice: boolean
		}) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const vote: ActiveVote = {
				id: uid(),
				question: d.question.slice(0, 300),
				options: d.options.map((t, i) => ({ id: `o${i}`, text: t.slice(0, 100), voterIds: [] })),
				isAnonymous: d.isAnonymous,
				multipleChoice: d.multipleChoice,
				closed: false,
			}
			state.activeVote = vote
			pushState(io, state)
		})

		socket.on('gr:vote-cast', (d: { gameCode: string; optionIds: string[] }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !state.activeVote || state.activeVote.closed) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player || player.isSpectator) return
			const vote = state.activeVote
			vote.options.forEach(o => { o.voterIds = o.voterIds.filter(id => id !== curUser) })
			const toVote = vote.multipleChoice ? d.optionIds : [d.optionIds[0]]
			toVote.forEach(oid => {
				const o = vote.options.find(o => o.id === oid)
				if (o && curUser) o.voterIds.push(curUser)
			})
			pushState(io, state)
		})

		socket.on('gr:vote-close', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (state.activeVote) { state.activeVote.closed = true; pushState(io, state) }
		})

		socket.on('gr:vote-clear', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.activeVote = null
			pushState(io, state)
		})

		// ── Spectator voting ────────────────────────────────────────────────
		socket.on('gr:spectator-vote-create', (d: {
			gameCode: string; question: string; options: string[]
			isAnonymous: boolean; multipleChoice: boolean
		}) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const vote: ActiveVote = {
				id: uid(),
				question: d.question.slice(0, 300),
				options: d.options.map((t, i) => ({ id: `o${i}`, text: t.slice(0, 100), voterIds: [] })),
				isAnonymous: d.isAnonymous,
				multipleChoice: d.multipleChoice,
				closed: false,
				spectatorOnly: true,
			}
			state.spectatorVote = vote
			pushState(io, state)
		})

		socket.on('gr:spectator-vote-cast', (d: { gameCode: string; optionIds: string[] }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !state.spectatorVote || state.spectatorVote.closed) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player || (!player.isSpectator && !player.isGamemaster)) return
			const vote = state.spectatorVote
			vote.options.forEach(o => { o.voterIds = o.voterIds.filter(id => id !== curUser) })
			const toVote = vote.multipleChoice ? d.optionIds : [d.optionIds[0]]
			toVote.forEach(oid => {
				const o = vote.options.find(o => o.id === oid)
				if (o && curUser) o.voterIds.push(curUser)
			})
			pushState(io, state)
		})

		socket.on('gr:spectator-vote-close', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (state.spectatorVote) { state.spectatorVote.closed = true; pushState(io, state) }
		})

		socket.on('gr:spectator-vote-clear', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.spectatorVote = null
			pushState(io, state)
		})

		// ── Breakout rooms ──────────────────────────────────────────────────
		socket.on('gr:breakout-create', (d: {
			gameCode: string; name: string; imageUrl: string; timerSeconds: number | null
		}) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			if (state.breakoutRooms.length >= 5) { socket.emit('gr:error', 'Max 5 breakout rooms'); return }
			const br: BreakoutRoom = {
				id: uid(), name: d.name.slice(0, 50),
				imageUrl: d.imageUrl || '',
				timerSeconds: d.timerSeconds,
				endsAt: null, playerIds: [],
			}
			state.breakoutRooms.push(br)
			pushState(io, state)
		})

		socket.on('gr:breakout-invite', (d: { gameCode: string; roomId: string; playerIds: string[] }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			d.playerIds.forEach(uid => {
				const target = state!.players.find(p => p.userId === uid)
				if (target?.socketId) {
					io.to(target.socketId).emit('gr:breakout-invited', {
						roomId: d.roomId, roomName: br.name, imageUrl: br.imageUrl,
					})
				}
			})
		})

		socket.on('gr:breakout-join', (d: { gameCode: string; roomId: string }) => {
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
				setTimeout(() => {
					const s = rooms.get(d.gameCode)
					if (!s) return
					const r = s.breakoutRooms.find(r => r.id === d.roomId)
					if (!r) return
					r.playerIds.forEach(uid => {
						const pl = s.players.find(p => p.userId === uid)
						if (pl) {
							pl.breakoutRoomId = null
							if (pl.socketId) io.to(pl.socketId).emit('gr:breakout-return', {})
						}
					})
					r.playerIds = []
					r.endsAt = null
					pushState(io, s)
				}, br.timerSeconds * 1000)
			}
			pushState(io, state)
		})

		socket.on('gr:breakout-leave', (d: { gameCode: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser) return
			state.breakoutRooms.forEach(r => { r.playerIds = r.playerIds.filter(id => id !== curUser) })
			const p = state.players.find(p => p.userId === curUser)
			if (p) p.breakoutRoomId = null
			pushState(io, state)
		})

		socket.on('gr:breakout-end', (d: { gameCode: string; roomId: string }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			br.playerIds.forEach(uid => {
				const pl = state!.players.find(p => p.userId === uid)
				if (pl) {
					pl.breakoutRoomId = null
					if (pl.socketId) io.to(pl.socketId).emit('gr:breakout-return', {})
				}
			})
			state.breakoutRooms = state.breakoutRooms.filter(r => r.id !== d.roomId)
			pushState(io, state)
		})

		// ── Show image ──────────────────────────────────────────────────────
		socket.on('gr:image-show', (d: { gameCode: string; imageUrl: string | null }) => {
			const state = rooms.get(d.gameCode)
			if (!state || !curUser || !isGM(state, curUser)) return
			state.shownImageUrl = d.imageUrl
			pushState(io, state)
		})

		// ── Disconnect ──────────────────────────────────────────────────────
		socket.on('disconnect', () => {
			if (!curCode || !curUser) return
			const state = rooms.get(curCode)
			if (!state) return
			const p = state.players.find(p => p.userId === curUser)
			if (p) { p.connected = false; p.socketId = '' }
			pushState(io, state)
		})
	})
}
