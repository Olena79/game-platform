import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Installing the site as an app.
 *
 * Chromium browsers fire `beforeinstallprompt` when they consider the site
 * installable, and the prompt can only be opened from that saved event —
 * never on our own initiative. Safari fires nothing at all: on an iPhone the
 * only route is Share → Add to Home Screen, so there we offer instructions
 * instead of a button that could not work.
 */
export function useInstallPrompt() {
	const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
	const [installed, setInstalled] = useState(false)

	useEffect(() => {
		const onPrompt = (e: Event) => {
			e.preventDefault()   // keep it for our own button instead of the browser's bar
			setDeferred(e as BeforeInstallPromptEvent)
		}
		const onInstalled = () => { setDeferred(null); setInstalled(true) }

		window.addEventListener('beforeinstallprompt', onPrompt)
		window.addEventListener('appinstalled', onInstalled)
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt)
			window.removeEventListener('appinstalled', onInstalled)
		}
	}, [])

	const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
	const isIOS = /iPhone|iPad|iPod/i.test(ua)
		|| (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
	const isMobile = isIOS || /Android|webOS|BlackBerry|Windows Phone/i.test(ua)

	const isStandalone = typeof window !== 'undefined' && (
		(navigator as { standalone?: boolean }).standalone === true
		|| window.matchMedia('(display-mode: standalone)').matches
	)

	const promptInstall = async (): Promise<boolean> => {
		if (!deferred) return false
		await deferred.prompt()
		const { outcome } = await deferred.userChoice
		setDeferred(null)          // the saved event is single-use
		return outcome === 'accepted'
	}

	return {
		/** The browser will open a real install dialog */
		canInstall: Boolean(deferred) && !installed && !isStandalone,
		/** No dialog exists here; show the manual steps */
		needsManualSteps: isIOS && !isStandalone,
		isMobile,
		isStandalone: isStandalone || installed,
		promptInstall,
	}
}
