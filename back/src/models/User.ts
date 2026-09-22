import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
	name?: string
	surname?: string
	email: string
	password: string
	googleId?: string
	telegramChatId?: string
	language?: string
	createdAt: Date
	updatedAt: Date
}

const UserSchema = new Schema<IUser>(
	{
		name:            { type: String, default: '', trim: true },
		surname:         { type: String, default: '', trim: true },
		email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
		password:        { type: String, default: '' },
		// No `default: null`: an explicit null is a *value*, and a unique index
		// treats every one of them as the same value — the second account
		// created without a Google id collided with the first.
		// No `sparse` here either; the indexes below declare it once.
		googleId:        { type: String, trim: true },
		telegramChatId:  { type: String, trim: true },
		language:        { type: String, default: 'uk', enum: ['uk', 'en'], trim: true },
	},
	{ timestamps: true }
)

// Google ids stay unique, but only among documents that actually have one:
// a partial filter ignores accounts registered by email entirely, where a
// plain sparse index would still collide on repeated nulls.
UserSchema.index(
	{ googleId: 1 },
	{ unique: true, partialFilterExpression: { googleId: { $type: 'string' } } },
)
UserSchema.index({ telegramChatId: 1 }, { sparse: true })

export const User = mongoose.model<IUser>('User', UserSchema)
