import { useCallback, useEffect } from 'react'

/**
 * Immersive mode for the game room.
 *
 * Two separate things happen here:
 *
 * 1. Scroll lock (`body.room-immersive`, see index.css) — stops the page from
 *    rubber-banding / pull-to-refresh, which on mobile is what lets the browser
 *    chrome slide back in and pushes the layout out of the visible viewport.
 *
 * 2. Fullscreen — the only way to hide the URL bar and the Android navigation
 *    bar. The Fullscreen API requires a user gesture, so it can't be called
 *    from an effect: `requestImmersive()` must run inside a click/touch
 *    handler. iOS Safari has no Fullscreen API for non-video elements; there
 *    the layout simply relies on 100dvh and stays correct with the bars shown.
 */

const isHandheld = () =>
	/iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent)

const fullscreenElement = () =>
	document.fullscreenElement ?? (document as any).webkitFullscreenElement ?? null

async function enterFullscreen() {
	const el = document.documentElement as any
	try {
		if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
		else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
	} catch {
		/* denied (iOS, permissions policy) — layout still fits via 100dvh */
	}
}

function exitFullscreen() {
	try {
		if (document.exitFullscreen && document.fullscreenElement) void document.exitFullscreen()
		else if ((document as any).webkitExitFullscreen && (document as any).webkitFullscreenElement)
			(document as any).webkitExitFullscreen()
	} catch {
		/* ignore */
	}
}

export function useImmersiveMode(enabled: boolean) {
	// Scroll lock while the room is mounted
	useEffect(() => {
		if (!enabled) return
		document.body.classList.add('room-immersive')
		return () => { document.body.classList.remove('room-immersive') }
	}, [enabled])

	// Leave fullscreen when the room unmounts
	useEffect(() => {
		if (!enabled) return
		return () => { if (isHandheld()) exitFullscreen() }
	}, [enabled])

	// Fallback: the join click may be denied (some browsers only honour
	// fullscreen from a trusted tap on the element itself), so retry once on
	// the first tap inside the room. Stops retrying as soon as fullscreen has
	// been active once — leaving it after that is the user's own choice.
	useEffect(() => {
		if (!enabled || !isHandheld()) return
		let done = fullscreenElement() !== null
		const onFsChange = () => { if (fullscreenElement()) done = true }
		const onGesture = () => {
			if (done) return
			done = true
			void enterFullscreen()
		}
		document.addEventListener('fullscreenchange', onFsChange)
		document.addEventListener('webkitfullscreenchange', onFsChange)
		document.addEventListener('touchend', onGesture, { once: false })
		return () => {
			document.removeEventListener('fullscreenchange', onFsChange)
			document.removeEventListener('webkitfullscreenchange', onFsChange)
			document.removeEventListener('touchend', onGesture)
		}
	}, [enabled])

	/** Call from inside a click handler — needs an active user gesture. */
	return useCallback(() => {
		if (isHandheld()) void enterFullscreen()
	}, [])
}
