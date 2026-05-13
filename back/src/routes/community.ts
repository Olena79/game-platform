import { Router, Response } from 'express'
import { Server } from 'socket.io'
import { Types } from 'mongoose'
import { AuthRequest, authMiddleware, optionalAuth } from '../middleware/authMiddleware'
import { Post } from '../models/Post'
import { Comment } from '../models/Comment'
import { User } from '../models/User'

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
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Create post ───────────────────────────────────────────────────────────
	router.post('/posts', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const { topic, text } = req.body
			if (!text?.trim()) { res.status(400).json({ message: 'Text is required' }); return }

			const user = await User.findById(req.userId).lean()
			if (!user) { res.status(401).json({ message: 'User not found' }); return }

			const post = await Post.create({
				authorId:      req.userId,
				authorName:    user.name,
				authorSurname: user.surname || '',
				topic:         (topic || '').trim().slice(0, 100),
				text:          text.trim().slice(0, 1000),
			})

			const data = serializePost(post, req.userId)
			io.to(ROOM).emit('com:post-new', data)
			res.json(data)
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Update post ───────────────────────────────────────────────────────────
	router.put('/posts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }
			if (String(post.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			const { topic, text } = req.body
			if (text !== undefined) post.text = text.trim().slice(0, 1000)
			if (topic !== undefined) post.topic = topic.trim().slice(0, 100)
			post.editedAt = new Date()
			await post.save()

			const data = serializePost(post, req.userId)
			io.to(ROOM).emit('com:post-updated', data)
			res.json(data)
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Delete post ───────────────────────────────────────────────────────────
	router.delete('/posts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }
			if (String(post.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			await Promise.all([post.deleteOne(), Comment.deleteMany({ postId: post._id })])
			io.to(ROOM).emit('com:post-deleted', { postId: req.params.id })
			res.json({ ok: true })
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Like / unlike post ────────────────────────────────────────────────────
	router.post('/posts/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
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
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/posts/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Not found' }); return }

			post.likedBy = post.likedBy.filter(id => String(id) !== req.userId) as any
			post.likesCount = post.likedBy.length
			await post.save()
			const data = { postId: req.params.id, likesCount: post.likesCount }
			io.to(ROOM).emit('com:post-likes', data)
			res.json({ ...data, isLiked: false })
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Get comments ──────────────────────────────────────────────────────────
	router.get('/posts/:id/comments', optionalAuth, async (req: AuthRequest, res: Response) => {
		try {
			const comments = await Comment.find({ postId: req.params.id }).sort({ createdAt: 1 })
			res.json(comments.map(c => serializeComment(c, req.userId)))
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Create comment ────────────────────────────────────────────────────────
	router.post('/posts/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const { text, parentId } = req.body
			if (!text?.trim()) { res.status(400).json({ message: 'Text is required' }); return }

			const post = await Post.findById(req.params.id)
			if (!post) { res.status(404).json({ message: 'Post not found' }); return }

			if (parentId) {
				const parent = await Comment.findById(parentId)
				if (!parent || String(parent.postId) !== req.params.id) {
					res.status(400).json({ message: 'Invalid parent' }); return
				}
			}

			const user = await User.findById(req.userId).lean()
			if (!user) { res.status(401).json({ message: 'User not found' }); return }

			const comment = await Comment.create({
				postId:        req.params.id,
				parentId:      parentId || null,
				authorId:      req.userId,
				authorName:    user.name,
				authorSurname: user.surname || '',
				text:          text.trim().slice(0, 500),
			})

			post.commentsCount += 1
			await post.save()

			const data = serializeComment(comment, req.userId)
			io.to(ROOM).emit('com:comment-new', { comment: data, postId: req.params.id, commentsCount: post.commentsCount })
			res.json(data)
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Update comment ────────────────────────────────────────────────────────
	router.put('/comments/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }
			if (String(comment.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			comment.text = (req.body.text || '').trim().slice(0, 500)
			comment.editedAt = new Date()
			await comment.save()

			const data = serializeComment(comment, req.userId)
			io.to(ROOM).emit('com:comment-updated', { comment: data })
			res.json(data)
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Delete comment ────────────────────────────────────────────────────────
	router.delete('/comments/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }
			if (String(comment.authorId) !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return }

			const postId    = String(comment.postId)
			const commentId = String(comment._id)
			const replyCount = await Comment.countDocuments({ parentId: comment._id })

			await Comment.deleteOne({ _id: comment._id })
			if (replyCount > 0) await Comment.deleteMany({ parentId: comment._id })
			await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -(1 + replyCount) } })

			io.to(ROOM).emit('com:comment-deleted', { commentId, postId, replyCount })
			res.json({ ok: true })
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	// ── Like / unlike comment ─────────────────────────────────────────────────
	router.post('/comments/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
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
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	router.delete('/comments/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
		try {
			const comment = await Comment.findById(req.params.id)
			if (!comment) { res.status(404).json({ message: 'Not found' }); return }

			comment.likedBy = comment.likedBy.filter(id => String(id) !== req.userId) as any
			comment.likesCount = comment.likedBy.length
			await comment.save()
			const data = { commentId: req.params.id, likesCount: comment.likesCount }
			io.to(ROOM).emit('com:comment-likes', data)
			res.json({ ...data, isLiked: false })
		} catch {
			res.status(500).json({ message: 'Server error' })
		}
	})

	return router
}
