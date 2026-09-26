import { Game } from '../models/Game'
import { GameLike } from '../models/GameLike'
import { GameMessage } from '../models/GameMessage'
import { closeDeletedGame } from '../socket/gameRoom'

/**
 * Deletes a game and everything of it: likes, chat, and a room still open
 * (whose recording is stopped). The same whether the gamemaster or the
 * administrator deletes it.
 */
export async function deleteGame(game: { _id: unknown; gameCode: string }): Promise<void> {
	await Game.deleteOne({ _id: game._id })
	await Promise.all([
		GameLike.deleteMany({ gameId: game._id }),
		GameMessage.deleteMany({ gameId: String(game._id) }),
		closeDeletedGame(game.gameCode, String(game._id)),
	])
}
