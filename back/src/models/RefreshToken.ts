import { Schema, model, Document } from 'mongoose'

export interface IRefreshToken extends Document {
	userId: string
	token: string
	expiresAt: Date
	createdAt: Date
}

const refreshTokenSchema = new Schema<IRefreshToken>(
	{
		userId: {
			type: String,
			required: true,
			index: true,
		},
		token: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		expiresAt: {
			type: Date,
			required: true,
			index: true,
			expires: 0,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
)

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema)
