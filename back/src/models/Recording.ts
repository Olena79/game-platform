import mongoose, { Document } from 'mongoose'

export interface IRecording extends Document {
	gameCode: string
	gameTitle: string
	gmEmail: string
	driveFileId: string
	shareLink: string
	status: 'pending' | 'uploading' | 'completed' | 'failed'
	/** Drive resumable session URI — chunks are PUT here as the game is recorded */
	uploadUri: string
	/** Bytes accepted from the client so far; the client resumes from this offset */
	uploadedBytes: number
	/** Set when the recording was closed by the server after the observer dropped */
	salvaged: boolean
	expiresAt: Date
}

const schema = new mongoose.Schema<IRecording>({
	gameCode:    { type: String, required: true },
	gameTitle:   { type: String, default: '' },
	gmEmail:     { type: String, required: true },
	driveFileId: { type: String, default: '' },
	shareLink:   { type: String, default: '' },
	status:      { type: String, enum: ['pending', 'uploading', 'completed', 'failed'], default: 'pending' },
	uploadUri:   { type: String, default: '' },
	uploadedBytes: { type: Number, default: 0 },
	salvaged:    { type: Boolean, default: false },
	expiresAt:   { type: Date, required: true },
}, { timestamps: true })

export const Recording = mongoose.model<IRecording>('Recording', schema)
