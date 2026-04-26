import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
	name: string
	surname: string
	email: string
	password: string
	googleId?: string
	createdAt: Date
	updatedAt: Date
}

const UserSchema = new Schema<IUser>(
	{
		name:     { type: String, required: true, trim: true },
		surname:  { type: String, default: '', trim: true },
		email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
		password: { type: String, default: '' },
		googleId: { type: String, default: undefined, trim: true },
	},
	{ timestamps: true }
)

UserSchema.index({ googleId: 1 }, { unique: true, sparse: true })

export const User = mongoose.model<IUser>('User', UserSchema)
