import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
	name: string
	email: string
	password: string
	role: 'player' | 'spectator' | 'gamemaster'
	createdAt: Date
	updatedAt: Date
}

const UserSchema = new Schema<IUser>(
	{
		name:     { type: String, required: true, trim: true },
		email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
		password: { type: String, required: true },
		role:     { type: String, enum: ['player', 'spectator', 'gamemaster'], default: 'player' },
	},
	{ timestamps: true }
)

export const User = mongoose.model<IUser>('User', UserSchema)
