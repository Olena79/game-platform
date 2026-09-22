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
		// `sparse` here would declare an index of its own, and the explicit
		// ones below then make it a duplicate — which Mongoose warns about.
		googleId:        { type: String, default: null, trim: true },
		telegramChatId:  { type: String, default: null, trim: true },
		language:        { type: String, default: 'uk', enum: ['uk', 'en'], trim: true },
	},
	{ timestamps: true }
)

// Index for Google OAuth lookups (sparse allows multiple null values)
UserSchema.index({ googleId: 1 }, { sparse: true })
UserSchema.index({ telegramChatId: 1 }, { sparse: true })

export const User = mongoose.model<IUser>('User', UserSchema)
