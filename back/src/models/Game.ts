import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IRegisteredPlayer {
	userId: Types.ObjectId
	name: string
	surname: string
	registeredAt: Date
}

export interface IGame extends Document {
	title: string
	creatorId: Types.ObjectId
	creatorName: string
	minPlayers: number
	maxPlayers: number
	description: string
	scenario: string
	useCoins: boolean
	coinsPerPlayer: number
	useInfluence: boolean
	influencePerPlayer: number
	scheduledAt?: Date
	coverImage: string
	images: string[]
	gameCode: string
	spectatorCode: string
	registeredPlayers: IRegisteredPlayer[]
	spectators: IRegisteredPlayer[]
	likesCount: number
	createdAt: Date
	updatedAt: Date
}

const RegisteredPlayerSchema = new Schema<IRegisteredPlayer>(
	{
		userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
		name:         { type: String, required: true },
		surname:      { type: String, default: '' },
		registeredAt: { type: Date, default: Date.now },
	},
	{ _id: false }
)

const GameSchema = new Schema<IGame>(
	{
		title:              { type: String, required: true, trim: true },
		creatorId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
		creatorName:        { type: String, required: true },
		minPlayers:         { type: Number, required: true, min: 1, default: 2 },
		maxPlayers:         { type: Number, required: true, min: 1, default: 6 },
		description:        { type: String, default: '', maxlength: 500 },
		scenario:           { type: String, default: '' },
		useCoins:           { type: Boolean, default: false },
		coinsPerPlayer:     { type: Number, default: 0 },
		useInfluence:       { type: Boolean, default: false },
		influencePerPlayer: { type: Number, default: 0 },
		scheduledAt:        { type: Date },
		coverImage:         { type: String, default: '' },
		images:             { type: [String], default: [] },
		gameCode:           { type: String, unique: true, sparse: true },
		spectatorCode:      { type: String, unique: true, sparse: true },
		registeredPlayers:  { type: [RegisteredPlayerSchema], default: [] },
		spectators:         { type: [RegisteredPlayerSchema], default: [] },
		likesCount:         { type: Number, default: 0 },
	},
	{ timestamps: true, collection: 'our_games' }
)

export const Game = mongoose.model<IGame>('Game', GameSchema)
