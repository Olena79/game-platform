import mongoose, { Document } from 'mongoose'

export interface IRecording extends Document {
	gameCode: string
	gameTitle: string
	gmEmail: string
	driveFileId: string
	shareLink: string
	status: 'pending' | 'completed'
	expiresAt: Date
}

const schema = new mongoose.Schema<IRecording>({
	gameCode:    { type: String, required: true },
	gameTitle:   { type: String, default: '' },
	gmEmail:     { type: String, required: true },
	driveFileId: { type: String, default: '' },
	shareLink:   { type: String, default: '' },
	status:      { type: String, enum: ['pending', 'completed'], default: 'pending' },
	expiresAt:   { type: Date, required: true },
}, { timestamps: true })

export const Recording = mongoose.model<IRecording>('Recording', schema)
