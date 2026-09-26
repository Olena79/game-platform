import { lazy, ComponentType } from 'react'

const RELOAD_KEY = 'gos-reloaded-for-new-version'

/** "Failed to fetch dynamically imported module" and its cousins in other browsers */
export function isStaleChunkError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err ?? '')
	return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed/i.test(msg)
}

/**
 * Reloads the page once to pick up a new deploy. A tab opened before the
 * site was redeployed still asks for the old page files, which no longer
 * exist; reloading gets the new ones. Guarded so a real outage cannot loop.
 */
export function reloadForNewVersion(): boolean {
	try {
		const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
		if (Date.now() - last < 30_000) return false
		sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
	} catch { /* no storage: reload anyway, once per page load */ }
	window.location.reload()
	return true
}

/** React.lazy for a named page export, surviving a redeploy under an open tab. */
export function lazyPage<T extends Record<string, unknown>, K extends keyof T>(load: () => Promise<T>, name: K) {
	return lazy(() => load().then(
		m => {
			// Vite's own handler (main.tsx) has already started a reload and
			// resolved the import empty: wait for the page to go
			if (!m) return new Promise<never>(() => undefined)
			return { default: m[name] as unknown as ComponentType }
		},
		err => {
			// While the reload happens, render nothing rather than an error
			if (isStaleChunkError(err) && reloadForNewVersion()) return new Promise<never>(() => undefined)
			throw err
		},
	))
}
