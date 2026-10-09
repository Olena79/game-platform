import { Game } from '../models/Game'

/** Codes are 6 characters of an unambiguous alphabet; anything else is not a code. */
const CODE_RE = /^[A-Z0-9]{4,12}$/

export interface Seat {
	gameId: string
	/** The entry code. Internal: never send it to someone who holds only the spectator code. */
	gameCode: string
	isCreator: boolean
	/** A silent seat: no camera, no microphone, no player controls */
	asSpectator: boolean
}

/**
 * May this person have a seat in this game, and with a voice or without?
 *
 * The code is the pass — a deliberate decision for the club's current size
 * (see CLAUDE.md, "The game code is the pass"). Whoever holds the entry code
 * gets a seat with a voice; whoever holds the spectator code gets a silent
 * one. The gamemaster always speaks. A player registered on the site keeps
 * their voice even when they came in with the spectator code.
 *
 * The *presented* code decides, on the server. It used to be decided by a
 * flag the browser sent, and the spectator code resolved to the entry code
 * in a public response — so a spectator could simply speak.
 *
 * When the club outgrows this (~100 members), this is the one place to
 * require registration: check `registeredPlayers` / `spectators` below
 * instead of accepting the code alone.
 *
 * What must never come back: a seat for a room the caller merely named
 * without presenting a code.
 */
/** Players and spectators may come in this long before the game's time */
export const OPENS_BEFORE_MS = 10 * 60 * 1000
/** After the gamemaster's session ends (the game's time having come), the room stays open this long */
export const CLOSES_AFTER_SESSION_MS = 30 * 60 * 1000
/** A game never played: closed to players this long after its time all the same */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export type Refusal = { reason: 'REMOVED' } | { reason: 'PAYMENT_BLOCKED' } | { reason: 'SPECTATORS_CLOSED' } | { reason: 'NOT_YET'; opensAt: Date } | { reason: 'CLOSED' }

/**
 * When may players and spectators be in the room? (The gamemaster: always.)
 *
 * From ten minutes before the game's time — the Telegram reminder goes out
 * then — until half an hour after the gamemaster's session has ended
 * (`closedAt`, set when the session closes out once the time has come), or
 * a day after the time when nobody ever played it. Rescheduling clears
 * `closedAt` and opens a new window. A game with no date yet keeps the old
 * rule: the code alone is the pass.
 */
export function timeRefusal(game: { scheduledAt?: Date | null; closedAt?: Date | null }, now = Date.now()): Refusal | null {
	if (game.closedAt && now >= new Date(game.closedAt).getTime()) return { reason: 'CLOSED' }
	if (!game.scheduledAt) return null
	const at = new Date(game.scheduledAt).getTime()
	if (now < at - OPENS_BEFORE_MS) return { reason: 'NOT_YET', opensAt: new Date(at - OPENS_BEFORE_MS) }
	if (now > at + STALE_AFTER_MS) return { reason: 'CLOSED' }
	return null
}

export async function resolveSeat(presentedCode: unknown, userId: string): Promise<Seat | null> {
	if (typeof presentedCode !== 'string') return null
	const code = presentedCode.trim().toUpperCase()
	if (!CODE_RE.test(code)) return null

	const game = await Game.findOne({ $or: [{ gameCode: code }, { spectatorCode: code }] })
		.select('gameCode spectatorCode creatorId registeredPlayers bannedUserIds accessBlockedUserIds scheduledAt closedAt spectatorsClosed')
	if (!game) return null

	const uid = String(userId)
	const isCreator = String(game.creatorId) === uid
	// Removed by the gamemaster: no code opens this game for them again
	if (!isCreator && (game.bannedUserIds ?? []).includes(uid)) return null
	// The gamemaster closed this person's access (a paid game not paid yet):
	// no code lets them in until it is opened again
	if (!isCreator && (game.accessBlockedUserIds ?? []).includes(uid)) return null
	// Outside the game's time only the gamemaster gets in
	if (!isCreator && timeRefusal(game)) return null
	const isRegisteredPlayer = game.registeredPlayers.some(p => String(p.userId) === uid)
	const heldSpectatorCode = game.spectatorCode === code && game.gameCode !== code
	// A game closed to spectators: their code opens nothing (a registered
	// player who came in with it keeps their voiced seat)
	if (heldSpectatorCode && !isCreator && !isRegisteredPlayer && game.spectatorsClosed) return null

	return {
		gameId: String(game._id),
		gameCode: game.gameCode,
		isCreator,
		asSpectator: heldSpectatorCode && !isCreator && !isRegisteredPlayer,
	}
}

/**
 * Why resolveSeat said no to this person — for the message on their screen
 * only; resolveSeat alone decides. Null: the code opens nothing.
 */
export async function seatRefusal(presentedCode: unknown, userId: string): Promise<Refusal | null> {
	if (typeof presentedCode !== 'string') return null
	const code = presentedCode.trim().toUpperCase()
	if (!CODE_RE.test(code)) return null
	const game = await Game.findOne({ $or: [{ gameCode: code }, { spectatorCode: code }] })
		.select('gameCode spectatorCode creatorId registeredPlayers bannedUserIds accessBlockedUserIds scheduledAt closedAt spectatorsClosed')
	if (!game || String(game.creatorId) === String(userId)) return null
	if ((game.bannedUserIds ?? []).includes(String(userId))) return { reason: 'REMOVED' }
	if ((game.accessBlockedUserIds ?? []).includes(String(userId))) return { reason: 'PAYMENT_BLOCKED' }
	if (game.spectatorsClosed && game.spectatorCode === code && game.gameCode !== code
		&& !(game.registeredPlayers ?? []).some(p => String(p.userId) === String(userId))) return { reason: 'SPECTATORS_CLOSED' }
	return timeRefusal(game)
}

/** The refusal as the one string the room's screens understand */
export function refusalMessage(refusal: Refusal | null, fallback: string): string {
	if (!refusal) return fallback
	return refusal.reason === 'NOT_YET' ? `NOT_YET:${refusal.opensAt.toISOString()}` : refusal.reason
}
