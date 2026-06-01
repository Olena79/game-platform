"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const authMiddleware_1 = require("../middleware/authMiddleware");
const Post_1 = require("../models/Post");
const Comment_1 = require("../models/Comment");
const User_1 = require("../models/User");
const ROOM = 'room:community';
function serializePost(post, userId) {
    const obj = post.toObject ? post.toObject() : Object.assign({}, post);
    const { likedBy } = obj, rest = __rest(obj, ["likedBy"]);
    return Object.assign(Object.assign({}, rest), { isLiked: userId ? likedBy.some((id) => String(id) === userId) : false });
}
function serializeComment(comment, userId) {
    const obj = comment.toObject ? comment.toObject() : Object.assign({}, comment);
    const { likedBy } = obj, rest = __rest(obj, ["likedBy"]);
    return Object.assign(Object.assign({}, rest), { isLiked: userId ? likedBy.some((id) => String(id) === userId) : false });
}
function makeCommunityRouter(io) {
    const router = (0, express_1.Router)();
    // ── List posts ────────────────────────────────────────────────────────────
    router.get('/posts', authMiddleware_1.optionalAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const isPopular = req.query.sort === 'popular';
            const sortOpt = isPopular ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 };
            const limit = Math.min(Number(req.query.limit) || 20, 50);
            const skip = Number(req.query.skip) || 0;
            const [posts, total] = yield Promise.all([
                Post_1.Post.find().sort(sortOpt).skip(skip).limit(limit),
                Post_1.Post.countDocuments(),
            ]);
            res.json({
                posts: posts.map(p => serializePost(p, req.userId)),
                total,
                hasMore: skip + limit < total,
            });
        }
        catch (_a) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Create post ───────────────────────────────────────────────────────────
    router.post('/posts', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { topic, text } = req.body;
            if (!(text === null || text === void 0 ? void 0 : text.trim())) {
                res.status(400).json({ message: 'Text is required' });
                return;
            }
            const user = yield User_1.User.findById(req.userId).lean();
            if (!user) {
                res.status(401).json({ message: 'User not found' });
                return;
            }
            const post = yield Post_1.Post.create({
                authorId: req.userId,
                authorName: user.name,
                authorSurname: user.surname || '',
                topic: (topic || '').trim().slice(0, 100),
                text: text.trim().slice(0, 1000),
            });
            const data = serializePost(post, req.userId);
            io.to(ROOM).emit('com:post-new', data);
            res.json(data);
        }
        catch (_b) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Update post ───────────────────────────────────────────────────────────
    router.put('/posts/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const post = yield Post_1.Post.findById(req.params.id);
            if (!post) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            if (String(post.authorId) !== req.userId) {
                res.status(403).json({ message: 'Forbidden' });
                return;
            }
            const { topic, text } = req.body;
            if (text !== undefined)
                post.text = text.trim().slice(0, 1000);
            if (topic !== undefined)
                post.topic = topic.trim().slice(0, 100);
            post.editedAt = new Date();
            yield post.save();
            const data = serializePost(post, req.userId);
            io.to(ROOM).emit('com:post-updated', data);
            res.json(data);
        }
        catch (_c) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Delete post ───────────────────────────────────────────────────────────
    router.delete('/posts/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const post = yield Post_1.Post.findById(req.params.id);
            if (!post) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            if (String(post.authorId) !== req.userId) {
                res.status(403).json({ message: 'Forbidden' });
                return;
            }
            yield Promise.all([post.deleteOne(), Comment_1.Comment.deleteMany({ postId: post._id })]);
            io.to(ROOM).emit('com:post-deleted', { postId: req.params.id });
            res.json({ ok: true });
        }
        catch (_d) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Like / unlike post ────────────────────────────────────────────────────
    router.post('/posts/:id/like', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const post = yield Post_1.Post.findById(req.params.id);
            if (!post) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            if (!post.likedBy.some(id => String(id) === req.userId)) {
                post.likedBy.push(new mongoose_1.Types.ObjectId(req.userId));
                post.likesCount = post.likedBy.length;
                yield post.save();
            }
            const data = { postId: req.params.id, likesCount: post.likesCount };
            io.to(ROOM).emit('com:post-likes', data);
            res.json(Object.assign(Object.assign({}, data), { isLiked: true }));
        }
        catch (_e) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    router.delete('/posts/:id/like', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const post = yield Post_1.Post.findById(req.params.id);
            if (!post) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            post.likedBy = post.likedBy.filter(id => String(id) !== req.userId);
            post.likesCount = post.likedBy.length;
            yield post.save();
            const data = { postId: req.params.id, likesCount: post.likesCount };
            io.to(ROOM).emit('com:post-likes', data);
            res.json(Object.assign(Object.assign({}, data), { isLiked: false }));
        }
        catch (_f) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Get comments ──────────────────────────────────────────────────────────
    router.get('/posts/:id/comments', authMiddleware_1.optionalAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const comments = yield Comment_1.Comment.find({ postId: req.params.id }).sort({ createdAt: 1 });
            res.json(comments.map(c => serializeComment(c, req.userId)));
        }
        catch (_g) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Create comment ────────────────────────────────────────────────────────
    router.post('/posts/:id/comments', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { text, parentId } = req.body;
            if (!(text === null || text === void 0 ? void 0 : text.trim())) {
                res.status(400).json({ message: 'Text is required' });
                return;
            }
            const post = yield Post_1.Post.findById(req.params.id);
            if (!post) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }
            if (parentId) {
                const parent = yield Comment_1.Comment.findById(parentId);
                if (!parent || String(parent.postId) !== req.params.id) {
                    res.status(400).json({ message: 'Invalid parent' });
                    return;
                }
            }
            const user = yield User_1.User.findById(req.userId).lean();
            if (!user) {
                res.status(401).json({ message: 'User not found' });
                return;
            }
            const comment = yield Comment_1.Comment.create({
                postId: req.params.id,
                parentId: parentId || null,
                authorId: req.userId,
                authorName: user.name,
                authorSurname: user.surname || '',
                text: text.trim().slice(0, 500),
            });
            post.commentsCount += 1;
            yield post.save();
            const data = serializeComment(comment, req.userId);
            io.to(ROOM).emit('com:comment-new', { comment: data, postId: req.params.id, commentsCount: post.commentsCount });
            res.json(data);
        }
        catch (_h) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Update comment ────────────────────────────────────────────────────────
    router.put('/comments/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const comment = yield Comment_1.Comment.findById(req.params.id);
            if (!comment) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            if (String(comment.authorId) !== req.userId) {
                res.status(403).json({ message: 'Forbidden' });
                return;
            }
            comment.text = (req.body.text || '').trim().slice(0, 500);
            comment.editedAt = new Date();
            yield comment.save();
            const data = serializeComment(comment, req.userId);
            io.to(ROOM).emit('com:comment-updated', { comment: data });
            res.json(data);
        }
        catch (_j) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Delete comment ────────────────────────────────────────────────────────
    router.delete('/comments/:id', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const comment = yield Comment_1.Comment.findById(req.params.id);
            if (!comment) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            if (String(comment.authorId) !== req.userId) {
                res.status(403).json({ message: 'Forbidden' });
                return;
            }
            const postId = String(comment.postId);
            const commentId = String(comment._id);
            const replyCount = yield Comment_1.Comment.countDocuments({ parentId: comment._id });
            yield Comment_1.Comment.deleteOne({ _id: comment._id });
            if (replyCount > 0)
                yield Comment_1.Comment.deleteMany({ parentId: comment._id });
            yield Post_1.Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -(1 + replyCount) } });
            io.to(ROOM).emit('com:comment-deleted', { commentId, postId, replyCount });
            res.json({ ok: true });
        }
        catch (_k) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ── Like / unlike comment ─────────────────────────────────────────────────
    router.post('/comments/:id/like', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const comment = yield Comment_1.Comment.findById(req.params.id);
            if (!comment) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            if (!comment.likedBy.some(id => String(id) === req.userId)) {
                comment.likedBy.push(new mongoose_1.Types.ObjectId(req.userId));
                comment.likesCount = comment.likedBy.length;
                yield comment.save();
            }
            const data = { commentId: req.params.id, likesCount: comment.likesCount };
            io.to(ROOM).emit('com:comment-likes', data);
            res.json(Object.assign(Object.assign({}, data), { isLiked: true }));
        }
        catch (_l) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    router.delete('/comments/:id/like', authMiddleware_1.authMiddleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const comment = yield Comment_1.Comment.findById(req.params.id);
            if (!comment) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            comment.likedBy = comment.likedBy.filter(id => String(id) !== req.userId);
            comment.likesCount = comment.likedBy.length;
            yield comment.save();
            const data = { commentId: req.params.id, likesCount: comment.likesCount };
            io.to(ROOM).emit('com:comment-likes', data);
            res.json(Object.assign(Object.assign({}, data), { isLiked: false }));
        }
        catch (_m) {
            res.status(500).json({ message: 'Server error' });
        }
    }));
    return router;
}
exports.default = makeCommunityRouter;
