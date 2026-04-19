import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
	name: string
	surname: string
	email: string
	phone: string
	password: string
	createdAt: Date
	updatedAt: Date
}

const UserSchema = new Schema<IUser>(
	{
		name:     { type: String, required: true, trim: true },
		surname:  { type: String, default: '', trim: true },
		email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
		phone:    { type: String, required: true, unique: true, trim: true },
		password: { type: String, required: true },
	},
	{ timestamps: true }
)

export const User = mongoose.model<IUser>('User', UserSchema)
