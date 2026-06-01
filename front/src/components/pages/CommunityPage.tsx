import React, { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Heart, MessageCircle, Pencil, Trash2, Send, X, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
	PostData, CommentData,
	getPosts, createPost, updatePost, deletePost, likePost, unlikePost,
	getComments, createComment, updateComment, deleteComment, likeComment, unlikeComment,
} from '../../actions/community'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function initials(name: string, surname: string): string {
	return ((name[0] || '') + (surname[0] || '')).toUpperCase()
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({ name, surname, size = 38 }: { name: string; surname: string; size?: number }) => {
	const { isDark } = useTheme()
	return (
		<div
			className='rounded-full flex items-center justify-center font-[700] flex-shrink-0 select-none'
			style={{
				width: size, height: size, fontSize: size * 0.38,
				background: isDark ? 'rgba(68,170,255,0.18)' : 'rgba(192,83,58,0.1)',
				border: isDark ? '1.5px solid rgba(68,170,255,0.38)' : '1.5px solid rgba(192,83,58,0.25)',
				color: isDark ? 'rgba(120,200,255,0.95)' : 'var(--accent)',
			}}
		>
			{initials(name, surname) || '?'}
		</div>
	)
}

// ─── CommentItem ──────────────────────────────────────────────────────────────

interface CommentItemProps {
	comment: CommentData
	replies: CommentData[]
	depth: number
	currentUserId: string | null
	isLoggedIn: boolean
	token: string | null
	editingId: string | null
	editingText: string
	replyingToId: string | null
	replyText: string
	onLike: (id: string, isLiked: boolean) => void
	onDelete: (id: string) => void
	onStartEdit: (id: string, text: string) => void
	onSaveEdit: (id: string) => void
	onCancelEdit: () => void
	onEditTextChange: (v: string) => void
	onStartReply: (id: string) => void
	onSaveReply: (parentId: string) => void
	onCancelReply: () => void
	onReplyTextChange: (v: string) => void
}

const CommentItem = ({
	comment, replies, depth, currentUserId, isLoggedIn, token,
	editingId, editingText, replyingToId, replyText,
	onLike, onDelete, onStartEdit, onSaveEdit, onCancelEdit, onEditTextChange,
	onStartReply, onSaveReply, onCancelReply, onReplyTextChange,
}: CommentItemProps) => {
	const { isDark } = useTheme()
	const { t } = useTranslation()
	const isOwn      = currentUserId === comment.authorId
	const isEditing  = editingId === comment._id
	const isReplying = replyingToId === comment._id
	const fullName   = [comment.authorName, comment.authorSurname].filter(Boolean).join(' ')

	return (
		<div className={depth > 0 ? `pl-[18px] border-l-2 ${isDark ? 'border-[rgba(68,170,255,0.18)]' : 'border-[rgba(192,83,58,0.18)]'}` : ''}>
			<div className='py-[11px]'>
				<div className='flex items-start gap-[9px]'>
					<Avatar name={comment.authorName} surname={comment.authorSurname} size={30} />
					<div className='flex-1 min-w-0'>
						<div className='flex items-center gap-[7px] flex-wrap'>
							<span className='text-[14px] font-[600]' style={{ color: isDark ? 'rgba(215,232,255,0.97)' : 'var(--text-primary)' }}>{fullName}</span>
							<span className='text-[12px]' style={{ color: isDark ? 'rgba(155,185,240,0.72)' : 'var(--text-muted)' }}>{fmtDate(comment.createdAt)}</span>
							{comment.editedAt && (
								<span className='text-[11px]' style={{ color: 'rgba(255,183,40,0.65)' }}>{t('community.edited')}</span>
							)}
						</div>

						{isEditing ? (
							<div className='mt-[7px] flex flex-col gap-[7px]'>
								<textarea
									value={editingText}
									onChange={e => onEditTextChange(e.target.value.slice(0, 500))}
									rows={2}
									autoFocus
									className='w-full rounded-[9px] px-[11px] py-[9px] text-[14px] focus:outline-none resize-none transition-all'
									style={{
										background: isDark ? '#060e24' : 'var(--bg-input)',
										border: isDark ? '1px solid rgba(68,170,255,0.38)' : '1px solid var(--border-subtle)',
										color: isDark ? 'rgba(215,232,255,0.95)' : 'var(--text-primary)',
									}}
								/>
								<div className='flex gap-[7px]'>
									<button
										onClick={() => onSaveEdit(comment._id)}
										className='px-[12px] py-[5px] rounded-[8px] text-[13px] font-[600] cursor-pointer transition-all'
										style={isDark
											? { background: 'rgba(68,170,255,0.18)', border: '1px solid rgba(68,170,255,0.48)', color: 'rgba(120,200,255,0.95)' }
											: { background: 'rgba(192,83,58,0.08)', border: '1px solid rgba(192,83,58,0.3)', color: 'var(--accent)' }
										}
									>{t('community.save')}</button>
									<button onClick={onCancelEdit} className='px-[10px] py-[5px] rounded-[8px] text-[13px] cursor-pointer' style={{ color: isDark ? 'rgba(170,190,240,0.75)' : 'var(--text-secondary)' }}>{t('community.cancel')}</button>
								</div>
							</div>
						) : (
							<p className='mt-[5px] text-[14px] leading-[1.65] whitespace-pre-wrap break-words' style={{ color: isDark ? 'rgba(215,230,255,0.92)' : 'var(--text-primary)' }}>
								{comment.text}
							</p>
						)}

						{!isEditing && (
							<div className='flex items-center gap-[14px] mt-[7px] flex-wrap'>
								<button
									onClick={() => isLoggedIn && onLike(comment._id, comment.isLiked)}
									className={`flex items-center gap-[5px] text-[13px] transition-all ${isLoggedIn ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
									style={{ color: comment.isLiked ? (isDark ? 'rgba(255,80,150,0.98)' : 'rgba(192,83,58,0.98)') : (isDark ? 'rgba(190,210,255,0.68)' : 'var(--text-muted)') }}
								>
									<Heart size={14} strokeWidth={2} fill={comment.isLiked ? 'currentColor' : 'none'} />
									{comment.likesCount > 0 && <span className='font-[600]'>{comment.likesCount}</span>}
								</button>

								{isLoggedIn && depth === 0 && (
									<button
										onClick={() => onStartReply(comment._id)}
										className='flex items-center gap-[5px] text-[13px] cursor-pointer transition-all hover:opacity-90'
										style={{ color: isDark ? 'rgba(192,130,255,0.82)' : 'var(--text-secondary)' }}
									>
										<CornerDownRight size={13} strokeWidth={2} />
										{t('community.reply')}
									</button>
								)}

								{isOwn && (
									<>
										<button onClick={() => onStartEdit(comment._id, comment.text)} className='flex items-center gap-[4px] text-[13px] cursor-pointer transition-all hover:opacity-90' style={{ color: isDark ? 'rgba(68,170,255,0.88)' : 'var(--accent)' }}>
											<Pencil size={12} strokeWidth={2} />{t('community.edit_short')}
										</button>
										<button onClick={() => onDelete(comment._id)} className='flex items-center gap-[4px] text-[13px] cursor-pointer transition-all hover:opacity-90' style={{ color: isDark ? 'rgba(255,95,160,0.88)' : 'rgba(180,50,50,0.9)' }}>
											<Trash2 size={12} strokeWidth={2} />{t('community.delete_short')}
										</button>
									</>
								)}
							</div>
						)}
					</div>
				</div>

				{isReplying && (
					<div className='mt-[9px] pl-[39px] flex flex-col gap-[7px]'>
						<textarea
							value={replyText}
							onChange={e => onReplyTextChange(e.target.value.slice(0, 500))}
							rows={2} autoFocus
							placeholder={t('community.reply_placeholder')}
							className='w-full rounded-[9px] px-[11px] py-[9px] text-[14px] focus:outline-none resize-none transition-all'
							style={{
								background: isDark ? '#060e24' : 'var(--bg-input)',
								border: isDark ? '1px solid rgba(68,170,255,0.28)' : '1px solid var(--border-subtle)',
								color: isDark ? 'rgba(215,232,255,0.95)' : 'var(--text-primary)',
							}}
						/>
						<div className='flex gap-[7px]'>
							<button onClick={() => onSaveReply(comment._id)} className='px-[12px] py-[5px] rounded-[8px] text-[13px] font-[600] cursor-pointer transition-all' style={isDark
								? { background: 'rgba(68,170,255,0.18)', border: '1px solid rgba(68,170,255,0.45)', color: 'rgba(120,200,255,0.95)' }
								: { background: 'rgba(192,83,58,0.1)', border: '1px solid rgba(192,83,58,0.35)', color: 'var(--accent)' }
							}>{t('community.reply')}</button>
							<button onClick={onCancelReply} className='px-[10px] py-[5px] rounded-[8px] text-[13px] cursor-pointer' style={{ color: isDark ? 'rgba(170,190,240,0.75)' : 'var(--text-secondary)' }}>{t('community.cancel')}</button>
						</div>
					</div>
				)}
			</div>

			{replies.map(reply => (
				<CommentItem
					key={reply._id}
					comment={reply} replies={[]} depth={depth + 1}
					currentUserId={currentUserId} isLoggedIn={isLoggedIn} token={token}
					editingId={editingId} editingText={editingText}
					replyingToId={replyingToId} replyText={replyText}
					onLike={onLike} onDelete={onDelete}
					onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} onEditTextChange={onEditTextChange}
					onStartReply={onStartReply} onSaveReply={onSaveReply} onCancelReply={onCancelReply} onReplyTextChange={onReplyTextChange}
				/>
			))}
		</div>
	)
}

// ─── CommentSection ───────────────────────────────────────────────────────────

interface CommentSectionProps {
	postId: string
	comments: CommentData[]
	loading: boolean
	isLoggedIn: boolean
	token: string | null
	currentUserId: string | null
	onCommentCreate: (text: string, parentId?: string) => Promise<void>
	onCommentUpdate: (id: string, text: string) => Promise<void>
	onCommentDelete: (id: string) => Promise<void>
	onCommentLike: (id: string, isLiked: boolean) => Promise<void>
}

const CommentSection = ({
	postId, comments, loading, isLoggedIn, token, currentUserId,
	onCommentCreate, onCommentUpdate, onCommentDelete, onCommentLike,
}: CommentSectionProps) => {
	const { isDark } = useTheme()
	const { t } = useTranslation()
	const [newText, setNewText]               = useState('')
	const [submitting, setSubmitting]         = useState(false)
	const [editingId, setEditingId]           = useState<string | null>(null)
	const [editingText, setEditingText]       = useState('')
	const [replyingToId, setReplyingToId]     = useState<string | null>(null)
	const [replyText, setReplyText]           = useState('')

	const rootComments = comments.filter(c => !c.parentId)
	const repliesFor   = (id: string) => comments.filter(c => c.parentId === id)

	const handleSubmit = async () => {
		if (!newText.trim() || submitting) return
		setSubmitting(true)
		try { await onCommentCreate(newText.trim()); setNewText('') } finally { setSubmitting(false) }
	}

	return (
		<div className='mt-[2px] pt-[14px]' style={{ borderTop: `1px solid ${isDark ? 'rgba(68,170,255,0.1)' : 'var(--border-subtle)'}` }}>
			{isLoggedIn && (
				<div className='flex flex-col gap-[7px] mb-[16px]'>
					<textarea
						value={newText}
						onChange={e => setNewText(e.target.value.slice(0, 500))}
						rows={2}
						placeholder={t('community.comment_placeholder')}
						className='w-full rounded-[10px] px-[13px] py-[10px] text-[14px] focus:outline-none resize-none transition-all'
						style={{
							background: isDark ? '#060e24' : 'var(--bg-input)',
							border: isDark ? '1px solid rgba(68,170,255,0.22)' : '1px solid var(--border-subtle)',
							color: isDark ? 'rgba(215,232,255,0.95)' : 'var(--text-primary)',
						}}
					/>
					<div className='flex items-center justify-between'>
						<span className='text-[12px]' style={{ color: isDark ? 'rgba(130,160,220,0.58)' : 'var(--text-muted)' }}>{newText.length} / 500</span>
						<button
							onClick={handleSubmit}
							disabled={!newText.trim() || submitting}
							className='flex items-center gap-[6px] px-[14px] py-[7px] rounded-[9px] text-[13px] font-[600] cursor-pointer transition-all disabled:opacity-40'
							style={isDark
								? { background: 'rgba(68,170,255,0.16)', border: '1px solid rgba(68,170,255,0.45)', color: 'rgba(120,200,255,0.95)' }
								: { background: 'rgba(192,83,58,0.1)', border: '1px solid rgba(192,83,58,0.35)', color: 'var(--accent)' }
							}
						>
							<Send size={13} strokeWidth={2} />
							{submitting ? '...' : t('community.send')}
						</button>
					</div>
				</div>
			)}

			{loading ? (
				<div className='flex justify-center py-[18px]'>
					<div className='w-[5px] h-[5px] rounded-full bg-[#44aaff] pulse-dot-anim' />
				</div>
			) : (
				<div className='flex flex-col' style={{ gap: 0 }}>
					{rootComments.length === 0 && !isLoggedIn && (
						<p className='text-[14px] py-[10px]' style={{ color: isDark ? 'rgba(155,185,240,0.58)' : 'var(--text-muted)' }}>{t('community.no_comments')}</p>
					)}
					{rootComments.map((c, i) => (
						<div key={c._id} style={i > 0 ? { borderTop: `1px solid ${isDark ? 'rgba(68,170,255,0.07)' : 'var(--border-subtle)'}` } : {}}>
							<CommentItem
								comment={c} replies={repliesFor(c._id)} depth={0}
								currentUserId={currentUserId} isLoggedIn={isLoggedIn} token={token}
								editingId={editingId} editingText={editingText}
								replyingToId={replyingToId} replyText={replyText}
								onLike={onCommentLike} onDelete={onCommentDelete}
								onStartEdit={(id, text) => { setEditingId(id); setEditingText(text) }}
								onSaveEdit={async (id) => { await onCommentUpdate(id, editingText.trim()); setEditingId(null); setEditingText('') }}
								onCancelEdit={() => { setEditingId(null); setEditingText('') }}
								onEditTextChange={setEditingText}
								onStartReply={(id) => { setReplyingToId(id); setReplyText('') }}
								onSaveReply={async (parentId) => { if (replyText.trim()) { await onCommentCreate(replyText.trim(), parentId); setReplyingToId(null); setReplyText('') } }}
								onCancelReply={() => { setReplyingToId(null); setReplyText('') }}
								onReplyTextChange={setReplyText}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
	post: PostData
	comments: CommentData[] | undefined
	commentsLoading: boolean
	expanded: boolean
	isLoggedIn: boolean
	token: string | null
	currentUserId: string | null
	onToggleExpand: () => void
	onLike: () => void
	onEdit: () => void
	onDelete: () => void
	onCommentCreate: (postId: string, text: string, parentId?: string) => Promise<void>
	onCommentUpdate: (id: string, text: string) => Promise<void>
	onCommentDelete: (id: string) => Promise<void>
	onCommentLike: (id: string, isLiked: boolean) => Promise<void>
}

const PostCard = ({
	post, comments, commentsLoading, expanded, isLoggedIn, token, currentUserId,
	onToggleExpand, onLike, onEdit, onDelete,
	onCommentCreate, onCommentUpdate, onCommentDelete, onCommentLike,
}: PostCardProps) => {
	const { isDark } = useTheme()
	const { t } = useTranslation()
	const isOwn    = currentUserId === post.authorId
	const fullName = [post.authorName, post.authorSurname].filter(Boolean).join(' ')

	return (
		<div
			className='rounded-[20px] px-[22px] py-[20px] flex flex-col gap-[14px] transition-all'
			style={isDark
				? { background: 'rgba(8,12,38,0.78)', border: '1px solid rgba(68,170,255,0.17)', backdropFilter: 'blur(10px)' }
				: { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }
			}
		>
			{/* Header */}
			<div className='flex items-start justify-between gap-[10px]'>
				<div className='flex items-start gap-[11px] min-w-0'>
					<Avatar name={post.authorName} surname={post.authorSurname} />
					<div className='min-w-0'>
						<div className='flex items-center gap-[8px] flex-wrap'>
							<span className='text-[15px] font-[600]' style={{ color: isDark ? 'rgba(225,238,255,0.98)' : 'var(--text-primary)' }}>{fullName}</span>
							<span className='text-[12px]' style={{ color: isDark ? 'rgba(155,185,240,0.75)' : 'var(--text-muted)' }}>{fmtDate(post.createdAt)}</span>
							{post.editedAt && (
								<span className='text-[11px]' style={{ color: 'rgba(255,183,40,0.72)' }}>{t('community.edited')}</span>
							)}
						</div>
						{post.topic && (
							<span
								className='inline-block mt-[5px] px-[9px] py-[3px] rounded-[7px] text-[12px] font-[500]'
								style={isDark
									? { background: 'rgba(68,170,255,0.12)', border: '1px solid rgba(68,170,255,0.32)', color: 'rgba(130,210,255,0.97)' }
									: { background: 'rgba(192,83,58,0.08)', border: '1px solid rgba(192,83,58,0.2)', color: 'var(--accent)' }
								}
							>
								{post.topic}
							</span>
						)}
					</div>
				</div>

				{isOwn && (
					<div className='flex gap-[6px] flex-shrink-0'>
						<button
							onClick={onEdit}
							className='flex items-center gap-[5px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-125'
							style={isDark
								? { background: 'rgba(68,170,255,0.1)', border: '1px solid rgba(68,170,255,0.32)', color: 'rgba(100,190,255,0.92)' }
								: { background: 'rgba(192,83,58,0.08)', border: '1px solid rgba(192,83,58,0.3)', color: 'var(--accent)' }
							}
						>
							<Pencil size={12} strokeWidth={2} />
							<span className='hidden sm:inline'>{t('community.edit_short')}</span>
						</button>
						<button
							onClick={onDelete}
							className='flex items-center gap-[5px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-125'
							style={isDark
								? { background: 'rgba(255,95,160,0.08)', border: '1px solid rgba(255,95,160,0.28)', color: 'rgba(255,120,170,0.92)' }
								: { background: 'rgba(200,60,60,0.06)', border: '1px solid rgba(200,60,60,0.25)', color: 'rgba(180,50,50,0.9)' }
							}
						>
							<Trash2 size={12} strokeWidth={2} />
							<span className='hidden sm:inline'>{t('community.delete_short')}</span>
						</button>
					</div>
				)}
			</div>

			{/* Text */}
			<p className='text-[15px] leading-[1.72] whitespace-pre-wrap break-words' style={{ color: isDark ? 'rgba(218,232,255,0.95)' : 'var(--text-primary)' }}>
				{post.text}
			</p>

			{/* Footer */}
			<div className='flex items-center gap-[18px] pt-[2px]'>
				<button
					onClick={() => isLoggedIn && onLike()}
					className={`flex items-center gap-[6px] text-[14px] font-[500] transition-all ${isLoggedIn ? 'cursor-pointer hover:opacity-90' : 'cursor-default opacity-60'}`}
					style={{ color: post.isLiked ? (isDark ? 'rgba(255,75,145,0.98)' : 'rgba(192,83,58,0.98)') : (isDark ? 'rgba(190,210,255,0.7)' : 'var(--text-muted)') }}
					title={!isLoggedIn ? t('community.like_login') : undefined}
				>
					<Heart size={16} strokeWidth={2} fill={post.isLiked ? 'currentColor' : 'none'} />
					{post.likesCount > 0 && <span>{post.likesCount}</span>}
				</button>

				<button
					onClick={onToggleExpand}
					className='flex items-center gap-[6px] text-[14px] font-[500] cursor-pointer transition-all hover:opacity-90'
					style={{ color: expanded ? (isDark ? 'rgba(0,240,200,0.95)' : 'var(--accent)') : (isDark ? 'rgba(0,210,180,0.68)' : 'var(--text-muted)') }}
				>
					<MessageCircle size={16} strokeWidth={2} />
					{post.commentsCount > 0 && <span>{post.commentsCount}</span>}
					{expanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
				</button>
			</div>

			{expanded && (
				<CommentSection
					postId={post._id}
					comments={comments || []}
					loading={commentsLoading}
					isLoggedIn={isLoggedIn}
					token={token}
					currentUserId={currentUserId}
					onCommentCreate={(text, parentId) => onCommentCreate(post._id, text, parentId)}
					onCommentUpdate={onCommentUpdate}
					onCommentDelete={onCommentDelete}
					onCommentLike={onCommentLike}
				/>
			)}
		</div>
	)
}

// ─── Modals ───────────────────────────────────────────────────────────────────

const PostModal = ({
	title, token, initialTopic = '', initialText = '',
	onClose, onSubmit,
}: {
	title: string; token: string; initialTopic?: string; initialText?: string
	onClose: () => void; onSubmit: (topic: string, text: string) => Promise<void>
	authorName?: string; authorSurname?: string
}) => {
	const { isDark } = useTheme()
	const { t } = useTranslation()
	const [topic, setTopic]     = useState(initialTopic)
	const [text, setText]       = useState(initialText)
	const [loading, setLoading] = useState(false)
	const [error, setError]     = useState('')

	const inputStyle: React.CSSProperties = isDark
		? { background: '#060e24', border: '1px solid rgba(68,170,255,0.22)', color: 'rgba(218,232,255,0.95)' }
		: { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }

	const handle = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!text.trim()) { setError(t('community.text_required')); return }
		setLoading(true); setError('')
		try { await onSubmit(topic.trim(), text.trim()); onClose() }
		catch (err) { setError(err instanceof Error ? err.message : t('community.error')) }
		finally { setLoading(false) }
	}

	return (
		<div
			className='fixed inset-0 z-[200] flex items-center justify-center p-[16px]'
			style={{ background: 'rgba(2,4,20,0.8)', backdropFilter: 'blur(7px)' }}
			onClick={e => { if (e.target === e.currentTarget) onClose() }}
		>
			<div
				className='w-full max-w-[540px] rounded-[22px] px-[26px] py-[30px] flex flex-col gap-[18px]'
				style={isDark
					? { background: 'rgba(4,8,28,0.99)', border: '1px solid rgba(68,170,255,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.65)' }
					: { background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }
				}
			>
				<div className='flex items-center justify-between'>
					<h2 className='text-[20px] font-[700]' style={{ color: isDark ? 'white' : 'var(--text-primary)' }}>{title}</h2>
					<button onClick={onClose} className='transition-colors cursor-pointer' style={{ color: isDark ? 'rgba(180,200,255,0.45)' : 'var(--text-muted)' }}><X size={20} strokeWidth={2} /></button>
				</div>

				<form onSubmit={handle} className='flex flex-col gap-[13px]'>
					<input
						type='text'
						placeholder={t('community.topic_placeholder')}
						value={topic}
						onChange={e => setTopic(e.target.value.slice(0, 100))}
						className='w-full rounded-[11px] px-[15px] py-[11px] text-[15px] focus:outline-none transition-all'
						style={inputStyle}
					/>
					<div className='flex flex-col gap-[5px]'>
						<textarea
							placeholder={t('community.content_placeholder')}
							value={text}
							onChange={e => setText(e.target.value.slice(0, 1000))}
							rows={5} autoFocus
							className='w-full rounded-[11px] px-[15px] py-[11px] text-[15px] focus:outline-none resize-none leading-[1.65] transition-all'
							style={inputStyle}
						/>
						<span className={`text-[12px] text-right pr-[2px] ${text.length >= 900 ? 'text-[rgba(255,183,40,0.75)]' : ''}`} style={text.length < 900 ? { color: isDark ? 'rgba(130,160,220,0.55)' : 'var(--text-muted)' } : {}}>
							{text.length} / 1000
						</span>
					</div>
					{error && <p className='text-[14px] text-[rgba(255,90,160,0.92)]'>{error}</p>}
					<div className='flex gap-[10px] pt-[4px]'>
						<button type='button' onClick={onClose} className='flex-1 py-[11px] rounded-[11px] text-[15px] font-[500] cursor-pointer transition-all' style={isDark
							? { border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.7)' }
							: { border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
						}>{t('community.cancel')}</button>
						<button type='submit' disabled={loading || !text.trim()} className='flex-1 py-[11px] rounded-[11px] text-[15px] font-[600] cursor-pointer transition-all disabled:opacity-40' style={isDark
							? { background: 'rgba(68,170,255,0.2)', border: '1px solid rgba(68,170,255,0.55)', color: 'rgba(130,210,255,0.98)' }
							: { background: 'rgba(192,83,58,0.15)', border: '1px solid rgba(192,83,58,0.45)', color: 'var(--accent)' }
						}>
							{loading ? '...' : t('community.publish')}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

// ─── OrbButton ────────────────────────────────────────────────────────────────

const OrbButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => {
	const { isDark } = useTheme()
	const { t } = useTranslation()
	return (
		<div className={`flex flex-col items-center gap-[18px] ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
			<div className='relative flex items-center justify-center' style={{ width: 188, height: 188 }}>
				{/* Sparkles */}
				<span className='absolute top-[14px] left-[12px] text-[12px] orb-sp-1 pointer-events-none select-none' style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }}>✦</span>
				<span className='absolute top-[22px] right-[10px] text-[9px] orb-sp-2 pointer-events-none select-none' style={{ color: isDark ? '#c07fff' : 'rgba(140,60,30,0.7)' }}>✦</span>
				<span className='absolute bottom-[16px] left-[8px] text-[10px] orb-sp-3 pointer-events-none select-none' style={{ color: isDark ? '#44aaff' : 'var(--accent)' }}>✦</span>
				<span className='absolute bottom-[10px] right-[16px] text-[11px] orb-sp-1 pointer-events-none select-none' style={{ color: isDark ? '#ff5fa0' : 'rgba(140,60,30,0.7)' }}>✦</span>
				<span className='absolute' style={{ top: '48%', left: 2, color: isDark ? '#c07fff' : 'var(--accent)', fontSize: 8 }} >✦</span>
				<span className='absolute' style={{ top: '52%', right: 2, color: isDark ? '#0fffc8' : 'rgba(140,60,30,0.7)', fontSize: 8 }}>✦</span>

				{/* Outer orbit ring */}
				<div className='absolute inset-0 rounded-full orb-orbit pointer-events-none'
					style={isDark
						? { border: '1.5px solid rgba(0,255,200,0.38)', boxShadow: '0 0 14px rgba(0,255,200,0.18)' }
						: { border: '1.5px solid rgba(192,83,58,0.3)' }
					} />

				{/* Tilted ellipse orbit */}
				<div className='absolute orb-orbit-slow pointer-events-none'
					style={{
						width: 200, height: 60,
						top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
						borderRadius: '50%',
						...(isDark
							? { border: '1.5px solid rgba(68,170,255,0.32)', boxShadow: '0 0 12px rgba(68,170,255,0.16)' }
							: { border: '1.5px solid rgba(192,83,58,0.2)' }
						),
					}} />

				{/* Ambient glow behind button */}
				<div className='absolute rounded-full pointer-events-none'
					style={{
						width: 148, height: 148, top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
						background: isDark
							? 'radial-gradient(circle, rgba(60,30,200,0.22) 0%, transparent 70%)'
							: 'radial-gradient(circle, rgba(192,83,58,0.08) 0%, transparent 70%)',
					}} />

				{/* Main button */}
				<button
					onClick={onClick}
					className={`relative z-10 w-[120px] h-[120px] rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.07] ${isDark ? 'orb-glow-anim' : ''}`}
					style={isDark
						? {
							background: 'radial-gradient(circle at 36% 36%, rgba(60,120,255,0.26), rgba(110,0,230,0.22) 55%, rgba(4,8,32,0.88))',
							border: '2px solid rgba(80,160,255,0.48)',
						}
						: {
							background: 'radial-gradient(circle at 36% 36%, rgba(192,83,58,0.18), rgba(140,60,30,0.14) 55%, rgba(242,235,227,0.4))',
							border: '2px solid rgba(192,83,58,0.35)',
						}
					}
				>
					<div className='relative'>
						<MessageCircle size={46} strokeWidth={1.5} style={{ color: isDark ? 'rgba(0,245,205,0.9)' : 'var(--accent)' }} />
						<Pencil size={20} strokeWidth={2.2}
							className='absolute -bottom-[2px] -right-[2px]'
							style={{ color: isDark ? 'rgba(200,120,255,0.98)' : 'rgba(140,60,30,0.85)' }}
						/>
					</div>
				</button>
			</div>
			<span className='text-[17px] font-[600]' style={{ color: isDark ? 'rgba(225,240,255,0.97)' : 'var(--text-primary)' }}>{t('community.create_post')}</span>
		</div>
	)
}

// ─── CommunityPage ────────────────────────────────────────────────────────────

export const CommunityPage = () => {
	const { user, token, isLoggedIn } = useAuth()
	const { isDark } = useTheme()
	const { t } = useTranslation()

	const [posts, setPosts]               = useState<PostData[]>([])
	const [total, setTotal]               = useState(0)
	const [hasMore, setHasMore]           = useState(false)
	const [loading, setLoading]           = useState(true)
	const [loadingMore, setLoadingMore]   = useState(false)
	const [sort, setSort]                 = useState<'new' | 'popular'>('new')
	const [createOpen, setCreateOpen]     = useState(false)
	const [editPost, setEditPost]         = useState<PostData | null>(null)
	const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
	const [commentsMap, setCommentsMap]   = useState<Record<string, CommentData[]>>({})
	const [commentsLoading, setCommentsLoading] = useState<Set<string>>(new Set())
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

	const sortRef   = useRef(sort)
	const socketRef = useRef<Socket | null>(null)

	useEffect(() => { sortRef.current = sort }, [sort])

	// ── Socket ────────────────────────────────────────────────────────────────
	useEffect(() => {
		const socket = io(API, {
			transports: ['websocket', 'polling'],
			// Send JWT if the user is logged in; community feed is readable without auth,
			// but an invalid token is rejected at handshake — don't send one if absent.
			...(token ? { auth: { token } } : {}),
		})
		socketRef.current = socket
		socket.emit('com:join')

		socket.on('com:post-new', (post: PostData) => {
			if (sortRef.current === 'new')
				setPosts(prev => prev.some(p => p._id === post._id) ? prev : [post, ...prev])
			setTotal(t => t + 1)
		})
		socket.on('com:post-updated', (post: PostData) => {
			setPosts(prev => prev.map(p => p._id === post._id ? { ...p, topic: post.topic, text: post.text, editedAt: post.editedAt } : p))
		})
		socket.on('com:post-deleted', ({ postId }: { postId: string }) => {
			setPosts(prev => prev.filter(p => p._id !== postId))
			setTotal(t => Math.max(0, t - 1))
		})
		socket.on('com:post-likes', ({ postId, likesCount }: { postId: string; likesCount: number }) => {
			setPosts(prev => prev.map(p => p._id === postId ? { ...p, likesCount } : p))
		})
		socket.on('com:comment-new', ({ comment, postId, commentsCount }: { comment: CommentData; postId: string; commentsCount: number }) => {
			setPosts(prev => prev.map(p => p._id === postId ? { ...p, commentsCount } : p))
			setCommentsMap(prev => {
				if (!prev[postId] || prev[postId].some(c => c._id === comment._id)) return prev
				return { ...prev, [postId]: [...prev[postId], comment] }
			})
		})
		socket.on('com:comment-updated', ({ comment }: { comment: CommentData }) => {
			setCommentsMap(prev => {
				const pid = comment.postId
				if (!prev[pid]) return prev
				return { ...prev, [pid]: prev[pid].map(c => c._id === comment._id ? { ...c, text: comment.text, editedAt: comment.editedAt } : c) }
			})
		})
		socket.on('com:comment-deleted', ({ commentId, postId, replyCount }: { commentId: string; postId: string; replyCount: number }) => {
			setPosts(prev => prev.map(p => p._id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1 - replyCount) } : p))
			setCommentsMap(prev => {
				if (!prev[postId]) return prev
				return { ...prev, [postId]: prev[postId].filter(c => c._id !== commentId && c.parentId !== commentId) }
			})
		})
		socket.on('com:comment-likes', ({ commentId, likesCount }: { commentId: string; likesCount: number }) => {
			setCommentsMap(prev => {
				const updated: Record<string, CommentData[]> = {}
				for (const pid of Object.keys(prev))
					updated[pid] = prev[pid].map(c => c._id === commentId ? { ...c, likesCount } : c)
				return updated
			})
		})

		return () => { socket.emit('com:leave'); socket.disconnect() }
	}, [])

	// ── Load posts ────────────────────────────────────────────────────────────
	useEffect(() => {
		let cancelled = false
		setLoading(true); setPosts([]); setExpandedPosts(new Set()); setCommentsMap({})
		getPosts(sort, 0, 20, token || undefined)
			.then(res => {
				if (cancelled) return
				setPosts(res.posts); setTotal(res.total); setHasMore(res.hasMore)
			})
			.finally(() => { if (!cancelled) setLoading(false) })
		return () => { cancelled = true }
	}, [sort])

	const loadMore = async () => {
		if (loadingMore || !hasMore) return
		setLoadingMore(true)
		try {
			const res = await getPosts(sort, posts.length, 20, token || undefined)
			setPosts(prev => [...prev, ...res.posts.filter(p => !prev.some(x => x._id === p._id))])
			setHasMore(res.hasMore)
		} finally { setLoadingMore(false) }
	}

	const toggleExpand = useCallback(async (postId: string) => {
		setExpandedPosts(prev => { const s = new Set(prev); s.has(postId) ? s.delete(postId) : s.add(postId); return s })
		if (!commentsMap[postId]) {
			setCommentsLoading(prev => new Set(prev).add(postId))
			try {
				const list = await getComments(postId, token || undefined)
				setCommentsMap(prev => ({ ...prev, [postId]: list }))
			} finally {
				setCommentsLoading(prev => { const s = new Set(prev); s.delete(postId); return s })
			}
		}
	}, [commentsMap, token])

	const handleLikePost = useCallback(async (post: PostData) => {
		if (!token) return
		const was = post.isLiked
		setPosts(prev => prev.map(p => p._id === post._id ? { ...p, isLiked: !was, likesCount: p.likesCount + (was ? -1 : 1) } : p))
		try { was ? await unlikePost(token, post._id) : await likePost(token, post._id) }
		catch { setPosts(prev => prev.map(p => p._id === post._id ? { ...p, isLiked: was, likesCount: p.likesCount + (was ? 1 : -1) } : p)) }
	}, [token])

	const handleDeletePost = useCallback(async (postId: string) => {
		if (!token) return
		setPosts(prev => prev.filter(p => p._id !== postId)); setDeleteConfirm(null)
		try { await deletePost(token, postId) } catch { /* ignore */ }
	}, [token])

	const handleCommentCreate = useCallback(async (postId: string, text: string, parentId?: string) => {
		if (!token) return
		const comment = await createComment(token, postId, { text, parentId })
		setCommentsMap(prev => {
			if (!prev[postId] || prev[postId].some(c => c._id === comment._id)) return prev
			return { ...prev, [postId]: [...prev[postId], comment] }
		})
		setPosts(prev => prev.map(p => p._id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
	}, [token])

	const handleCommentUpdate = useCallback(async (commentId: string, text: string) => {
		if (!token) return
		const updated = await updateComment(token, commentId, text)
		setCommentsMap(prev => {
			const pid = updated.postId
			if (!prev[pid]) return prev
			return { ...prev, [pid]: prev[pid].map(c => c._id === commentId ? updated : c) }
		})
	}, [token])

	const handleCommentDelete = useCallback(async (commentId: string) => {
		if (!token) return
		let pid = ''
		for (const [p, cs] of Object.entries(commentsMap)) { if (cs.some(c => c._id === commentId)) { pid = p; break } }
		if (!pid) return
		const replyCount = commentsMap[pid]?.filter(c => c.parentId === commentId).length || 0
		setCommentsMap(prev => ({ ...prev, [pid]: (prev[pid] || []).filter(c => c._id !== commentId && c.parentId !== commentId) }))
		setPosts(prev => prev.map(p => p._id === pid ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1 - replyCount) } : p))
		try { await deleteComment(token, commentId) } catch { /* ignore */ }
	}, [token, commentsMap])

	const handleCommentLike = useCallback(async (commentId: string, isLiked: boolean) => {
		if (!token) return
		setCommentsMap(prev => {
			const u: Record<string, CommentData[]> = {}
			for (const pid of Object.keys(prev))
				u[pid] = prev[pid].map(c => c._id === commentId ? { ...c, isLiked: !isLiked, likesCount: c.likesCount + (isLiked ? -1 : 1) } : c)
			return u
		})
		try { isLiked ? await unlikeComment(token, commentId) : await likeComment(token, commentId) }
		catch { /* ignore */ }
	}, [token])

	return (
		<div className='relative min-h-[88vh] flex flex-col items-center px-[16px] py-[36px] md:py-[52px] overflow-hidden'>
			{isDark && (
				<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
					<div className='w-[700px] h-[700px] rounded-full' style={{ background: 'radial-gradient(circle, rgba(68,30,200,0.12) 0%, transparent 65%)' }} />
				</div>
			)}
			{!isDark && (
				<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
					<div className='w-[700px] h-[700px] rounded-full' style={{ background: 'radial-gradient(circle, rgba(192,83,58,0.04) 0%, transparent 65%)' }} />
				</div>
			)}

			<div className='relative z-10 w-full max-w-[700px] flex flex-col gap-[28px]'>
				{/* Title */}
				<div className='flex flex-col items-center gap-[7px]'>
					<span className='inline-flex items-center gap-[8px] text-[12px] px-[15px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-[600]'
						style={{
							border: `1px solid ${isDark ? 'rgba(68,170,255,0.35)' : 'var(--border-medium)'}`,
							color: isDark ? 'rgba(130,200,255,0.9)' : 'var(--text-muted)',
						}}
					>
						<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						{t('community.badge')}
					</span>
					<h1 className='font-amatic text-[34px] md:text-[44px] font-[700] text-center' style={{ color: isDark ? 'white' : 'var(--text-primary)' }}>{t('community.title')}</h1>
					<p className='text-[15px] text-center' style={{ color: isDark ? 'rgba(160,190,240,0.82)' : 'var(--text-secondary)' }}>
						{t('community.subtitle')}
					</p>
				</div>

				{/* Orb button */}
				<div className='flex justify-center'>
					<OrbButton onClick={() => setCreateOpen(true)} disabled={!isLoggedIn} />
				</div>

				{/* Sort */}
				<div className='flex items-center gap-[8px]'>
					{(['new', 'popular'] as const).map(s => (
						<button
							key={s} onClick={() => setSort(s)}
							className='px-[16px] py-[8px] rounded-[11px] text-[14px] font-[500] cursor-pointer transition-all'
							style={sort === s
								? (isDark
									? { background: 'rgba(68,170,255,0.18)', border: '1px solid rgba(68,170,255,0.5)', color: 'rgba(130,215,255,0.98)' }
									: { background: 'rgba(192,83,58,0.1)', border: '1px solid rgba(192,83,58,0.4)', color: 'var(--accent)' }
								)
								: (isDark
									? { background: 'transparent', border: '1px solid rgba(68,170,255,0.14)', color: 'rgba(170,200,255,0.78)' }
									: { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
								)
							}
						>
							{s === 'new' ? t('community.tab_new') : t('community.tab_popular')}
						</button>
					))}
					<span className='ml-auto text-[13px]' style={{ color: isDark ? 'rgba(150,180,240,0.68)' : 'var(--text-muted)' }}>
						{total > 0 && t('community.posts_count', { count: total })}
					</span>
				</div>

				{/* Feed */}
				{loading ? (
					<div className='flex justify-center py-[48px]'>
						<div className='w-[7px] h-[7px] rounded-full bg-[#44aaff] pulse-dot-anim' />
					</div>
				) : posts.length === 0 ? (
					<div className='flex flex-col items-center gap-[12px] py-[56px]' style={{ color: isDark ? 'rgba(155,185,240,0.62)' : 'var(--text-muted)' }}>
						<MessageCircle size={42} strokeWidth={1.2} />
						<p className='text-[16px] font-[500]'>{t('community.empty')}</p>
						<p className='text-[14px]'>{t('community.empty_sub')}</p>
					</div>
				) : (
					<div className='flex flex-col gap-[16px]'>
						{posts.map(post => (
							<PostCard
								key={post._id} post={post}
								comments={commentsMap[post._id]}
								commentsLoading={commentsLoading.has(post._id)}
								expanded={expandedPosts.has(post._id)}
								isLoggedIn={isLoggedIn} token={token}
								currentUserId={user?.id || null}
								onToggleExpand={() => toggleExpand(post._id)}
								onLike={() => handleLikePost(post)}
								onEdit={() => setEditPost(post)}
								onDelete={() => setDeleteConfirm(post._id)}
								onCommentCreate={handleCommentCreate}
								onCommentUpdate={handleCommentUpdate}
								onCommentDelete={handleCommentDelete}
								onCommentLike={handleCommentLike}
							/>
						))}
						{hasMore && (
							<button
								onClick={loadMore} disabled={loadingMore}
								className='mx-auto px-[22px] py-[11px] rounded-[12px] text-[14px] font-[500] cursor-pointer transition-all disabled:opacity-50'
								style={isDark
									? { border: '1px solid rgba(68,170,255,0.22)', color: 'rgba(150,195,255,0.82)' }
									: { border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }
								}
							>
								{loadingMore ? t('community.loading') : t('community.show_more')}
							</button>
						)}
					</div>
				)}
			</div>

			{/* Create modal */}
			{createOpen && token && (
				<PostModal
					title={t('community.new_post')} token={token}
					onClose={() => setCreateOpen(false)}
					onSubmit={async (topic, text) => {
						const post = await createPost(token, { topic, text })
						setPosts(prev => prev.some(p => p._id === post._id) ? prev : [post, ...prev])
					}}
				/>
			)}

			{/* Edit modal */}
			{editPost && token && (
				<PostModal
					title={t('community.edit_post')} token={token}
					initialTopic={editPost.topic} initialText={editPost.text}
					onClose={() => setEditPost(null)}
					onSubmit={async (topic, text) => {
						const updated = await updatePost(token, editPost._id, { topic, text })
						setPosts(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p))
					}}
				/>
			)}

			{/* Delete confirm */}
			{deleteConfirm && (
				<div className='fixed inset-0 z-[200] flex items-center justify-center p-[16px]' style={{ background: 'rgba(2,4,20,0.8)', backdropFilter: 'blur(7px)' }}>
					<div className='w-full max-w-[390px] rounded-[20px] px-[26px] py-[30px] flex flex-col gap-[18px]'
						style={isDark
							? { background: 'rgba(4,8,28,0.99)', border: '1px solid rgba(255,95,160,0.28)' }
							: { background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)' }
						}
					>
						<h3 className='text-[19px] font-[700]' style={{ color: isDark ? 'white' : 'var(--text-primary)' }}>{t('community.delete_confirm_title')}</h3>
						<p className='text-[14px]' style={{ color: isDark ? 'rgba(190,210,255,0.78)' : 'var(--text-secondary)' }}>{t('community.delete_confirm_msg')}</p>
						<div className='flex gap-[10px]'>
							<button onClick={() => setDeleteConfirm(null)} className='flex-1 py-[11px] rounded-[11px] text-[15px] cursor-pointer transition-all' style={isDark
								? { border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.72)' }
								: { border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
							}>{t('community.cancel')}</button>
							<button onClick={() => handleDeletePost(deleteConfirm)} className='flex-1 py-[11px] rounded-[11px] text-[15px] font-[600] cursor-pointer transition-all' style={isDark
								? { background: 'rgba(255,95,160,0.14)', border: '1px solid rgba(255,95,160,0.42)', color: 'rgba(255,120,170,0.98)' }
								: { background: 'rgba(200,60,60,0.06)', border: '1px solid rgba(200,60,60,0.25)', color: 'rgba(180,50,50,0.9)' }
							}>{t('community.delete')}</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
