import mongoose, { Document, Schema } from 'mongoose'

/**
 * What the administrator did, and every attempt to get in. Kept so that a
 * second administrator — or an entry that was not the owner's — shows up.
 */
export interface IAdminLog extends Document {
	action: string
	/** What it was done to: "user:<id>", "game:<id>", … */
	target: string
	detail: string
	ip: string
	createdAt: Date
}

const schema = new Schema<IAdminLog>(
	{
		action: { type: String, required: true },
		target: { type: String, default: '' },
		detail: { type: String, default: '', maxlength: 1000 },
		ip:     { type: String, default: '' },
	},
	{ timestamps: { createdAt: true, updatedAt: false }, collection: 'admin_log' },
)
schema.index({ createdAt: -1 })

export const AdminLog = mongoose.model<IAdminLog>('AdminLog', schema)
