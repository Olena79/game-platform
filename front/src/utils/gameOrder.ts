/**
 * How the games list is ordered and filtered (OurGamesPage).
 *
 * "Nearest date" used to sort every game by its date, past ones included,
 * so a game played last week came first and a new one went to the end
 * (2026-10-06). Now: games to come (and one that started less than
 * GAME_LIVE_MS ago — it may be on right now) first, nearest first; then
 * games with no date; then games already played, most recent first.
 * The other sorts keep that order among equals.
 */
export const GAME_LIVE_MS = 3 * 60 * 60 * 1000

export type SortKey = 'date' | 'players_asc' | 'players_desc' | 'likes'

interface Sortable {
	scheduledAt?: string | Date | null
	playersCount?: number
	likesCount?: number
}

const timeOf = (g: Sortable): number | null => {
	if (!g.scheduledAt) return null
	const t = new Date(g.scheduledAt).getTime()
	return isNaN(t) ? null : t
}

/** 0 — to come (or on now), 1 — no date, 2 — played */
function group(g: Sortable, now: number): number {
	const t = timeOf(g)
	if (t === null) return 1
	return t >= now - GAME_LIVE_MS ? 0 : 2
}

function byDate(a: Sortable, b: Sortable, now: number): number {
	const ga = group(a, now), gb = group(b, now)
	if (ga !== gb) return ga - gb
	if (ga === 1) return 0
	const ta = timeOf(a)!, tb = timeOf(b)!
	return ga === 0 ? ta - tb : tb - ta
}

export function compareGames(a: Sortable, b: Sortable, sortKey: SortKey, now = Date.now()): number {
	let d = 0
	if (sortKey === 'players_asc')  d = (a.playersCount ?? 0) - (b.playersCount ?? 0)
	if (sortKey === 'players_desc') d = (b.playersCount ?? 0) - (a.playersCount ?? 0)
	if (sortKey === 'likes')        d = (b.likesCount ?? 0) - (a.likesCount ?? 0)
	return d || byDate(a, b, now)
}

/** Within the next `days` days — a game on right now counts */
export function withinDays(g: Sortable, days: number, now = Date.now()): boolean {
	const t = timeOf(g)
	return t !== null && t >= now - GAME_LIVE_MS && t <= now + days * 86_400_000
}
