import { Schema, model, Document } from 'mongoose'

export interface IRefreshToken extends Document {
	userId: Schema.Types.ObjectId
	token: string
	expiresAt: Date
	createdAt: Date
}

const refreshTokenSchema = new Schema<IRefreshToken>(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		token: { type: String, required: true, unique: true, index: true },
		expiresAt: { type: Date, required: true, index: true },
	},
	{ timestamps: true }
)

// Auto-delete expired tokens (MongoDB TTL index)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema)
