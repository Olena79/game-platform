import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IComment extends Document {
	postId: Types.ObjectId
	parentId: Types.ObjectId | null
	authorId: Types.ObjectId
	authorName: string
	authorSurname: string
	text: string
	likesCount: number
	likedBy: Types.ObjectId[]
	editedAt?: Date
	createdAt: Date
	updatedAt: Date
}

const CommentSchema = new Schema<IComment>(
	{
		postId:        { type: Schema.Types.ObjectId, ref: 'Post', required: true },
		parentId:      { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
		authorId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
		authorName:    { type: String, required: true },
		authorSurname: { type: String, default: '' },
		text:          { type: String, required: true, maxlength: 500 },
		likesCount:    { type: Number, default: 0 },
		likedBy:       [{ type: Schema.Types.ObjectId, ref: 'User' }],
		editedAt:      { type: Date },
	},
	{ timestamps: true, collection: 'community_comments' }
)

export const Comment = mongoose.model<IComment>('Comment', CommentSchema)
