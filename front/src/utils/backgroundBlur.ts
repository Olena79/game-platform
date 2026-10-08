import type { LocalVideoTrack } from 'livekit-client'

/**
 * Background blur for one's own camera (LiveKit's track processor: MediaPipe
 * finds the person, the rest is blurred, and the blurred picture is what the
 * room receives — and what the gamemaster's recording shows).
 *
 * Opt-in per device (`gos-bg-blur`), off by default: it works on every frame
 * and a weak phone may stutter. Anything going wrong leaves the plain
 * camera running — the blur is a layer on top of it, never in its way.
 * The library (and its model, from public CDNs) loads only for someone who
 * switched blur on.
 */
const KEY = 'gos-bg-blur'
const NAME = 'gos-background-blur'
const RADIUS = 12

export function blurPreferred(): boolean {
	try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setBlurPreferred(on: boolean): void {
	try {
		if (on) localStorage.setItem(KEY, '1')
		else localStorage.removeItem(KEY)
	} catch { /* private mode: for this visit only */ }
}

/** A phone or tablet: the blur works, with a warning that it may stutter */
export function isTouchDevice(): boolean {
	try { return window.matchMedia('(pointer: coarse)').matches } catch { return false }
}

const load = () => import('@livekit/track-processors')

let supported: Promise<boolean> | null = null
/** Whether this browser can blur at all (old browsers cannot) */
export function blurSupported(): Promise<boolean> {
	supported ??= load().then(m => m.supportsBackgroundProcessors()).catch(() => false)
	return supported
}

/** Blurs the track's background; false if it could not (the camera is untouched) */
export async function applyBlur(track: LocalVideoTrack): Promise<boolean> {
	try {
		if (track.getProcessor()?.name === NAME) return true
		const m = await load()
		if (!m.supportsBackgroundProcessors()) return false
		await track.setProcessor(m.BackgroundProcessor({ mode: 'background-blur', blurRadius: RADIUS }, NAME))
		return true
	} catch (err) {
		console.warn('[blur] could not start', err)
		await track.stopProcessor().catch(() => undefined)
		return false
	}
}

/** Back to the plain camera */
export async function removeBlur(track: LocalVideoTrack): Promise<void> {
	try {
		if (track.getProcessor()) await track.stopProcessor()
	} catch (err) {
		console.warn('[blur] could not stop', err)
	}
}
