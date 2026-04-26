import mongoose, { Document, Schema } from 'mongoose'

export interface IGameMessage extends Document {
	gameId: string
	senderId: string
	senderName: string
	text: string
	recipients: string[]
	recipientNames: string[]
	createdAt: Date
}

const GameMessageSchema = new Schema<IGameMessage>(
	{
		gameId:         { type: String, required: true, index: true },
		senderId:       { type: String, required: true },
		senderName:     { type: String, required: true },
		text:           { type: String, required: true },
		recipients:     { type: [String], default: [] },
		recipientNames: { type: [String], default: [] },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
)

export const GameMessage = mongoose.model<IGameMessage>('GameMessage', GameMessageSchema)
