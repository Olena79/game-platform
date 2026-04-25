const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface RegisteredPlayer {
	userId: string
	name: string
	surname: string
	registeredAt: string
}

export interface GameData {
	_id: string
	title: string
	creatorId: string
	creatorName: string
	minPlayers: number
	maxPlayers: number
	description: string
	scenario: string
	useCoins: boolean
	coinsPerPlayer: number
	useInfluence: boolean
	influencePerPlayer: number
	scheduledAt?: string
	coverImage: string
	images: string[]
	gameCode: string
	spectatorCode?: string
	registeredPlayers: RegisteredPlayer[]
	spectators: RegisteredPlayer[]
	likesCount: number
	isLiked: boolean
	createdAt: string
}

export type GameBody = Omit<GameData, '_id' | 'creatorId' | 'creatorName' | 'createdAt'>

async function handleResponse<T>(res: Response): Promise<T> {
	const data = await res.json()
	if (!res.ok) throw new Error(data.message || 'Request failed')
	return data as T
}

export const resolveGameCode = (code: string): Promise<{ gameCode: string; isSpectator: boolean }> =>
	fetch(`${API}/api/games/resolve/${encodeURIComponent(code)}`).then(handleResponse<{ gameCode: string; isSpectator: boolean }>)

export const getGames = (): Promise<GameData[]> =>
	fetch(`${API}/api/games`).then(handleResponse<GameData[]>)

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
): Promise<{ gameCode: string; registeredPlayers: RegisteredPlayer[] }> =>
	fetch(`${API}/api/games/${id}/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ gameCode: string; registeredPlayers: RegisteredPlayer[] }>)

export const unregisterFromGame = (
	token: string,
	id: string,
): Promise<{ registeredPlayers: RegisteredPlayer[] }> =>
	fetch(`${API}/api/games/${id}/register`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ registeredPlayers: RegisteredPlayer[] }>)

export const deleteGame = (token: string, id: string): Promise<{ ok: boolean }> =>
	fetch(`${API}/api/games/${id}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ ok: boolean }>)

export const registerAsSpectator = (
	token: string,
	id: string,
): Promise<{ spectators: RegisteredPlayer[]; spectatorCode: string }> =>
	fetch(`${API}/api/games/${id}/register-spectator`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ spectators: RegisteredPlayer[]; spectatorCode: string }>)

export const unregisterAsSpectator = (
	token: string,
	id: string,
): Promise<{ spectators: RegisteredPlayer[] }> =>
	fetch(`${API}/api/games/${id}/register-spectator`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ spectators: RegisteredPlayer[] }>)

export const likeGame = (
	token: string,
	id: string,
): Promise<{ likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/games/${id}/like`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ likesCount: number; isLiked: boolean }>)

export const unlikeGame = (
	token: string,
	id: string,
): Promise<{ likesCount: number; isLiked: boolean }> =>
	fetch(`${API}/api/games/${id}/like`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` },
	}).then(handleResponse<{ likesCount: number; isLiked: boolean }>)
