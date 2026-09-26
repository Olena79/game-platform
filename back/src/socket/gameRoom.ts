import { Server, Socket } from 'socket.io'
import { Game } from '../models/Game'
import { GameMessage } from '../models/GameMessage'
import { User } from '../models/User'
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
	grJoinSchema,
	grNotesSchema,
	grCoinsTransferSchema,
	grCoinsBankSchema,
	grBankGiveSchema,
	grInfluenceSchema,
	grMuteAllSchema,
	grMutePlayerSchema,
	grAnnounceSchema,
	grBreakoutAssignSchema,
	grImageShowSchema,
	grRecordControlSchema,
	grSpectatorVoteCreateSchema,
	grSpectatorVoteCastSchema,
	grSpectatorVoteCloseSchema,
	grSpectatorVoteClearSchema,
	grBreakoutJoinSchema,
	grBreakoutLeaveSchema,
	grBreakoutEndSchema,
} from '../validation/schemas'
import logger from '../config/logger'
import { cleanNotes, deliverGameNotes } from '../services/notesDelivery'
import { resolveSeat } from '../services/roomAccess'
import { muteMicrophones, roomNameFor, roomService } from '../services/livekit'
import {
	activeRecording,
	recordingEvents,
	RecordingError,
	RecordingEvent,
	recordingMode,
	startEgressRecording,
	stopRecording,
} from '../services/recording'

// All of this lives in one process's memory: the room state, who is connected,
// the GM's notes draft. CLAUDE.md: exactly one backend instance.
const rooms = new Map<string, GameRoomState>()          // gameCode → state
const endTimers = new Map<string, ReturnType<typeof setTimeout>>()
const loadingRooms = new Map<string, Promise<GameRoomState | null>>() // deduplicate concurrent loadRoom calls
const breakoutTimers = new Map<string, ReturnType<typeof setTimeout>>() // `${gameCode}:${roomId}`
const userSockets = new Map<string, Set<string>>() // `${gameCode}:${userId}` → active socket IDs
// The GM's notes, synced as they type. Deliberately kept out of GameRoomState:
// that object is broadcast to every participant, and these are private.
const gmNotes = new Map<string, string>()               // gameCode → notes draft
const gmAwayTimers = new Map<string, ReturnType<typeof setTimeout>>() // gameCode → grace timer

/** How long the gamemaster may be gone before the session counts as over. */
const GM_AWAY_GRACE_MS = 90_000

let ioRef: Server | null = null

function socketsOf(gameCode: string, userId: string): string[] {
	return [...(userSockets.get(`${gameCode}:${userId}`) ?? [])]
}

function toGamemaster(state: GameRoomState, event: string, data: unknown): void {
	if (!ioRef) return
	for (const sid of socketsOf(state.gameCode, state.gamemasterId)) ioRef.to(sid).emit(event, data)
}

/**
 * Everything that has to happen when a session is over, whichever way it
 * ended: the recording stops and the notes go to the gamemaster.
 *
 * The GM pressing “end game” is only one of the ways out — hanging up,
 * closing the tab or losing the connection are just as final.
 */
async function closeOutSession(
	state: GameRoomState,
	reason: 'ended' | 'gm_left',
): Promise<void> {
	const gameCode = state.gameCode

	// LiveKit finishes the file and the link goes to the GM's Telegram
	await stopRecording(state.gameId).catch(err => {
		logger.warn('[closeout] could not stop the recording', { gameCode, error: err instanceof Error ? err.message : String(err) })
	})

	const notes = gmNotes.get(gameCode) ?? ''
	if (cleanNotes(notes)) {
		const delivered = await deliverGameNotes(gameCode, notes, state.gamemasterId, state.title, reason)
		if (delivered) {
			gmNotes.delete(gameCode)
			// The browser keeps its own copy until it hears the notes arrived
			toGamemaster(state, 'gr:notes-delivered', {})
		}
	}

	// A properly ended game goes soon; one the GM walked away from stays open
	// for the others, but an empty room must not sit in memory forever.
	if (reason === 'ended') scheduleRoomRelease(gameCode, 60_000, true)
	else scheduleRoomRelease(gameCode)
}

/**
 * May this person have the media for a breakout room?
 *
 * The socket refuses an uninvited join, and the video token has to refuse it
 * too — or a private breakout could be listened to by joining its LiveKit
 * room directly.
 */
export function canEnterBreakout(gameCode: string, roomId: string, userId: string): boolean {
	const state = rooms.get(gameCode)
	if (!state) return false
	if (state.gamemasterId === String(userId)) return true
	const br = state.breakoutRooms.find(r => r.id === roomId)
	if (!br) return false
	return br.invitedIds.includes(String(userId)) || br.playerIds.includes(String(userId))
}

/**
 * Drops a room once nobody is left in it (or right away when `force`).
 *
 * Checked again after the delay, because players reconnect — and rechecked
 * later if someone is still there, so a room is never released underneath an
 * active game.
 */
function scheduleRoomRelease(gameCode: string, delayMs = 10 * 60 * 1000, force = false): void {
	const existing = endTimers.get(gameCode)
	if (existing) clearTimeout(existing)

	const timer = setTimeout(() => {
		endTimers.delete(gameCode)
		const state = rooms.get(gameCode)
		if (!state) return
		if (!force && state.players.some(p => p.connected)) {
			scheduleRoomRelease(gameCode)   // still in use, look again later
			return
		}
		releaseRoom(gameCode)
		logger.info(`[cleanup] released room ${gameCode}`)
	}, delayMs)
	endTimers.set(gameCode, timer)
}

function cancelRoomRelease(gameCode: string): void {
	const existing = endTimers.get(gameCode)
	if (existing) { clearTimeout(existing); endTimers.delete(gameCode) }
}

function clearBreakoutTimers(gameCode: string, state: GameRoomState | undefined): void {
	state?.breakoutRooms.forEach(br => {
		const key = `${gameCode}:${br.id}`
		const tid = breakoutTimers.get(key)
		if (tid) { clearTimeout(tid); breakoutTimers.delete(key) }
	})
}

/** Forgets every trace of a room, so a long-lived process doesn't leak. */
function releaseRoom(gameCode: string): void {
	const state = rooms.get(gameCode)
	clearBreakoutTimers(gameCode, state)
	cancelRoomRelease(gameCode)
	for (const key of [...userSockets.keys()]) {
		if (key.startsWith(`${gameCode}:`)) userSockets.delete(key)
	}
	const away = gmAwayTimers.get(gameCode)
	if (away) clearTimeout(away)
	rooms.delete(gameCode)
	gmNotes.delete(gameCode)
	gmAwayTimers.delete(gameCode)
}

/**
 * The game was deleted: whoever is still inside is told the room is gone,
 * and the room is forgotten. Its recording, if any, is stopped.
 */
export async function closeDeletedGame(gameCode: string, gameId: string): Promise<void> {
	await stopRecording(gameId).catch(() => undefined)
	if (ioRef && rooms.has(gameCode)) {
		ioRef.to(`gr-${gameCode}`).emit('gr:error', 'Room not found')
		ioRef.in(`gr-${gameCode}`).socketsLeave(`gr-${gameCode}`)
	}
	releaseRoom(gameCode)
}

/**
 * The game is over for everyone in the room — the GM pressed "end", or the
 * administrator closed the room.
 */
function endSession(io: Server, state: GameRoomState): void {
	clearBreakoutTimers(state.gameCode, state)
	state.status = 'ended'
	state.messages = []
	pushState(io, state)
	emit(io, state.gameCode, 'gr:end-anim', {})
	// Stops the recording, delivers whatever notes the server holds and
	// schedules the room's release. The room also sends the notes over
	// HTTP so the GM sees the result; the draft is cleared on success,
	// so only one of the two ever delivers.
	void closeOutSession(state, 'ended')
	GameMessage.deleteMany({ gameId: state.gameId }).catch(() => { /* ignore */ })
}

// ── For the administrator ───────────────────────────────────────────────────

export interface RoomSummary {
	gameId: string
	title: string
	status: GameRoomState['status']
	players: number
	spectators: number
	gamemasterOnline: boolean
	isRecording: boolean
	breakouts: number
}

/** The rooms open in memory right now. */
export function listRooms(): RoomSummary[] {
	return [...rooms.values()].map(s => ({
		gameId: s.gameId,
		title: s.title,
		status: s.status,
		players: s.players.filter(p => p.connected && !p.isSpectator && !p.isGamemaster).length,
		spectators: s.players.filter(p => p.connected && p.isSpectator).length,
		gamemasterOnline: s.players.some(p => p.isGamemaster && p.connected),
		isRecording: s.isRecording,
		breakouts: s.breakoutRooms.length,
	}))
}

/** Ends a room's session as if its gamemaster had. False if no such room is open. */
export function endRoomAsAdmin(gameId: string): boolean {
	const state = [...rooms.values()].find(s => s.gameId === gameId)
	if (!state || !ioRef) return false
	if (state.status !== 'ended') endSession(ioRef, state)
	else scheduleRoomRelease(state.gameCode, 0, true)
	return true
}

/**
 * Throws a blocked member out: every socket closed, every media seat
 * removed. Their tokens are already refused, so they cannot come back.
 */
export async function kickUser(userId: string): Promise<void> {
	if (!ioRef) return
	const sockets = await ioRef.fetchSockets()
	for (const sock of sockets) {
		if (String(sock.data.userId) !== String(userId)) continue
		sock.emit('gr:error', 'Unauthorized')
		sock.disconnect(true)
	}
	for (const state of rooms.values()) {
		const p = state.players.find(pl => pl.userId === String(userId))
		if (!p) continue
		const roomName = p.breakoutRoomId ? roomNameFor(state.gameId, p.breakoutRoomId) : roomNameFor(state.gameId)
		await roomService.removeParticipant(roomName, String(userId)).catch(() => undefined)
		if (roomName !== roomNameFor(state.gameId)) {
			await roomService.removeParticipant(roomNameFor(state.gameId), String(userId)).catch(() => undefined)
		}
	}
}

/**
 * The gamemaster leaving without ending the game is still the end of the
 * session — but a reload or a dropped connection looks identical at this
 * point, so give them a grace period to come back first.
 */
function scheduleGmAwayCloseOut(io: Server, state: GameRoomState, gameCode: string, userId: string): void {
	if (userId !== state.gamemasterId) return
	if (gmAwayTimers.has(gameCode)) return

	const timer = setTimeout(() => {
		gmAwayTimers.delete(gameCode)
		const current = rooms.get(gameCode)
		if (!current) return
		const gmBack = current.players.some(p => p.userId === current.gamemasterId && p.connected)
		if (gmBack) return
		logger.info(`[disconnect] gamemaster gone for ${GM_AWAY_GRACE_MS / 1000}s, closing out gameCode=${gameCode}`)
		void closeOutSession(current, 'gm_left')
	}, GM_AWAY_GRACE_MS)
	gmAwayTimers.set(gameCode, timer)
}

function initials(name: string | undefined): string {
	if (!name) return '??'
	return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '??'
}

function uid(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emit(io: Server, gameCode: string, event: string, data: unknown) {
	io.to(`gr-${gameCode}`).emit(event, data)
}

/**
 * Coins changed hands — everyone in the room, spectators included, sees them
 * fly ('bank' is the gamemaster's bank). Only an animation: the numbers
 * themselves travel in gr:state.
 */
function coinsMoved(io: Server, state: GameRoomState, from: string, to: string, amount: number): void {
	emit(io, state.gameCode, 'gr:coins-moved', { from, to, amount })
}

/**
 * Everything in here reaches every participant, spectators included. So it
 * carries neither the scenario nor the GM's image deck (both spoilers, one
 * DevTools tab away), nor the entry code — spectators hold only their own
 * code, and must not learn the one that gives a voice.
 */
function publicState(state: GameRoomState): Omit<GameRoomState, 'scenario' | 'gameCode' | 'images'> & { images: string[]; serverNow: number } {
	const { scenario: _scenario, gameCode: _gameCode, images: _images, ...rest } = state
	return {
		...rest,
		images: [],
		// Timers end at a server timestamp, and every viewer used to compare it
		// with their own clock. A device a few minutes off showed a different
		// countdown to everyone else in the same round.
		serverNow: Date.now(),
		activeVote: hideVoters(rest.activeVote),
		spectatorVote: hideVoters(rest.spectatorVote),
	}
}

/**
 * A vote marked anonymous used to travel with the full list of who chose
 * what, and the lock icon in the interface was the only thing hiding it.
 *
 * The tally still has to add up, so each voter is replaced by a blank: the
 * counts survive, the names do not. Voters learn their own choice from
 * gr:my-vote, addressed to them alone.
 */
function hideVoters<T extends { isAnonymous?: boolean; options: Array<{ voterIds: string[] }> } | null>(vote: T): T {
	if (!vote || !vote.isAnonymous) return vote
	return {
		...vote,
		options: vote.options.map(o => ({ ...o, voterIds: o.voterIds.map(() => '') })),
	} as T
}

function pushState(io: Server, state: GameRoomState) {
	emit(io, state.gameCode, 'gr:state', publicState(state))
	sendGmState(state)
}

/** The gamemaster's own view: scenario, image deck and how recording works, to their sockets only. */
function sendGmState(state: GameRoomState) {
	toGamemaster(state, 'gr:gm-state', { scenario: state.scenario, images: state.images, recordingMode: recordingMode() })
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

	// A recording keeps running in LiveKit across a restart of this server
	const recording = await activeRecording(gameId).catch(() => null)

	const state: GameRoomState = {
		gameCode,
		gameId,
		status: 'lobby',
		coinsPerPlayer:     game.useCoins    ? game.coinsPerPlayer    : 0,
		coinsEnabled:       !!game.useCoins,
		startingBank:       game.useCoins ? (game.startingBank ?? 0) : 0,
		influencePerPlayer: game.useInfluence ? game.influencePerPlayer : 0,
		players: [],
		bankCoins:          game.useCoins ? (game.startingBank ?? 0) : 0,
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
		isRecording: recording?.status === 'recording',
	}
	rooms.set(gameCode, state)
	// A draft left by a previous process (restart, redeploy) is still owed
	// to the gamemaster.
	if (game.gmNotes) gmNotes.set(gameCode, game.gmNotes)
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
	return state.gamemasterId === userId
}

/** Recording progress from LiveKit reaches the room it belongs to. */
function onRecordingEvent(io: Server, event: RecordingEvent): void {
	const state = [...rooms.values()].find(s => s.gameId === event.gameId)
	if (!state) return
	const wasRecording = state.isRecording
	state.isRecording = event.status === 'recording'
	toGamemaster(state, 'gr:record-status', { status: event.status, detail: event.detail })
	if (wasRecording !== state.isRecording) pushState(io, state)
}

export function registerGameRoom(io: Server) {
	ioRef = io
	recordingEvents.on('status', (event: RecordingEvent) => onRecordingEvent(io, event))
	// The game is over: the gamemaster's browser, if it is recording, finishes
	// the file. If it is gone, the server closes it from the parts it has.
	recordingEvents.on('stop-request', ({ gameId }: { gameId: string }) => {
		const state = [...rooms.values()].find(s => s.gameId === gameId)
		if (state) toGamemaster(state, 'gr:record-stop', {})
	})

	io.on('connection', (socket: Socket) => {
		// The room this socket joined. Every event after gr:join acts on it,
		// whatever room the payload names — the payload's code is ignored.
		let curCode: string | null = null
		let curUser: string | null = null

		const here = (): GameRoomState | undefined => (curCode ? rooms.get(curCode) : undefined)
		const hereAsGM = (): GameRoomState | undefined => {
			const state = here()
			return state && curUser && isGM(state, curUser) ? state : undefined
		}

		// ── Join ────────────────────────────────────────────────────────────
		// userId is taken exclusively from the JWT verified at handshake (socket.data.userId),
		// NOT from the client payload. This prevents identity spoofing / IDOR.
		socket.on('gr:join', validateSocketEvent(grJoinSchema, async (d: any) => {
			const userId = socket.data.userId as string | null
			if (!userId) { socket.emit('gr:error', 'Unauthorized'); return }

			// The code presented decides the seat — see resolveSeat
			const seat = await resolveSeat(d.gameCode, userId)
			if (!seat) { socket.emit('gr:error', 'Room not found'); return }
			const gameCode = seat.gameCode

			const knownBefore = rooms.has(gameCode)
			const state = await getOrLoadRoom(gameCode)
			if (!state) { socket.emit('gr:error', 'Room not found'); return }

			// The room was rebuilt from nothing — after a restart, or once it had
			// been released — while other people were still sitting in it. Ask
			// them to announce themselves so their tiles come back.
			if (!knownBefore) {
				const others = io.sockets.adapter.rooms.get(`gr-${gameCode}`)
				if (others && others.size > 0) {
					logger.info(`[gr:join] room rebuilt, asking ${others.size} connected socket(s) to re-announce gameCode=${gameCode}`)
					io.to(`gr-${gameCode}`).emit('gr:rejoin')
				}
			}

			// One socket, one room: leaving an old one keeps the rosters honest
			if (curCode && curCode !== gameCode) {
				socket.leave(`gr-${curCode}`)
				userSockets.get(`${curCode}:${userId}`)?.delete(socket.id)
			}

			curCode = gameCode
			curUser = userId
			socket.join(`gr-${gameCode}`)
			// Someone is here again: a pending release must not pull the room away
			if (state.status !== 'ended') cancelRoomRelease(gameCode)

			// Track this socket for multi-tab / multi-connection deduplication
			const uKey = `${gameCode}:${userId}`
			if (!userSockets.has(uKey)) userSockets.set(uKey, new Set())
			userSockets.get(uKey)!.add(socket.id)

			const isGamemaster = seat.isCreator
			if (isGamemaster) {
				// They reconnected (reload, flaky network) — the session goes on
				const away = gmAwayTimers.get(gameCode)
				if (away) {
					clearTimeout(away)
					gmAwayTimers.delete(gameCode)
					logger.info(`[gr:join] gamemaster returned, session continues gameCode=${gameCode}`)
				}
			}
			const isSpectator = seat.asSpectator

			// The name everybody sees is the account's, not whatever the browser sent
			const account = await User.findById(userId).select('name surname email').lean()
			const name = ([account?.name, account?.surname].filter(Boolean).join(' ') || account?.email?.split('@')[0] || 'User').slice(0, 100)

			const existing = state.players.find(p => p.userId === userId)
			if (existing) {
				existing.socketId = socket.id
				existing.connected = true
				existing.name = name
				existing.initials = initials(name)
				// They came back with a different code (spectator → player or the reverse)
				if (existing.isSpectator !== isSpectator || existing.isGamemaster !== isGamemaster) {
					existing.isSpectator = isSpectator
					existing.isGamemaster = isGamemaster
					if (!isSpectator && !isGamemaster) {
						if (existing.coins === 0) existing.coins = state.coinsPerPlayer
						if (existing.influence === 0) existing.influence = state.influencePerPlayer
					} else {
						existing.coins = 0
						existing.influence = 0
						existing.handRaised = false
					}
				}
			} else {
				logger.info(`[gr:join] new player userId=${userId} gameCode=${gameCode} isGamemaster=${isGamemaster} isSpectator=${isSpectator}`)
				const p: RoomPlayer = {
					socketId: socket.id,
					userId,
					name,
					initials: initials(name),
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
		}, socket))

		// ── Chat ────────────────────────────────────────────────────────────
		socket.on('gr:chat', validateSocketEvent(grChatSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player) return

			const text = d.text.trim().slice(0, 500)
			if (!text) return

			// Spectators can only send public messages; filter out spectator recipients too
			const recipientIds: string[] = (player.isSpectator || !d.recipients?.length)
				? []
				: [...new Set<string>(d.recipients)].filter(id => {
					if (id === curUser) return false
					const target = state.players.find(p => p.userId === id)
					return target && !target.isSpectator
				})

			const isPrivate = recipientIds.length > 0
			const spectatorChat = player.isSpectator && !isPrivate
			const recipientNames = isPrivate
				? recipientIds.map(id => state.players.find(p => p.userId === id)?.name ?? '').filter(Boolean)
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
				emit(io, state.gameCode, 'gr:chat', msg)
			} else {
				// Private: deliver only to sender + recipients (every tab of each)
				for (const sid of socketsOf(state.gameCode, curUser)) io.to(sid).emit('gr:chat', msg)
				recipientIds.forEach(recipientId => {
					for (const sid of socketsOf(state.gameCode, recipientId)) io.to(sid).emit('gr:chat', msg)
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
		}, socket))

		// ── Reactions ───────────────────────────────────────────────────────
		socket.on('gr:react', validateSocketEvent(grReactSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			if (!state.players.some(p => p.userId === curUser)) return
			// Only the room's own reactions travel — not arbitrary text to everyone
			if (!(d.emoji in state.reactions)) return
			state.reactions[d.emoji]++
			emit(io, state.gameCode, 'gr:reactions', state.reactions)
			emit(io, state.gameCode, 'gr:player-reacted', { userId: curUser, emoji: d.emoji })
		}, socket))

		// ── Hand raise ──────────────────────────────────────────────────────
		socket.on('gr:hand', validateSocketEvent(grHandSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			const p = state.players.find(p => p.userId === curUser)
			if (!p || p.isSpectator) return
			p.handRaised = d.raised
			pushState(io, state)
		}, socket))

		// ── Set role ────────────────────────────────────────────────────────
		socket.on('gr:role', validateSocketEvent(grRoleSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			const requester = state.players.find(p => p.userId === curUser)
			if (!requester) return
			if (d.targetUserId !== curUser && !requester.isGamemaster) return
			const target = state.players.find(p => p.userId === d.targetUserId)
			if (target && !target.isSpectator) { target.role = d.role.slice(0, 60); pushState(io, state) }
		}, socket))

		// ── Start / End ─────────────────────────────────────────────────────
		socket.on('gr:start', validateSocketEvent(grStartSchema, async () => {
			const state = hereAsGM()
			if (!state) return

			// Cancel any pending release (allows restart after game end)
			cancelRoomRelease(state.gameCode)

			// Whoever sits in a breakout room is brought back with it
			clearBreakoutTimers(state.gameCode, state)
			state.players.forEach(p => {
				if (p.breakoutRoomId) {
					for (const sid of socketsOf(state.gameCode, p.userId)) io.to(sid).emit('gr:breakout-return', {})
				}
			})

			// Reset transient game state for clean restart
			state.status = 'started'
			state.activeVote = null
			state.spectatorVote = null
			state.timer = makeDefaultTimer(state.defaultTimerSeconds)
			state.announcement = null
			state.breakoutRooms = []
			state.bankCoins = state.startingBank
			state.players.forEach(p => {
				p.handRaised = false
				p.breakoutRoomId = null
				if (!p.isGamemaster && !p.isSpectator) {
					p.coins = state.coinsPerPlayer
					p.influence = state.influencePerPlayer
				}
			})

			pushState(io, state)
		}, socket))

		// Notes are synced as the GM types so the server always holds a copy
		// — the browser's is the only other one, and it leaves with the tab.
		socket.on('gr:notes', validateSocketEvent(grNotesSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			gmNotes.set(state.gameCode, d.notes)
			Game.updateOne({ gameCode: state.gameCode }, { gmNotes: d.notes }).catch(() => { /* draft only */ })
		}, socket))

		socket.on('gr:end', validateSocketEvent(grEndSchema, async () => {
			const state = hereAsGM()
			if (!state) return
			endSession(io, state)
		}, socket))

		// ── Coins: player → player ──────────────────────────────────────────
		socket.on('gr:coins-transfer', validateSocketEvent(grCoinsTransferSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			const from = state.players.find(p => p.userId === curUser)
			const to   = state.players.find(p => p.userId === d.toUserId)
			if (!from || !to || from === to || to.isSpectator || d.amount <= 0 || from.coins < d.amount) return
			from.coins -= d.amount
			to.coins   += d.amount
			pushState(io, state)
			coinsMoved(io, state, from.userId, to.userId, d.amount)
		}, socket))

		// ── Coins: player → bank ────────────────────────────────────────────
		socket.on('gr:coins-bank', validateSocketEvent(grCoinsBankSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			const p = state.players.find(p => p.userId === curUser)
			if (!p || d.amount <= 0 || p.coins < d.amount) return
			p.coins -= d.amount
			state.bankCoins += d.amount
			pushState(io, state)
			coinsMoved(io, state, p.userId, 'bank', d.amount)
		}, socket))

		// ── Bank → player (GM only) ─────────────────────────────────────────
		socket.on('gr:bank-give', validateSocketEvent(grBankGiveSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			const to = state.players.find(p => p.userId === d.toUserId)
			if (!to || to.isGamemaster || to.isSpectator) return
			if (d.amount <= 0 || d.amount > state.bankCoins) {
				socket.emit('gr:action-error', 'Not enough coins in the bank')
				return
			}
			state.bankCoins -= d.amount
			to.coins += d.amount
			pushState(io, state)
			coinsMoved(io, state, 'bank', to.userId, d.amount)
		}, socket))

		// ── Influence (GM only) ─────────────────────────────────────────────
		socket.on('gr:influence', validateSocketEvent(grInfluenceSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			const target = state.players.find(p => p.userId === d.targetUserId)
			if (target) { target.influence = Math.max(0, target.influence + d.delta); pushState(io, state) }
		}, socket))

		// ── Mute all (GM only) ──────────────────────────────────────────────
		// The signal lets well-behaved clients update their buttons; the media
		// server does the muting, so a modified client cannot ignore it.
		socket.on('gr:mute-all', validateSocketEvent(grMuteAllSchema, async () => {
			const state = hereAsGM()
			if (!state) return
			emit(io, state.gameCode, 'gr:mute-all', {})
			await muteMicrophones(roomNameFor(state.gameId), identity => identity !== state.gamemasterId)
		}, socket))

		// ── Mute player (GM only) ───────────────────────────────────────────
		socket.on('gr:mute-player', validateSocketEvent(grMutePlayerSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			for (const sid of socketsOf(state.gameCode, d.targetUserId)) io.to(sid).emit('gr:mute-player', {})
			const target = state.players.find(p => p.userId === d.targetUserId)
			await muteMicrophones(roomNameFor(state.gameId, target?.breakoutRoomId ?? undefined), identity => identity === d.targetUserId)
		}, socket))

		// ── Announcement ────────────────────────────────────────────────────
		socket.on('gr:announce', validateSocketEvent(grAnnounceSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			state.announcement = d.text ? d.text.slice(0, 500) : null
			pushState(io, state)
		}, socket))

		// ── Timer ───────────────────────────────────────────────────────────
		socket.on('gr:timer', validateSocketEvent(grTimerSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state || !curUser) return
			const gmPlayer = state.players.find(p => p.userId === curUser)
			const brId = gmPlayer?.breakoutRoomId ?? null
			const br = brId ? state.breakoutRooms.find(r => r.id === brId) : null
			// Scoped to the GM's current breakout room, or the main room
			const holder: { timer: RoomTimer | null } = br ?? state

			if (d.action === 'set' && d.label && d.seconds) {
				const secs = Math.floor(Number(d.seconds))
				if (!Number.isFinite(secs) || secs < 1 || secs > 86400) return
				holder.timer = { label: String(d.label).slice(0, 100), totalSeconds: secs, endsAt: null, running: false }
			} else if (d.action === 'start' && holder.timer) {
				holder.timer.running = true
				holder.timer.endsAt  = Date.now() + holder.timer.totalSeconds * 1000
			} else if (d.action === 'stop' && holder.timer) {
				holder.timer.running = false
				holder.timer.endsAt  = null
			} else if (d.action === 'clear') {
				holder.timer = null
			}
			pushState(io, state)
		}, socket))

		// ── Voting (players only) ───────────────────────────────────────────
		socket.on('gr:vote-create', validateSocketEvent(grVoteCreateSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			state.activeVote = makeVote(d, false)
			pushState(io, state)
		}, socket))

		socket.on('gr:vote-cast', validateSocketEvent(grVoteCastSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser || !state.activeVote || state.activeVote.closed) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player || player.isSpectator) return
			castVote(state.activeVote, curUser, d.optionIds)
			pushState(io, state)
		}, socket))

		socket.on('gr:vote-close', validateSocketEvent(grVoteCloseSchema, async () => {
			const state = hereAsGM()
			if (!state) return
			if (state.activeVote) { state.activeVote.closed = true; pushState(io, state) }
		}, socket))

		socket.on('gr:vote-clear', validateSocketEvent(grVoteClearSchema, async () => {
			const state = hereAsGM()
			if (!state) return
			state.activeVote = null
			pushState(io, state)
		}, socket))

		// ── Spectator voting ────────────────────────────────────────────────
		socket.on('gr:spectator-vote-create', validateSocketEvent(grSpectatorVoteCreateSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			state.spectatorVote = makeVote(d, true)
			pushState(io, state)
		}, socket))

		socket.on('gr:spectator-vote-cast', validateSocketEvent(grSpectatorVoteCastSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser || !state.spectatorVote || state.spectatorVote.closed) return
			const player = state.players.find(p => p.userId === curUser)
			if (!player || (!player.isSpectator && !player.isGamemaster)) return
			castVote(state.spectatorVote, curUser, d.optionIds)
			pushState(io, state)
		}, socket))

		socket.on('gr:spectator-vote-close', validateSocketEvent(grSpectatorVoteCloseSchema, async () => {
			const state = hereAsGM()
			if (!state) return
			if (state.spectatorVote) { state.spectatorVote.closed = true; pushState(io, state) }
		}, socket))

		socket.on('gr:spectator-vote-clear', validateSocketEvent(grSpectatorVoteClearSchema, async () => {
			const state = hereAsGM()
			if (!state) return
			state.spectatorVote = null
			pushState(io, state)
		}, socket))

		function castVote(vote: ActiveVote, voterId: string, optionIds: string[]): void {
			vote.options.forEach(o => { o.voterIds = o.voterIds.filter(id => id !== voterId) })
			const chosen = (vote.multipleChoice ? [...new Set(optionIds)] : [optionIds[0]])
				.filter(oid => vote.options.some(o => o.id === oid))
			chosen.forEach(oid => vote.options.find(o => o.id === oid)!.voterIds.push(voterId))
			socket.emit('gr:my-vote', { voteId: vote.id, optionIds: chosen })
		}

		// ── Breakout rooms ──────────────────────────────────────────────────
		socket.on('gr:breakout-create', validateSocketEvent(grBreakoutCreateSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			// A refusal, not a broken room: gr:error would throw the gamemaster
			// out to the "room not found" screen mid-game.
			if (state.breakoutRooms.length >= 5) { socket.emit('gr:action-error', 'Max 5 breakout rooms'); return }
			const br: BreakoutRoom = {
				id: uid(), name: d.name.slice(0, 50),
				imageUrl: d.imageUrl || '',
				timerSeconds: d.timerSeconds ?? null,
				endsAt: null, playerIds: [], invitedIds: [],
				timer: null,
				shownImageUrl: null,
			}
			state.breakoutRooms.push(br)
			pushState(io, state)
		}, socket))

		socket.on('gr:breakout-invite', validateSocketEvent(grBreakoutAssignSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			d.playerIds.forEach((playerId: string) => {
				const target = state.players.find(p => p.userId === playerId)
				if (!target || target.isSpectator) return
				if (!br.invitedIds.includes(playerId)) br.invitedIds.push(playerId)
				for (const sid of socketsOf(state.gameCode, playerId)) {
					io.to(sid).emit('gr:breakout-invited', { roomId: d.roomId, roomName: br.name, imageUrl: br.imageUrl })
				}
			})
			pushState(io, state)
		}, socket))

		socket.on('gr:breakout-join', validateSocketEvent(grBreakoutJoinSchema, async (d: any) => {
			const state = here()
			if (!state || !curUser) return
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			// Invitations are sent to named players; joining has to respect that,
			// or a private breakout discussion is private in name only.
			if (!br.invitedIds.includes(curUser) && !isGM(state, curUser)) {
				socket.emit('gr:action-error', 'Not invited to this room')
				return
			}
			// Remove from any current breakout
			state.breakoutRooms.forEach(r => { r.playerIds = r.playerIds.filter(id => id !== curUser) })
			br.playerIds.push(curUser)
			const p = state.players.find(p => p.userId === curUser)
			if (p) p.breakoutRoomId = d.roomId
			// Start timer if first join
			if (br.timerSeconds && !br.endsAt) {
				br.endsAt = Date.now() + br.timerSeconds * 1000
				const gameCode = state.gameCode
				const tKey = `${gameCode}:${d.roomId}`
				const tid = setTimeout(() => {
					breakoutTimers.delete(tKey)
					const s = rooms.get(gameCode)
					if (!s) return
					const r = s.breakoutRooms.find(r => r.id === d.roomId)
					if (!r) return
					logger.info(`[breakout-timer] expired roomId=${d.roomId} gameCode=${gameCode} returning ${r.playerIds.length} players`)
					r.playerIds.forEach(playerId => {
						const pl = s.players.find(p => p.userId === playerId)
						if (pl) pl.breakoutRoomId = null
						for (const sid of socketsOf(gameCode, playerId)) io.to(sid).emit('gr:breakout-return', {})
					})
					r.playerIds = []
					r.endsAt = null
					pushState(io, s)
				}, br.timerSeconds * 1000)
				breakoutTimers.set(tKey, tid)
			}
			pushState(io, state)
		}, socket))

		socket.on('gr:breakout-leave', validateSocketEvent(grBreakoutLeaveSchema, async () => {
			const state = here()
			if (!state || !curUser) return
			state.breakoutRooms.forEach(r => { r.playerIds = r.playerIds.filter(id => id !== curUser) })
			const p = state.players.find(p => p.userId === curUser)
			if (p) p.breakoutRoomId = null
			pushState(io, state)
		}, socket))

		socket.on('gr:breakout-end', validateSocketEvent(grBreakoutEndSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state) return
			// Cancel any running auto-return timer for this room
			const tKey = `${state.gameCode}:${d.roomId}`
			const tid = breakoutTimers.get(tKey)
			if (tid) { clearTimeout(tid); breakoutTimers.delete(tKey) }
			const br = state.breakoutRooms.find(r => r.id === d.roomId)
			if (!br) return
			br.playerIds.forEach(playerId => {
				const pl = state.players.find(p => p.userId === playerId)
				if (pl) pl.breakoutRoomId = null
				for (const sid of socketsOf(state.gameCode, playerId)) io.to(sid).emit('gr:breakout-return', {})
			})
			state.breakoutRooms = state.breakoutRooms.filter(r => r.id !== d.roomId)
			pushState(io, state)
		}, socket))

		// ── Show image ──────────────────────────────────────────────────────
		socket.on('gr:image-show', validateSocketEvent(grImageShowSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state || !curUser) return
			const gmPlayer = state.players.find(p => p.userId === curUser)
			const brId = gmPlayer?.breakoutRoomId ?? null
			const br = brId ? state.breakoutRooms.find(r => r.id === brId) : null
			if (br) {
				br.shownImageUrl = d.imageUrl
			} else {
				state.shownImageUrl = d.imageUrl
			}
			pushState(io, state)
		}, socket))

		// ── Recording (GM only, RECORDING_MODE=egress) ──────────────────────
		// LiveKit records the main room on its own servers. In browser mode the
		// gamemaster's browser records and talks to /api/recordings instead.
		// Progress comes back through recordingEvents either way.
		socket.on('gr:record-control', validateSocketEvent(grRecordControlSchema, async (d: any) => {
			const state = hereAsGM()
			if (!state || !curUser) return
			if (recordingMode() !== 'egress') {
				socket.emit('gr:record-status', { status: 'error', detail: 'Recording runs in the browser on this server' })
				return
			}
			try {
				if (d.action === 'start') {
					await startEgressRecording({ gameId: state.gameId, gameCode: state.gameCode, gameTitle: state.title, gmId: curUser })
				} else {
					const stopped = await stopRecording(state.gameId)
					if (!stopped) socket.emit('gr:record-status', { status: 'idle' })
				}
			} catch (err) {
				const detail = err instanceof RecordingError ? err.message : 'Recording failed'
				socket.emit('gr:record-status', { status: 'error', detail })
			}
		}, socket))

		// ── Disconnect ──────────────────────────────────────────────────────
		socket.on('disconnect', () => {
			if (!curCode || !curUser) return
			const state = rooms.get(curCode)
			if (!state) return

			// Remove this socket from per-user tracking to handle multi-tab correctly
			const uKey = `${curCode}:${curUser}`
			const sockets = userSockets.get(uKey)
			sockets?.delete(socket.id)
			const p = state.players.find(p => p.userId === curUser)

			if (!sockets || sockets.size === 0) {
				// No remaining connections for this user — mark disconnected
				userSockets.delete(uKey)
				if (p) { p.connected = false; p.socketId = '' }
				logger.info(`[disconnect] userId=${curUser} gameCode=${curCode} fully disconnected`)
				pushState(io, state)
				scheduleGmAwayCloseOut(io, state, curCode, curUser)
				if (!state.players.some(pl => pl.connected)) scheduleRoomRelease(curCode)
			} else if (p && p.socketId === socket.id) {
				// Another tab is still open — point at a live socket
				p.socketId = [...sockets][sockets.size - 1]
			}
		})
	})
}

function makeVote(d: { question: string; options: string[]; isAnonymous: boolean; multipleChoice: boolean }, spectatorOnly: boolean): ActiveVote {
	return {
		id: uid(),
		question: d.question.slice(0, 300),
		options: d.options.map((t, i) => ({ id: `o${i}`, text: t.slice(0, 100), voterIds: [] })),
		isAnonymous: d.isAnonymous,
		multipleChoice: d.multipleChoice,
		closed: false,
		...(spectatorOnly ? { spectatorOnly: true } : {}),
	}
}
