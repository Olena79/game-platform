import { z } from 'zod'

// ────── Auth Schemas ──────────────────────────────────────────────────────

export const registerSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	name: z.string().min(1, 'Name is required').max(100).optional().default(''),
	surname: z.string().max(100).optional().default(''),
})

export const loginSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(1, 'Password is required'),
})

export const googleAuthSchema = z.object({
	token: z.string().min(1, 'Google token is required'),
})

export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, 'Refresh token is required'),
})

// ────── Game Schemas ──────────────────────────────────────────────────────

export const createGameSchema = z.object({
	title: z.string().min(3, 'Title must be at least 3 characters').max(100),
	description: z.string().max(500).optional(),
	maxParticipants: z.number().min(1).max(100).optional().default(10),
	recordingEnabled: z.boolean().optional().default(true),
})

export const updateGameSchema = z.object({
	title: z.string().min(3).max(100).optional(),
	description: z.string().max(500).optional(),
	maxParticipants: z.number().min(1).max(100).optional(),
	recordingEnabled: z.boolean().optional(),
})

export const gameIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid game ID'),
})

export const joinGameSchema = z.object({
	roomCode: z.string().min(1, 'Room code is required'),
})

// ────── LiveKit Schemas ──────────────────────────────────────────────────

export const livekitTokenSchema = z.object({
	roomName: z.string().min(1, 'Room name is required').max(100, 'Room name too long'),
	userName: z.string().min(1, 'User name is required').max(100, 'User name too long'),
})

// ────── Community Schemas ────────────────────────────────────────────────

export const createPostSchema = z.object({
	text: z.string().min(1, 'Post text is required').max(2000),
	images: z.array(z.string().url()).optional().default([]),
})

export const createCommentSchema = z.object({
	text: z.string().min(1, 'Comment text is required').max(500),
})

export const postIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid post ID'),
})

// ────── Recording Schemas ────────────────────────────────────────────────

export const recordingIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recording ID'),
})

// ────── Socket.IO Game Room Schemas ───────────────────────────────────────

export const grJoinSchema = z.object({
	gameCode: z.string().min(1, 'Game code is required'),
	name: z.string().min(1, 'Name is required').max(100),
	isSpectatorJoin: z.boolean().optional(),
})

export const grChatSchema = z.object({
	gameCode: z.string().min(1),
	text: z.string().min(1, 'Message text is required').max(500),
	recipients: z.array(z.string()).optional(),
})

export const grReactSchema = z.object({
	gameCode: z.string().min(1),
	emoji: z.string().min(1).max(10), // emoji validation
})

export const grHandSchema = z.object({
	gameCode: z.string().min(1),
	raised: z.boolean(),
})

export const grRoleSchema = z.object({
	gameCode: z.string().min(1),
	targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
	role: z.string().min(1).max(100),
})

export const grStartSchema = z.object({
	gameCode: z.string().min(1),
})

export const grEndSchema = z.object({
	gameCode: z.string().min(1),
})

export const grCoinsTransferSchema = z.object({
	gameCode: z.string().min(1),
	toUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
	amount: z.number().int().min(0).max(1000000),
})

export const grCoinsBankSchema = z.object({
	gameCode: z.string().min(1),
	amount: z.number().int().min(0).max(1000000),
})

export const grInfluenceSchema = z.object({
	gameCode: z.string().min(1),
	targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
	delta: z.number().min(-1000).max(1000),
})

export const grMuteAllSchema = z.object({
	gameCode: z.string().min(1),
})

export const grMutePlayerSchema = z.object({
	gameCode: z.string().min(1),
	targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
})

export const grAnnounceSchema = z.object({
	gameCode: z.string().min(1),
	text: z.string().max(500).nullable(),
})

export const grTimerSchema = z.object({
	gameCode: z.string().min(1),
	action: z.enum(['set', 'start', 'stop', 'clear']),
	label: z.string().max(100).optional(),
	seconds: z.number().min(1).max(86400).optional(),
})

export const grVoteCreateSchema = z.object({
	gameCode: z.string().min(1),
	question: z.string().min(1, 'Question is required').max(300),
	options: z.array(z.string().min(1).max(100)).min(2, 'At least 2 options required'),
	isAnonymous: z.boolean(),
	multipleChoice: z.boolean(),
})

export const grVoteCastSchema = z.object({
	gameCode: z.string().min(1),
	optionIds: z.array(z.string()).min(1),
})

export const grVoteCloseSchema = z.object({
	gameCode: z.string().min(1),
})

export const grVoteClearSchema = z.object({
	gameCode: z.string().min(1),
})

export const grSpectatorVoteCreateSchema = z.object({
	gameCode: z.string().min(1),
	question: z.string().min(1).max(300),
	options: z.array(z.string().min(1).max(100)).min(2),
	isAnonymous: z.boolean(),
	multipleChoice: z.boolean(),
})

export const grSpectatorVoteCastSchema = z.object({
	gameCode: z.string().min(1),
	optionIds: z.array(z.string()).min(1),
})

export const grSpectatorVoteCloseSchema = z.object({
	gameCode: z.string().min(1),
})

export const grSpectatorVoteClearSchema = z.object({
	gameCode: z.string().min(1),
})

export const grBreakoutCreateSchema = z.object({
	gameCode: z.string().min(1),
	name: z.string().min(1, 'Room name is required').max(50),
	imageUrl: z.string().optional(),
	timerSeconds: z.number().positive().nullable().optional(),
})

export const grBreakoutAssignSchema = z.object({
	gameCode: z.string().min(1),
	roomId: z.string().min(1),
	playerIds: z.array(z.string()),
})

export const grBreakoutReturnSchema = z.object({
	gameCode: z.string().min(1),
	roomId: z.string().min(1),
})

export const grBreakoutJoinSchema = z.object({
	gameCode: z.string().min(1),
	roomId: z.string().min(1),
})

export const grBreakoutLeaveSchema = z.object({
	gameCode: z.string().min(1),
})

export const grBreakoutEndSchema = z.object({
	gameCode: z.string().min(1),
	roomId: z.string().min(1),
})

export const grImageShowSchema = z.object({
	gameCode: z.string().min(1),
	imageUrl: z.string().url('Invalid image URL'),
})

export const grRecordControlSchema = z.object({
	gameCode: z.string().min(1),
	action: z.enum(['start', 'stop']),
})

export const grObserverConnectSchema = z.object({
	gameCode: z.string().min(1, 'Game code is required'),
})

export const grRecordStatusSchema = z.object({
	gameCode: z.string().min(1, 'Game code is required'),
	status: z.enum(['idle', 'recording', 'done', 'error']),
})

export const commentIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid comment ID'),
})

export const gameCodeSchema = z.object({
	code: z.string().min(1).max(10, 'Invalid game code'),
})

// ────── Telegram Schemas ──────────────────────────────────────

export const telegramLinkSchema = z.object({
	userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
	telegramChatId: z.string().min(1, 'Telegram chat ID is required'),
})

// ────── Utility Types ────────────────────────────────────────────────────

export type RegisterRequest = z.infer<typeof registerSchema>
export type LoginRequest = z.infer<typeof loginSchema>
export type GoogleAuthRequest = z.infer<typeof googleAuthSchema>
export type CreateGameRequest = z.infer<typeof createGameSchema>
export type UpdateGameRequest = z.infer<typeof updateGameSchema>
export type CreatePostRequest = z.infer<typeof createPostSchema>
export type CreateCommentRequest = z.infer<typeof createCommentSchema>
