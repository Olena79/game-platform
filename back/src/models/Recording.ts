import mongoose, { Document, Schema, Types } from 'mongoose'

/**
 * One recording of one game, stored in the R2 bucket.
 *
 * Made one of two ways (see services/recording.ts):
 *  - 'browser': the gamemaster's browser composes the room and uploads it in
 *    parts (a multipart upload) while the game runs;
 *  - 'egress': LiveKit Egress records the room on LiveKit's servers.
 *
 * recording → stopping → completed | failed. A recording cut short (browser
 * gone, egress limit) still completes from whatever was written; it is then
 * marked `interrupted`.
 */
export type RecordingStatus = 'recording' | 'stopping' | 'completed' | 'failed'
export type RecordingMode = 'browser' | 'egress'

export interface IRecordingPart {
	partNumber: number
	etag: string
}

export interface IRecording extends Document {
	mode: RecordingMode
	gameId: string
	gameCode: string
	gameTitle: string
	/** The gamemaster who started it — they alone control it and get the link */
	gmId: Types.ObjectId
	/** Egress mode: LiveKit's id for the job */
	egressId: string
	/** Browser mode: the multipart upload, the parts in it, the bytes so far */
	uploadId: string
	parts: IRecordingPart[]
	uploadedBytes: number
	contentType: string
	/** Browser mode: when the last part arrived — silence means the browser is gone */
	lastPartAt: Date
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

const PartSchema = new Schema<IRecordingPart>({
	partNumber: { type: Number, required: true },
	etag:       { type: String, required: true },
}, { _id: false })

const schema = new Schema<IRecording>({
	mode:          { type: String, enum: ['browser', 'egress'], default: 'egress' },
	gameId:        { type: String, required: true, index: true },
	gameCode:      { type: String, required: true },
	gameTitle:     { type: String, default: '' },
	gmId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
	egressId:      { type: String, default: '', index: true },
	uploadId:      { type: String, default: '' },
	parts:         { type: [PartSchema], default: [] },
	uploadedBytes: { type: Number, default: 0 },
	contentType:   { type: String, default: 'video/mp4' },
	lastPartAt:    { type: Date, default: Date.now },
	fileKey:       { type: String, required: true },
	shareLink:     { type: String, default: '' },
	status:        { type: String, enum: ['recording', 'stopping', 'completed', 'failed'], default: 'recording', index: true },
	interrupted:   { type: Boolean, default: false },
	error:         { type: String, default: '' },
	expiresAt:     { type: Date, required: true },
	driveFileId:   { type: String },
}, { timestamps: true })

export const Recording = mongoose.model<IRecording>('Recording', schema)
