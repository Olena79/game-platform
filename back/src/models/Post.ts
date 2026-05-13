import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IPost extends Document {
	authorId: Types.ObjectId
	authorName: string
	authorSurname: string
	topic: string
	text: string
	likesCount: number
	likedBy: Types.ObjectId[]
	commentsCount: number
	editedAt?: Date
	createdAt: Date
	updatedAt: Date
}

const PostSchema = new Schema<IPost>(
	{
		authorId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
		authorName:    { type: String, required: true },
		authorSurname: { type: String, default: '' },
		topic:         { type: String, default: '', maxlength: 100, trim: true },
		text:          { type: String, required: true, maxlength: 1000 },
		likesCount:    { type: Number, default: 0 },
		likedBy:       [{ type: Schema.Types.ObjectId, ref: 'User' }],
		commentsCount: { type: Number, default: 0 },
		editedAt:      { type: Date },
	},
	{ timestamps: true, collection: 'community_posts' }
)

export const Post = mongoose.model<IPost>('Post', PostSchema)
