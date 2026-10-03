/**
 * A countdown as people read it: 05:00, 59:59 — and from an hour up
 * 1:59:30, so a two-hour game timer is 2:00:00, not "120:00".
 */
export function formatClock(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds))
	const h = Math.floor(s / 3600)
	const m = Math.floor((s % 3600) / 60)
	const sec = s % 60
	const mm = String(m).padStart(2, '0')
	const ss = String(sec).padStart(2, '0')
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Seconds as hours, minutes and seconds — for the timer fields */
export function splitSeconds(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
	const s = Math.max(0, Math.floor(totalSeconds))
	return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}
