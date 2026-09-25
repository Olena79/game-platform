import { Types } from 'mongoose'
import logger from '../config/logger'
import { User } from '../models/User'
import { Game } from '../models/Game'
import { Post } from '../models/Post'
import { Comment } from '../models/Comment'
import { GameLike } from '../models/GameLike'
import { GameMessage } from '../models/GameMessage'
import { Recording } from '../models/Recording'
import { RefreshToken } from '../models/RefreshToken'
import { deleteRecordingsOf } from './recording'
import { closeDeletedGame } from '../socket/gameRoom'
import { forgetUser } from '../middleware/authMiddleware'

/**
 * Where anonymised authorship points.
 *
 * Posts and comments stay in the feed — a conversation full of holes helps
 * nobody — but they must stop pointing at a person. The id is a constant that
 * belongs to no account, and `authorDeleted` lets the UI say so plainly.
 */
export const DELETED_AUTHOR_ID = new Types.ObjectId('000000000000000000000000')

export interface DeletionSummary {
	postsAnonymised: number
	commentsAnonymised: number
	gamesDeleted: number
	registrationsRemoved: number
	recordingsDeleted: number
}

/**
 * Everything the account owner can take with them.
 *
 * Deliberately built from the same collections the deletion touches, so the
 * export and the erasure cannot drift apart.
 */
export async function exportAccountData(userId: string) {
	const uid = new Types.ObjectId(userId)

	const [user, games, posts, comments, recordings] = await Promise.all([
		User.findById(uid).select('-password -telegramLinkTokenHash -telegramLinkExpiresAt -tokenVersion').lean(),
		Game.find({ creatorId: uid }).select('title description scenario gameCode createdAt scheduledAt').lean(),
		Post.find({ authorId: uid }).select('text topic createdAt likesCount commentsCount').lean(),
		Comment.find({ authorId: uid }).select('text postId createdAt').lean(),
		Recording.find({ gmId: uid })
			.select('gameTitle shareLink status createdAt expiresAt').lean(),
	])

	const registeredIn = await Game.find({
		$or: [{ 'registeredPlayers.userId': uid }, { 'spectators.userId': uid }],
	// No codes here: a spectator must not learn the entry code from an export
	}).select('title scheduledAt').lean()

	return {
		exportedAt: new Date().toISOString(),
		account: user,
		gamesCreated: games,
		gamesJoined: registeredIn,
		posts,
		comments,
		recordings,
	}
}

/**
 * Deletes the account and everything that identifies its owner.
 *
 * Games they created go with them — a game carries its entry codes, scenario
 * and the gamemaster's notes, and has no meaning without a gamemaster. Their
 * writing in the community stays, with the authorship removed.
 */
export async function deleteAccount(userId: string): Promise<DeletionSummary> {
	const uid = new Types.ObjectId(userId)
	if (!(await User.exists({ _id: uid }))) throw new Error('User not found')

	// ── their own games, and their recordings ─────────────────────────────
	const ownGames = await Game.find({ creatorId: uid }).select('_id gameCode')
	// Recordings are the GM's: file in the bucket and row both go
	const recordingsDeleted = await deleteRecordingsOf(String(uid))

	for (const game of ownGames) {
		await GameMessage.deleteMany({ gameId: String(game._id) })
		await GameLike.deleteMany({ gameId: game._id })
		await game.deleteOne()
		await closeDeletedGame(game.gameCode, String(game._id))
	}

	// ── their traces in other people's games ────────────────────────────────
	const registrations = await Game.updateMany(
		{ $or: [{ 'registeredPlayers.userId': uid }, { 'spectators.userId': uid }] },
		{ $pull: { registeredPlayers: { userId: uid }, spectators: { userId: uid } } },
	)

	// ── community: keep the words, drop the person ──────────────────────────
	const anonymous = { authorId: DELETED_AUTHOR_ID, authorName: '', authorSurname: '', authorDeleted: true }
	const posts = await Post.updateMany({ authorId: uid }, { $set: anonymous })
	const comments = await Comment.updateMany({ authorId: uid }, { $set: anonymous })

	// Likes are an opinion attached to a name, so they go entirely
	await Post.updateMany({ likedBy: uid }, { $pull: { likedBy: uid }, $inc: { likesCount: -1 } })
	await Comment.updateMany({ likedBy: uid }, { $pull: { likedBy: uid }, $inc: { likesCount: -1 } })
	const gameLikes = await GameLike.find({ userId: uid }).select('gameId')
	for (const like of gameLikes) {
		await Game.updateOne({ _id: like.gameId }, { $inc: { likesCount: -1 } })
	}
	await GameLike.deleteMany({ userId: uid })

	// In-game chat carries their name; the messages themselves are cleared at
	// the end of every game anyway.
	await GameMessage.updateMany({ senderId: String(uid) }, { $set: { senderName: '' } })

	await RefreshToken.deleteMany({ userId: String(uid) })
	await User.deleteOne({ _id: uid })
	// Access tokens live another hour; stop honouring them now
	forgetUser(String(uid))

	const summary: DeletionSummary = {
		postsAnonymised: posts.modifiedCount ?? 0,
		commentsAnonymised: comments.modifiedCount ?? 0,
		gamesDeleted: ownGames.length,
		registrationsRemoved: registrations.modifiedCount ?? 0,
		recordingsDeleted,
	}
	logger.info('[account] account deleted', { userId, ...summary })
	return summary
}
