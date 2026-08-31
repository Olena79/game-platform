import logger from '../config/logger'
import { Router, Response } from 'express'
import { Server } from 'socket.io'
import { Types } from 'mongoose'
import { AuthRequest, authMiddleware, optionalAuth } from '../middleware/authMiddleware'
import { Post } from '../models/Post'
import { Comment } from '../models/Comment'
import { User } from '../models/User'
import { validateBody, validateParams } from '../middleware/validationMiddleware'
import { createPostSchema, createCommentSchema, postIdSchema, commentIdSchema } from '../validation/schemas'
import { z } from 'zod'

const updatePostSchema = z.object({
	topic: z.string().max(100).optional(),
	text: z.string().min(1).max(1000).optional(),
})

const updateCommentSchema = z.object({
	text: z.string().min(1, 'Text is required').max(500),
})

const ROOM = 'room:community'

function serializePost(post: any, userId?: string) {
	const obj = post.toObject ? post.toObject() : { ...post }
	const { likedBy, ...rest } = obj
	return { ...rest, isLiked: userId ? (likedBy as any[]).some((id: any) => String(id) === userId) : false }
}

function serializeComment(comment: any, userId?: string) {
	const obj = comment.toObject ? comment.toObject() : { ...comment }
	const { likedBy, ...rest } = obj
	return { ...rest, isLiked: userId ? (likedBy as any[]).some((id: any) => String(id) === userId) : false }
}

export default function makeCommunityRouter(io: Server): Router {
	const router = Router()

	// ── List posts ────────────────────────────────────────────────────────────
	router.get('/posts', optionalAuth, async (req: AuthRequest, res: Response) => {
		try {
			const isPopular = (req.query.sort as string) === 'popular'
			const sortOpt   = isPopular ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 }
			const limit     = Math.min(Number(req.query.limit) || 20, 50)
			const skip      = Number(req.query.skip) || 0

			const [posts, total] = await Promise.all([
				Post.find().sort(sortOpt as any).skip(skip).limit(limit),
				Post.countDocuments(),
			])
			res.json({
				posts: posts.map(p => serializePost(p, req.userId)),
				total,
				hasMore: skip + limit < total,
			})
		} catch (err: any) {
			logger.error('[community/posts GET]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Create post ───────────────────────────────────────────────────────────
	router.post('/posts', authMiddleware, validateBody(createPostSchema), async (req: AuthRequest, res: Response) => {
		try {
			const { text, images } = req.body

			const user = await User.findById(req.userId).lean()
			if (!user) { res.status(401).json({ message: 'User not found' }); return }

			const post = await Post.create({
				authorId:      req.userId,
				text:          text.trim(),
				images:        images || [],
			})

			const data = serializePost(post, req.userId)
			io.to(ROOM).emit('com:post-new', data)
			res.json(data)
		} catch (err: any) {
			logger.error('[community/posts POST]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Update post ───────────────────────────────────────────────────────────
	router.put('/posts/:id', authMiddleware, validateParams(postIdSchema), validateBody(updatePostSchema), async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }
			if (String(post.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			const { text } = req.body
			if (text !== undefined) post.text = text.trim()
			post.editedAt = new Date()
			await post.save()

			const data = serializePost(post, req.userId)
			io.to(ROOM).emit('com:post-updated', data)
			res.json(data)
		} catch (err: any) {
			logger.error('[community/posts/:id PUT]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Delete post ───────────────────────────────────────────────────────────
	router.delete('/posts/:id', authMiddleware, validateParams(postIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }
			if (String(post.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			await Promise.all([post.deleteOne(), Comment.deleteMany({ postId: post._id })])
			io.to(ROOM).emit('com:post-deleted', { postId: req.params.id })
			res.json({ ok: true })
		} catch (err: any) {
			logger.error('[community/posts/:id DELETE]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Like / unlike post ────────────────────────────────────────────────────
	router.post('/posts/:id/like', authMiddleware, validateParams(postIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }

			if (!post.likedBy.some(id => String(id) === req.userId)) {
				post.likedBy.push(new Types.ObjectId(req.userId))
				post.likesCount = post.likedBy.length
				await post.save()
			}
			const data = { postId: req.params.id, likesCount: post.likesCount }
			io.to(ROOM).emit('com:post-likes', data)
			res.json({ ...data, isLiked: true })
		} catch (err: any) {
			logger.error('[community/posts/:id/like]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/posts/:id/like', authMiddleware, validateParams(postIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }

			post.likedBy = post.likedBy.filter(id => String(id) !== req.userId) as any
			post.likesCount = post.likedBy.length
			await post.save()
			const data = { postId: req.params.id, likesCount: post.likesCount }
			io.to(ROOM).emit('com:post-likes', data)
			res.json({ ...data, isLiked: false })
		} catch (err: any) {
			logger.error('[community/posts/:id/like DELETE]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Get comments ──────────────────────────────────────────────────────────
	router.get('/posts/:id/comments', optionalAuth, validateParams(postIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const comments = await Comment.find({ postId: req.params.id }).sort({ createdAt: 1 })
			res.json(comments.map(c => serializeComment(c, req.userId)))
		} catch (err: any) {
			logger.error('[community/posts/:id/comments GET]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Create comment ────────────────────────────────────────────────────────
	router.post('/posts/:id/comments', authMiddleware, validateParams(postIdSchema), validateBody(createCommentSchema), async (req: AuthRequest, res: Response) => {
		try {
			const { text } = req.body

			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Post not found' }); return }

			const user = await User.findById(req.userId).lean()
			if (!user) { res.status(401).json({ message: 'User not found' }); return }

			const comment = await Comment.create({
				postId:   req.params.id,
				authorId: req.userId,
				text:     text.trim(),
			})

			post.commentsCount += 1
			await post.save()

			const data = serializeComment(comment, req.userId)
			io.to(ROOM).emit('com:comment-new', { comment: data, postId: req.params.id, commentsCount: post.commentsCount })
			res.json(data)
		} catch (err: any) {
			logger.error('[community/posts/:id/comments POST]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Update comment ────────────────────────────────────────────────────────
	router.put('/comments/:id', authMiddleware, validateParams(commentIdSchema), validateBody(updateCommentSchema), async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }
			if (String(comment.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			const { text } = req.body
			comment.text = text.trim()
			comment.editedAt = new Date()
			await comment.save()

			const data = serializeComment(comment, req.userId)
			io.to(ROOM).emit('com:comment-updated', { comment: data })
			res.json(data)
		} catch (err: any) {
			logger.error('[community/comments/:id PUT]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Delete comment ────────────────────────────────────────────────────────
	router.delete('/comments/:id', authMiddleware, validateParams(commentIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }
			if (String(comment.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			const postId    = String(comment.postId)
			const commentId = String(comment._id)

			await Comment.deleteOne({ _id: comment._id })
			await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } })

			io.to(ROOM).emit('com:comment-deleted', { commentId, postId })
			res.json({ ok: true })
		} catch (err: any) {
			logger.error('[community/comments/:id DELETE]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Like / unlike comment ─────────────────────────────────────────────────
	router.post('/comments/:id/like', authMiddleware, validateParams(commentIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }

			if (!comment.likedBy.some(id => String(id) === req.userId)) {
				comment.likedBy.push(new Types.ObjectId(req.userId))
				comment.likesCount = comment.likedBy.length
				await comment.save()
			}
			const data = { commentId: req.params.id, likesCount: comment.likesCount }
			io.to(ROOM).emit('com:comment-likes', data)
			res.json({ ...data, isLiked: true })
		} catch (err: any) {
			logger.error('[community/comments/:id/like]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/comments/:id/like', authMiddleware, validateParams(commentIdSchema), async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }

			comment.likedBy = comment.likedBy.filter(id => String(id) !== req.userId) as any
			comment.likesCount = comment.likedBy.length
			await comment.save()
			const data = { commentId: req.params.id, likesCount: comment.likesCount }
			io.to(ROOM).emit('com:comment-likes', data)
			res.json({ ...data, isLiked: false })
		} catch (err: any) {
			logger.error('[community/comments/:id/like DELETE]', err)
			res.status(500).json({ message: 'Server error' })
		}
	})

	return router
}
