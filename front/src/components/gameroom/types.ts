export interface RoomPlayer {
	socketId: string
	userId: string
	name: string
	initials: string
	role: string
	coins: number
	influence: number
	handRaised: boolean
	breakoutRoomId: string | null
	isGamemaster: boolean
	isSpectator: boolean
	connected: boolean
}

export interface ChatMessage {
	id: string
	userId: string
	name: string
	text: string
	ts: number
	recipients: string[]      // empty = public; userIds of intended recipients
	recipientNames: string[]  // display names, for UI
	spectatorChat?: boolean   // true = sent from spectator tab
}

export interface VoteOption {
	id: string
	text: string
	voterIds: string[]
}

export interface ActiveVote {
	id: string
	question: string
	options: VoteOption[]
	isAnonymous: boolean
	multipleChoice: boolean
	closed: boolean
	spectatorOnly?: boolean
}

export interface BreakoutRoom {
	id: string
	name: string
	imageUrl: string
	timerSeconds: number | null
	endsAt: number | null
	playerIds: string[]
	timer: RoomTimer | null
	shownImageUrl: string | null
}

export interface RoomTimer {
	label: string
	totalSeconds: number
	endsAt: number | null
	running: boolean
}

export interface GameRoomState {
	gameId: string
	status: 'lobby' | 'started' | 'ended'
	coinsPerPlayer: number
	influencePerPlayer: number
	players: RoomPlayer[]
	bankCoins: number
	messages: ChatMessage[]
	reactions: Record<string, number>
	announcement: string | null
	timer: RoomTimer | null
	activeVote: ActiveVote | null
	spectatorVote: ActiveVote | null
	breakoutRooms: BreakoutRoom[]
	/** The GM's image deck — filled for the gamemaster only (it arrives in gr:gm-state) */
	images: string[]
	coverImage: string
	/** Never sent in gr:state — the gamemaster gets it via gr:gm-state */
	scenario?: never
	/** The room's own clock, so countdowns agree across devices */
	serverNow?: number
	title: string
	gamemasterId: string
	shownImageUrl: string | null
	defaultTimerSeconds: number | null
	/** LiveKit is recording the main room */
	isRecording?: boolean
}
