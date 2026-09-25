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
export async function resolveSeat(presentedCode: unknown, userId: string): Promise<Seat | null> {
	if (typeof presentedCode !== 'string') return null
	const code = presentedCode.trim().toUpperCase()
	if (!CODE_RE.test(code)) return null

	const game = await Game.findOne({ $or: [{ gameCode: code }, { spectatorCode: code }] })
		.select('gameCode spectatorCode creatorId registeredPlayers')
	if (!game) return null

	const uid = String(userId)
	const isCreator = String(game.creatorId) === uid
	const isRegisteredPlayer = game.registeredPlayers.some(p => String(p.userId) === uid)
	const heldSpectatorCode = game.spectatorCode === code && game.gameCode !== code

	return {
		gameId: String(game._id),
		gameCode: game.gameCode,
		isCreator,
		asSpectator: heldSpectatorCode && !isCreator && !isRegisteredPlayer,
	}
}
