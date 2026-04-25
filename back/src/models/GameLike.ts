import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IGameLike extends Document {
	userId: Types.ObjectId
	gameId: Types.ObjectId
}

const GameLikeSchema = new Schema<IGameLike>(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
	},
	{ timestamps: true, collection: 'game_likes' }
)

// Enforce 1 like per user per game at DB level
GameLikeSchema.index({ userId: 1, gameId: 1 }, { unique: true })

export const GameLike = mongoose.model<IGameLike>('GameLike', GameLikeSchema)
