const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface RegisteredPlayer {
	userId: string
	name: string
	surname: string
	registeredAt: string
}

export interface GameData {
	/** Counts are public; the participant lists only reach the creator */
	playersCount?: number
	spectatorsCount?: number
	/** Whether the caller is registered — computed server-side */
	isRegistered?: boolean
	isSpectatorRegistered?: boolean
	_id: string
	title: string
	creatorId: string
	/** "Name Surname" from the gamemaster's account; empty if they gave none */
	creatorName: string
	/** When there is no name: the part of their email before the @ */
	creatorAlias?: string
	minPlayers: number
	maxPlayers: number
	description: string
	scenario: string
	useCoins: boolean
	coinsPerPlayer: number
	/** Coins the gamemaster's bank starts with */
	startingBank?: number
	useInfluence: boolean
	influencePerPlayer: number
	participationCost?: number
	// gmCardNumber is NOT in the list response — use fetchGameCard() separately
	hasGmCard?: boolean
	gmCardLast4?: string
	// present only in edit/detail responses:
	gmCardNumber?: string
	scheduledAt?: string
	coverImage: string
	images: string[]
	defaultTimerSeconds?: number | null
	gameCode: string
	spectatorCode?: string
	registeredPlayers?: RegisteredPlayer[]
	spectators?: RegisteredPlayer[]
	likesCount: number
	isLiked: boolean
	createdAt: string
}

export type GameBody = Omit<GameData, '_id' | 'creatorId' | 'creatorName' | 'creatorAlias' | 'createdAt'>

async function handleResponse<T>(res: Response): Promise<T> {
	const data = await res.json()
	if (!res.ok) throw new Error(data.message || 'Request failed')
	return data as T
}

/** Which seat a code gives. Never the entry code: a spectator must not learn it. */
export const resolveGameCode = (code: string): Promise<{ isSpectator: boolean; title: string }> =>
	fetch(`${API}/api/games/resolve/${encodeURIComponent(code)}`).then(handleResponse<{ isSpectator: boolean; title: string }>)

/**
 * The token is optional but matters: without it the server cannot tell who is
 * asking, so it withholds the entry code from the creator, reports nobody as
 * registered, and shows every game as unliked.
 */
export const getGames = (token?: string | null): Promise<GameData[]> =>
	fetch(`${API}/api/games`, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	}).then(handleResponse<GameData[]>)

export const getGameForEdit = (token: string, id: string): Promise<GameData> =>
	fetch(`${API}/api/games/${id}/edit`, {
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<GameData>)

export const createGame = (token: string, body: Partial<GameBody>): Promise<GameData> =>
	fetch(`${API}/api/games`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(body),
	}).then(handleResponse<GameData>)

export const updateGame = (token: string, id: string, body: Partial<GameBody>): Promise<GameData> =>
	fetch(`${API}/api/games/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(body),
	}).then(handleResponse<GameData>)

export const registerForGame = (
	token: string,
	id: string,
): Promise<{ gameCode: string } & SeatCounts> =>
	fetch(`${API}/api/games/${id}/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ gameCode: string } & SeatCounts>)

export const unregisterFromGame = (
	token: string,
	id: string,
): Promise<SeatCounts> =>
	fetch(`${API}/api/games/${id}/register`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<SeatCounts>)

export const deleteGame = (token: string, id: string): Promise<{ ok: boolean }> =>
	fetch(`${API}/api/games/${id}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ ok: boolean }>)

export const registerAsSpectator = (
	token: string,
	id: string,
): Promise<{ spectatorCode: string } & SeatCounts> =>
	fetch(`${API}/api/games/${id}/register-spectator`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ spectatorCode: string } & SeatCounts>)

export const unregisterAsSpectator = (
	token: string,
	id: string,
): Promise<SeatCounts> =>
	fetch(`${API}/api/games/${id}/register-spectator`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<SeatCounts>)

export const likeGame = (
	token: string,
	id: string,
): Promise<{ likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/games/${id}/like`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ likesCount: number; isLiked: boolean }>)

export const fetchGameCard = (
	token: string,
	id: string,
): Promise<{ gmCardNumber: string; gmCardFormatted: string; hasGmCard: boolean; participationCost: number }> =>
	fetch(`${API}/api/games/${id}/payment-details`, {
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ gmCardNumber: string; gmCardFormatted: string; hasGmCard: boolean; participationCost: number }>)

export const unlikeGame = (
	token: string,
	id: string,
): Promise<{ likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/games/${id}/like`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ likesCount: number; isLiked: boolean }>)

/** The gamemaster as the site shows them: the name, or "No name (alias)". */
export function gamemasterLabel(game: Pick<GameData, 'creatorName' | 'creatorAlias'>, noName: string): string {
	return game.creatorName || `${noName} (${game.creatorAlias ?? ''})`
}

/** What (un)registering answers: public counts and the caller's own place */
export interface SeatCounts {
	playersCount: number
	spectatorsCount: number
	isRegistered: boolean
	isSpectatorRegistered: boolean
}

/** Folds a registration answer into a game in the list */
export function withSeatCounts(g: GameData, c: SeatCounts): GameData {
	return { ...g, playersCount: c.playersCount, spectatorsCount: c.spectatorsCount, isRegistered: c.isRegistered, isSpectatorRegistered: c.isSpectatorRegistered }
}
