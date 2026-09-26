/**
 * Why the camera would not start, in terms a person can act on.
 *
 * The browser does not ask again once it has an answer, and Windows or the
 * laptop itself can hold the camera back without the browser asking anyone.
 * The room used to swallow the error — a camera button that simply did
 * nothing (2026-09-27, a Windows laptop in Chrome: microphone fine, camera
 * dead, no question shown).
 */
export type CameraProblem = 'blocked' | 'system' | 'busy' | 'missing' | 'other'

export function cameraProblem(err: unknown): CameraProblem {
	const e = err as { name?: string; message?: string } | null
	const name = e?.name ?? ''
	const message = e?.message ?? ''
	if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
		// Chrome: "Permission denied by system" when the OS holds it back
		return /system/i.test(message) ? 'system' : 'blocked'
	}
	if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
	if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'missing'
	return 'other'
}

/** Translation key for the explanation, under `room.camera_err.*` */
export function cameraProblemKey(err: unknown): string {
	return `room.camera_err.${cameraProblem(err)}`
}
