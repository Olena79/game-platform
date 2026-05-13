import React, { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Heart, MessageCircle, Pencil, Trash2, Send, X, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
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

const Avatar = ({ name, surname, size = 38 }: { name: string; surname: string; size?: number }) => (
	<div
		className='rounded-full flex items-center justify-center font-[700] flex-shrink-0 select-none'
		style={{
			width: size, height: size, fontSize: size * 0.38,
			background: 'rgba(68,170,255,0.18)',
			border: '1.5px solid rgba(68,170,255,0.38)',
			color: 'rgba(120,200,255,0.95)',
		}}
	>
		{initials(name, surname) || '?'}
	</div>
)

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
	const isOwn      = currentUserId === comment.authorId
	const isEditing  = editingId === comment._id
	const isReplying = replyingToId === comment._id
	const fullName   = [comment.authorName, comment.authorSurname].filter(Boolean).join(' ')

	return (
		<div className={depth > 0 ? 'pl-[18px] border-l-2 border-[rgba(68,170,255,0.18)]' : ''}>
			<div className='py-[11px]'>
				<div className='flex items-start gap-[9px]'>
					<Avatar name={comment.authorName} surname={comment.authorSurname} size={30} />
					<div className='flex-1 min-w-0'>
						<div className='flex items-center gap-[7px] flex-wrap'>
							<span className='text-[14px] font-[600]' style={{ color: 'rgba(215,232,255,0.97)' }}>{fullName}</span>
							<span className='text-[12px]' style={{ color: 'rgba(155,185,240,0.72)' }}>{fmtDate(comment.createdAt)}</span>
							{comment.editedAt && (
								<span className='text-[11px]' style={{ color: 'rgba(255,183,40,0.65)' }}>· відредаговано</span>
							)}
						</div>

						{isEditing ? (
							<div className='mt-[7px] flex flex-col gap-[7px]'>
								<textarea
									value={editingText}
									onChange={e => onEditTextChange(e.target.value.slice(0, 500))}
									rows={2}
									autoFocus
									className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.38)] rounded-[9px] px-[11px] py-[9px] text-[14px] text-[rgba(215,232,255,0.95)] placeholder-[rgba(100,140,220,0.5)] focus:outline-none focus:border-[rgba(68,170,255,0.7)] resize-none transition-all'
								/>
								<div className='flex gap-[7px]'>
									<button
										onClick={() => onSaveEdit(comment._id)}
										className='px-[12px] py-[5px] rounded-[8px] text-[13px] font-[600] cursor-pointer transition-all'
										style={{ background: 'rgba(68,170,255,0.18)', border: '1px solid rgba(68,170,255,0.48)', color: 'rgba(120,200,255,0.95)' }}
									>Зберегти</button>
									<button onClick={onCancelEdit} className='px-[10px] py-[5px] rounded-[8px] text-[13px] cursor-pointer' style={{ color: 'rgba(170,190,240,0.75)' }}>Скасувати</button>
								</div>
							</div>
						) : (
							<p className='mt-[5px] text-[14px] leading-[1.65] whitespace-pre-wrap break-words' style={{ color: 'rgba(215,230,255,0.92)' }}>
								{comment.text}
							</p>
						)}

						{!isEditing && (
							<div className='flex items-center gap-[14px] mt-[7px] flex-wrap'>
								<button
									onClick={() => isLoggedIn && onLike(comment._id, comment.isLiked)}
									className={`flex items-center gap-[5px] text-[13px] transition-all ${isLoggedIn ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
									style={{ color: comment.isLiked ? 'rgba(255,80,150,0.98)' : 'rgba(190,210,255,0.68)' }}
								>
									<Heart size={14} strokeWidth={2} fill={comment.isLiked ? 'currentColor' : 'none'} />
									{comment.likesCount > 0 && <span className='font-[600]'>{comment.likesCount}</span>}
								</button>

								{isLoggedIn && depth === 0 && (
									<button
										onClick={() => onStartReply(comment._id)}
										className='flex items-center gap-[5px] text-[13px] cursor-pointer transition-all hover:opacity-90'
										style={{ color: 'rgba(192,130,255,0.82)' }}
									>
										<CornerDownRight size={13} strokeWidth={2} />
										Відповісти
									</button>
								)}

								{isOwn && (
									<>
										<button onClick={() => onStartEdit(comment._id, comment.text)} className='flex items-center gap-[4px] text-[13px] cursor-pointer transition-all hover:opacity-90' style={{ color: 'rgba(68,170,255,0.88)' }}>
											<Pencil size={12} strokeWidth={2} />Ред.
										</button>
										<button onClick={() => onDelete(comment._id)} className='flex items-center gap-[4px] text-[13px] cursor-pointer transition-all hover:opacity-90' style={{ color: 'rgba(255,95,160,0.88)' }}>
											<Trash2 size={12} strokeWidth={2} />Вид.
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
							placeholder='Ваша відповідь...'
							className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.28)] rounded-[9px] px-[11px] py-[9px] text-[14px] text-[rgba(215,232,255,0.95)] placeholder-[rgba(130,160,230,0.5)] focus:outline-none focus:border-[rgba(68,170,255,0.58)] resize-none transition-all'
						/>
						<div className='flex gap-[7px]'>
							<button onClick={() => onSaveReply(comment._id)} className='px-[12px] py-[5px] rounded-[8px] text-[13px] font-[600] cursor-pointer transition-all' style={{ background: 'rgba(68,170,255,0.18)', border: '1px solid rgba(68,170,255,0.45)', color: 'rgba(120,200,255,0.95)' }}>Відповісти</button>
							<button onClick={onCancelReply} className='px-[10px] py-[5px] rounded-[8px] text-[13px] cursor-pointer' style={{ color: 'rgba(170,190,240,0.75)' }}>Скасувати</button>
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
		<div className='mt-[2px] pt-[14px] border-t border-[rgba(68,170,255,0.1)]'>
			{isLoggedIn && (
				<div className='flex flex-col gap-[7px] mb-[16px]'>
					<textarea
						value={newText}
						onChange={e => setNewText(e.target.value.slice(0, 500))}
						rows={2}
						placeholder='Написати коментар...'
						className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.22)] rounded-[10px] px-[13px] py-[10px] text-[14px] text-[rgba(215,232,255,0.95)] placeholder-[rgba(130,160,230,0.5)] focus:outline-none focus:border-[rgba(68,170,255,0.58)] resize-none transition-all'
					/>
					<div className='flex items-center justify-between'>
						<span className='text-[12px]' style={{ color: 'rgba(130,160,220,0.58)' }}>{newText.length} / 500</span>
						<button
							onClick={handleSubmit}
							disabled={!newText.trim() || submitting}
							className='flex items-center gap-[6px] px-[14px] py-[7px] rounded-[9px] text-[13px] font-[600] cursor-pointer transition-all disabled:opacity-40'
							style={{ background: 'rgba(68,170,255,0.16)', border: '1px solid rgba(68,170,255,0.45)', color: 'rgba(120,200,255,0.95)' }}
						>
							<Send size={13} strokeWidth={2} />
							{submitting ? '...' : 'Відправити'}
						</button>
					</div>
				</div>
			)}

			{loading ? (
				<div className='flex justify-center py-[18px]'>
					<div className='w-[5px] h-[5px] rounded-full bg-[#44aaff] pulse-dot-anim' />
				</div>
			) : (
				<div className='flex flex-col divide-y divide-[rgba(68,170,255,0.07)]'>
					{rootComments.length === 0 && !isLoggedIn && (
						<p className='text-[14px] py-[10px]' style={{ color: 'rgba(155,185,240,0.58)' }}>Коментарів поки немає</p>
					)}
					{rootComments.map(c => (
						<CommentItem
							key={c._id}
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
	const isOwn    = currentUserId === post.authorId
	const fullName = [post.authorName, post.authorSurname].filter(Boolean).join(' ')

	return (
		<div
			className='rounded-[20px] px-[22px] py-[20px] flex flex-col gap-[14px] transition-all'
			style={{ background: 'rgba(8,12,38,0.78)', border: '1px solid rgba(68,170,255,0.17)', backdropFilter: 'blur(10px)' }}
		>
			{/* Header */}
			<div className='flex items-start justify-between gap-[10px]'>
				<div className='flex items-start gap-[11px] min-w-0'>
					<Avatar name={post.authorName} surname={post.authorSurname} />
					<div className='min-w-0'>
						<div className='flex items-center gap-[8px] flex-wrap'>
							<span className='text-[15px] font-[600]' style={{ color: 'rgba(225,238,255,0.98)' }}>{fullName}</span>
							<span className='text-[12px]' style={{ color: 'rgba(155,185,240,0.75)' }}>{fmtDate(post.createdAt)}</span>
							{post.editedAt && (
								<span className='text-[11px]' style={{ color: 'rgba(255,183,40,0.72)' }}>· відредаговано</span>
							)}
						</div>
						{post.topic && (
							<span
								className='inline-block mt-[5px] px-[9px] py-[3px] rounded-[7px] text-[12px] font-[500]'
								style={{ background: 'rgba(68,170,255,0.12)', border: '1px solid rgba(68,170,255,0.32)', color: 'rgba(130,210,255,0.97)' }}
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
							style={{ background: 'rgba(68,170,255,0.1)', border: '1px solid rgba(68,170,255,0.32)', color: 'rgba(100,190,255,0.92)' }}
						>
							<Pencil size={12} strokeWidth={2} />
							<span className='hidden sm:inline'>Ред.</span>
						</button>
						<button
							onClick={onDelete}
							className='flex items-center gap-[5px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-125'
							style={{ background: 'rgba(255,95,160,0.08)', border: '1px solid rgba(255,95,160,0.28)', color: 'rgba(255,120,170,0.92)' }}
						>
							<Trash2 size={12} strokeWidth={2} />
							<span className='hidden sm:inline'>Вид.</span>
						</button>
					</div>
				)}
			</div>

			{/* Text */}
			<p className='text-[15px] leading-[1.72] whitespace-pre-wrap break-words' style={{ color: 'rgba(218,232,255,0.95)' }}>
				{post.text}
			</p>

			{/* Footer */}
			<div className='flex items-center gap-[18px] pt-[2px]'>
				<button
					onClick={() => isLoggedIn && onLike()}
					className={`flex items-center gap-[6px] text-[14px] font-[500] transition-all ${isLoggedIn ? 'cursor-pointer hover:opacity-90' : 'cursor-default opacity-60'}`}
					style={{ color: post.isLiked ? 'rgba(255,75,145,0.98)' : 'rgba(190,210,255,0.7)' }}
					title={!isLoggedIn ? 'Увійдіть, щоб вподобати' : undefined}
				>
					<Heart size={16} strokeWidth={2} fill={post.isLiked ? 'currentColor' : 'none'} />
					{post.likesCount > 0 && <span>{post.likesCount}</span>}
				</button>

				<button
					onClick={onToggleExpand}
					className='flex items-center gap-[6px] text-[14px] font-[500] cursor-pointer transition-all hover:opacity-90'
					style={{ color: expanded ? 'rgba(0,240,200,0.95)' : 'rgba(0,210,180,0.68)' }}
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

const modalInputCls = 'w-full bg-[#060e24] border border-[rgba(68,170,255,0.22)] rounded-[11px] px-[15px] py-[11px] text-[15px] text-[rgba(218,232,255,0.95)] placeholder-[rgba(130,160,230,0.5)] focus:outline-none focus:border-[rgba(68,170,255,0.6)] transition-all'
const modalTextareaCls = `${modalInputCls} resize-none leading-[1.65]`

const PostModal = ({
	title, token, initialTopic = '', initialText = '',
	onClose, onSubmit,
}: {
	title: string; token: string; initialTopic?: string; initialText?: string
	onClose: () => void; onSubmit: (topic: string, text: string) => Promise<void>
	authorName?: string; authorSurname?: string
}) => {
	const [topic, setTopic]     = useState(initialTopic)
	const [text, setText]       = useState(initialText)
	const [loading, setLoading] = useState(false)
	const [error, setError]     = useState('')

	const handle = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!text.trim()) { setError('Напишіть текст'); return }
		setLoading(true); setError('')
		try { await onSubmit(topic.trim(), text.trim()); onClose() }
		catch (err) { setError(err instanceof Error ? err.message : 'Помилка') }
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
				style={{ background: 'rgba(4,8,28,0.99)', border: '1px solid rgba(68,170,255,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.65)' }}
			>
				<div className='flex items-center justify-between'>
					<h2 className='text-[20px] font-[700] text-white'>{title}</h2>
					<button onClick={onClose} className='text-[rgba(180,200,255,0.45)] hover:text-white transition-colors cursor-pointer'><X size={20} strokeWidth={2} /></button>
				</div>

				<form onSubmit={handle} className='flex flex-col gap-[13px]'>
					<input
						type='text'
						placeholder="Тема (необов'язково)"
						value={topic}
						onChange={e => setTopic(e.target.value.slice(0, 100))}
						className={modalInputCls}
					/>
					<div className='flex flex-col gap-[5px]'>
						<textarea
							placeholder='Що хочете запитати або обговорити?'
							value={text}
							onChange={e => setText(e.target.value.slice(0, 1000))}
							rows={5} autoFocus
							className={modalTextareaCls}
						/>
						<span className={`text-[12px] text-right pr-[2px] ${text.length >= 900 ? 'text-[rgba(255,183,40,0.75)]' : 'text-[rgba(130,160,220,0.55)]'}`}>
							{text.length} / 1000
						</span>
					</div>
					{error && <p className='text-[14px] text-[rgba(255,90,160,0.92)]'>{error}</p>}
					<div className='flex gap-[10px] pt-[4px]'>
						<button type='button' onClick={onClose} className='flex-1 py-[11px] rounded-[11px] text-[15px] font-[500] cursor-pointer transition-all' style={{ border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.7)' }}>Скасувати</button>
						<button type='submit' disabled={loading || !text.trim()} className='flex-1 py-[11px] rounded-[11px] text-[15px] font-[600] cursor-pointer transition-all disabled:opacity-40' style={{ background: 'rgba(68,170,255,0.2)', border: '1px solid rgba(68,170,255,0.55)', color: 'rgba(130,210,255,0.98)' }}>
							{loading ? '...' : 'Опублікувати'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

// ─── OrbButton ────────────────────────────────────────────────────────────────

const OrbButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
	<div className={`flex flex-col items-center gap-[18px] ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
		<div className='relative flex items-center justify-center' style={{ width: 188, height: 188 }}>
			{/* Sparkles */}
			<span className='absolute top-[14px] left-[12px] text-[12px] orb-sp-1 pointer-events-none select-none' style={{ color: '#0fffc8' }}>✦</span>
			<span className='absolute top-[22px] right-[10px] text-[9px] orb-sp-2 pointer-events-none select-none' style={{ color: '#c07fff' }}>✦</span>
			<span className='absolute bottom-[16px] left-[8px] text-[10px] orb-sp-3 pointer-events-none select-none' style={{ color: '#44aaff' }}>✦</span>
			<span className='absolute bottom-[10px] right-[16px] text-[11px] orb-sp-1 pointer-events-none select-none' style={{ color: '#ff5fa0' }}>✦</span>
			<span className='absolute' style={{ top: '48%', left: 2, color: '#c07fff', fontSize: 8 }} >✦</span>
			<span className='absolute' style={{ top: '52%', right: 2, color: '#0fffc8', fontSize: 8 }}>✦</span>

			{/* Outer orbit ring */}
			<div className='absolute inset-0 rounded-full orb-orbit pointer-events-none'
				style={{ border: '1.5px solid rgba(0,255,200,0.38)', boxShadow: '0 0 14px rgba(0,255,200,0.18)' }} />

			{/* Tilted ellipse orbit */}
			<div className='absolute orb-orbit-slow pointer-events-none'
				style={{
					width: 200, height: 60,
					top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
					borderRadius: '50%',
					border: '1.5px solid rgba(68,170,255,0.32)',
					boxShadow: '0 0 12px rgba(68,170,255,0.16)',
				}} />

			{/* Ambient glow behind button */}
			<div className='absolute rounded-full pointer-events-none'
				style={{
					width: 148, height: 148, top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
					background: 'radial-gradient(circle, rgba(60,30,200,0.22) 0%, transparent 70%)',
				}} />

			{/* Main button */}
			<button
				onClick={onClick}
				className='relative z-10 w-[120px] h-[120px] rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.07] orb-glow-anim'
				style={{
					background: 'radial-gradient(circle at 36% 36%, rgba(60,120,255,0.26), rgba(110,0,230,0.22) 55%, rgba(4,8,32,0.88))',
					border: '2px solid rgba(80,160,255,0.48)',
				}}
			>
				<div className='relative'>
					<MessageCircle size={46} strokeWidth={1.5} style={{ color: 'rgba(0,245,205,0.9)' }} />
					<Pencil size={20} strokeWidth={2.2}
						className='absolute -bottom-[2px] -right-[2px]'
						style={{ color: 'rgba(200,120,255,0.98)' }}
					/>
				</div>
			</button>
		</div>
		<span className='text-[17px] font-[600]' style={{ color: 'rgba(225,240,255,0.97)' }}>Створити запит</span>
	</div>
)

// ─── CommunityPage ────────────────────────────────────────────────────────────

export const CommunityPage = () => {
	const { user, token, isLoggedIn } = useAuth()

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
		const socket = io(API, { transports: ['websocket', 'polling'] })
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
			<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
				<div className='w-[700px] h-[700px] rounded-full' style={{ background: 'radial-gradient(circle, rgba(68,30,200,0.12) 0%, transparent 65%)' }} />
			</div>

			<div className='relative z-10 w-full max-w-[700px] flex flex-col gap-[28px]'>
				{/* Title */}
				<div className='flex flex-col items-center gap-[7px]'>
					<span className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(130,200,255,0.9)] text-[12px] px-[15px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-[600]'>
						<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						Спільнота
					</span>
					<h1 className='font-amatic text-[34px] md:text-[44px] font-[700] text-white text-center'>Спільноти</h1>
					<p className='text-[15px] text-center' style={{ color: 'rgba(160,190,240,0.82)' }}>
						Запитуйте, обговорюйте, діліться думками
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
								? { background: 'rgba(68,170,255,0.18)', border: '1px solid rgba(68,170,255,0.5)', color: 'rgba(130,215,255,0.98)' }
								: { background: 'transparent', border: '1px solid rgba(68,170,255,0.14)', color: 'rgba(170,200,255,0.78)' }
							}
						>
							{s === 'new' ? '✦ Нові' : '🔥 Популярні'}
						</button>
					))}
					<span className='ml-auto text-[13px]' style={{ color: 'rgba(150,180,240,0.68)' }}>
						{total > 0 && `${total} публікацій`}
					</span>
				</div>

				{/* Feed */}
				{loading ? (
					<div className='flex justify-center py-[48px]'>
						<div className='w-[7px] h-[7px] rounded-full bg-[#44aaff] pulse-dot-anim' />
					</div>
				) : posts.length === 0 ? (
					<div className='flex flex-col items-center gap-[12px] py-[56px]' style={{ color: 'rgba(155,185,240,0.62)' }}>
						<MessageCircle size={42} strokeWidth={1.2} />
						<p className='text-[16px] font-[500]'>Поки немає публікацій</p>
						<p className='text-[14px]'>Будьте першим — натисніть на орб вище</p>
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
								style={{ border: '1px solid rgba(68,170,255,0.22)', color: 'rgba(150,195,255,0.82)' }}
							>
								{loadingMore ? 'Завантаження...' : 'Показати більше'}
							</button>
						)}
					</div>
				)}
			</div>

			{/* Create modal */}
			{createOpen && token && (
				<PostModal
					title='Новий пост' token={token}
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
					title='Редагувати пост' token={token}
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
					<div className='w-full max-w-[390px] rounded-[20px] px-[26px] py-[30px] flex flex-col gap-[18px]' style={{ background: 'rgba(4,8,28,0.99)', border: '1px solid rgba(255,95,160,0.28)' }}>
						<h3 className='text-[19px] font-[700] text-white'>Видалити пост?</h3>
						<p className='text-[14px]' style={{ color: 'rgba(190,210,255,0.78)' }}>Цю дію неможливо скасувати. Всі коментарі також будуть видалені.</p>
						<div className='flex gap-[10px]'>
							<button onClick={() => setDeleteConfirm(null)} className='flex-1 py-[11px] rounded-[11px] text-[15px] cursor-pointer transition-all' style={{ border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.72)' }}>Скасувати</button>
							<button onClick={() => handleDeletePost(deleteConfirm)} className='flex-1 py-[11px] rounded-[11px] text-[15px] font-[600] cursor-pointer transition-all' style={{ background: 'rgba(255,95,160,0.14)', border: '1px solid rgba(255,95,160,0.42)', color: 'rgba(255,120,170,0.98)' }}>Видалити</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
