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

// Zod strips unknown keys, and validateBody replaces the body with the result,
// so anything missing here was silently dropped before it reached the model.
// The form sends fourteen fields; this now knows all of them.
const gameFields = {
	title:               z.string().min(3, 'Title is too short').max(100),
	description:         z.string().max(500).optional(),
	minPlayers:          z.number().int().min(1).max(100).optional(),
	maxPlayers:          z.number().int().min(1).max(100).optional(),
	scenario:            z.string().max(20000).optional(),
	useCoins:            z.boolean().optional(),
	coinsPerPlayer:      z.number().int().min(0).max(1_000_000).optional(),
	useInfluence:        z.boolean().optional(),
	influencePerPlayer:  z.number().int().min(0).max(1_000_000).optional(),
	participationCost:   z.number().min(0).max(1_000_000).optional(),
	gmCardNumber:        z.string().regex(/^(\d{16})?$/, 'Card number must be 16 digits').optional(),
	scheduledAt:         z.coerce.date().optional(),
	coverImage:          z.string().url().or(z.literal('')).optional(),
	images:              z.array(z.string().url()).max(30).optional(),
	defaultTimerSeconds: z.number().int().min(1).max(86400).nullable().optional(),
}

export const createGameSchema = z.object(gameFields)
	.refine(d => (d.maxPlayers ?? 6) >= (d.minPlayers ?? 2), {
		message: 'maxPlayers must be greater than or equal to minPlayers',
		path: ['maxPlayers'],
	})

export const updateGameSchema = z.object({ ...gameFields, title: gameFields.title.optional() })
	.refine(d => d.minPlayers === undefined || d.maxPlayers === undefined || d.maxPlayers >= d.minPlayers, {
		message: 'maxPlayers must be greater than or equal to minPlayers',
		path: ['maxPlayers'],
	})

/** The fields a creator may change on an existing game. */
export const EDITABLE_GAME_FIELDS = Object.keys(gameFields) as Array<keyof typeof gameFields>

export const gameIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid game ID'),
})


// ────── LiveKit Schemas ──────────────────────────────────────────────────

// The client presents the code it was given — entry or spectator — and
// never a room name: the room, and whether the seat has a voice, are decided
// on the server from that code alone.
export const livekitTokenSchema = z.object({
	code: z.string().min(4).max(12),
	breakoutId: z.string().max(64).optional(),
})

// ────── Community Schemas ────────────────────────────────────────────────

export const createPostSchema = z.object({
	// 1000 is what the model allows; 2000 here meant a long post was accepted
	// by validation and then rejected by Mongoose as a 500.
	text: z.string().min(1, 'Post text is required').max(1000),
	topic: z.string().max(100).optional(),
})

export const createCommentSchema = z.object({
	text: z.string().min(1, 'Comment text is required').max(500),
})

export const postIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid post ID'),
})


// ────── Socket.IO Game Room Schemas ───────────────────────────────────────

// The code the person was given (entry or spectator). Whether they may speak
// is decided from it on the server — the old `isSpectatorJoin` flag came from
// the browser and a spectator could simply leave it out. The display name
// comes from the account, so `name` is no longer read.
export const grJoinSchema = z.object({
	// A plain string would reach Game.findOne() as an object and let a crafted
	// payload like {"$ne": null} open somebody else's room.
	gameCode: z.string().regex(/^[A-Za-z0-9-]{4,12}$/, 'Invalid game code'),
})

export const grChatSchema = z.object({
	gameCode: z.string().min(1),
	// Trimmed first, so a message of nothing but spaces is not a message
	text: z.string().trim().min(1, 'Message text is required').max(500),
	recipients: z.array(z.string().max(64)).max(100).optional(),
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

// The GM's notes are synced as they type so that leaving without pressing
// “end game” — or closing the tab — still delivers them.
export const grNotesSchema = z.object({
	gameCode: z.string().min(1),
	notes: z.string().max(50000),
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
	options: z.array(z.string().min(1).max(100)).min(2, 'At least 2 options required').max(20),
	isAnonymous: z.boolean(),
	multipleChoice: z.boolean(),
})

export const grVoteCastSchema = z.object({
	gameCode: z.string().min(1),
	optionIds: z.array(z.string().max(10)).min(1).max(50),
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
	options: z.array(z.string().min(1).max(100)).min(2).max(20),
	isAnonymous: z.boolean(),
	multipleChoice: z.boolean(),
})

export const grSpectatorVoteCastSchema = z.object({
	gameCode: z.string().min(1),
	optionIds: z.array(z.string().max(10)).min(1).max(50),
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
	imageUrl: z.string().url().or(z.literal('')).optional(),
	timerSeconds: z.number().int().positive().max(86400).nullable().optional(),
})

export const grBreakoutAssignSchema = z.object({
	gameCode: z.string().min(1),
	roomId: z.string().min(1),
	playerIds: z.array(z.string().max(64)).max(100),
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
	// null clears the picture — without it the GM could never take one down
	imageUrl: z.string().url('Invalid image URL').nullable(),
})

export const grRecordControlSchema = z.object({
	gameCode: z.string().min(1),
	action: z.enum(['start', 'stop']),
})

export const commentIdSchema = z.object({
	id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid comment ID'),
})

export const gameCodeSchema = z.object({
	code: z.string().regex(/^[A-Za-z0-9]{4,12}$/, 'Invalid game code'),
})

// The GM's notes exist only in the browser during a game, so the limit is
// generous — refusing a long session's notes would throw them away.
export const sendNotesSchema = z.object({
	notes: z.string().min(1, 'Notes are empty').max(50000, 'Notes are too long'),
	gameTitle: z.string().max(200).optional(),
	gameCode: z.string().max(10).optional(),
})

export const forgotPasswordSchema = z.object({
	email: z.string().email('Invalid email'),
})

export const resetPasswordSchema = z.object({
	token: z.string().min(10),
	password: z.string().min(8, 'Password must be at least 8 characters'),
})

// ────── Utility Types ────────────────────────────────────────────────────

export type RegisterRequest = z.infer<typeof registerSchema>
export type LoginRequest = z.infer<typeof loginSchema>
export type GoogleAuthRequest = z.infer<typeof googleAuthSchema>
export type CreateGameRequest = z.infer<typeof createGameSchema>
export type UpdateGameRequest = z.infer<typeof updateGameSchema>
export type CreatePostRequest = z.infer<typeof createPostSchema>
export type CreateCommentRequest = z.infer<typeof createCommentSchema>
