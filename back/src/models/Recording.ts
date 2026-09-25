import mongoose, { Document, Schema, Types } from 'mongoose'

/**
 * One recording of one game, made by LiveKit Egress into the R2 bucket.
 *
 * recording → stopping → completed | failed. A recording that is cut short
 * (egress limit, room closed) still completes if a file was written; it is
 * then marked `interrupted`.
 */
export type RecordingStatus = 'recording' | 'stopping' | 'completed' | 'failed'

export interface IRecording extends Document {
	gameId: string
	gameCode: string
	gameTitle: string
	/** The gamemaster who started it — they alone control it and get the link */
	gmId: Types.ObjectId
	egressId: string
	/** Object key in the bucket */
	fileKey: string
	shareLink: string
	status: RecordingStatus
	interrupted: boolean
	error: string
	/** File and link are gone after this */
	expiresAt: Date
	createdAt: Date
	updatedAt: Date
	// Rows written by the old Google Drive recorder — cleaned up, never created
	driveFileId?: string
}

const schema = new Schema<IRecording>({
	gameId:      { type: String, required: true, index: true },
	gameCode:    { type: String, required: true },
	gameTitle:   { type: String, default: '' },
	gmId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
	egressId:    { type: String, required: true, index: true },
	fileKey:     { type: String, required: true },
	shareLink:   { type: String, default: '' },
	status:      { type: String, enum: ['recording', 'stopping', 'completed', 'failed'], default: 'recording', index: true },
	interrupted: { type: Boolean, default: false },
	error:       { type: String, default: '' },
	expiresAt:   { type: Date, required: true },
	driveFileId: { type: String },
}, { timestamps: true })

export const Recording = mongoose.model<IRecording>('Recording', schema)
