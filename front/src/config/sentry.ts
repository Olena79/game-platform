import * as Sentry from '@sentry/react'

const isDev = import.meta.env.MODE === 'development'
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN_FRONTEND

/**
 * Initialize Sentry for error tracking on frontend.
 * Should be called in main.tsx before rendering the app.
 */
export function initializeSentry() {

	if (!SENTRY_DSN) {
		return false
	}

	Sentry.init({
		dsn: SENTRY_DSN,
		environment: import.meta.env.MODE || 'development',
		tracesSampleRate: isDev ? 1.0 : 0.1, // 10% in production for performance monitoring
		debug: isDev,
		integrations: [
			new Sentry.Replay({
				maskAllText: true,
				blockAllMedia: true,
			}),
		],
		// Capture replays for error and performance monitoring
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
		// Attach stack traces to all events
		attachStacktrace: true,
		// Breadcrumbs
		maxBreadcrumbs: 50,
	})

	return true
}

/**
 * Capture exception manually.
 */
export function captureException(error: Error, context?: Record<string, any>) {
	Sentry.captureException(error, {
		contexts: {
			app: context || {},
		},
	})
}

/**
 * Capture message.
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
	Sentry.captureMessage(message, level)
}

/**
 * Add breadcrumb.
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
	Sentry.addBreadcrumb({
		message,
		level: 'info',
		data,
	})
}

/**
 * Set user context for error tracking.
 */
export function setUserContext(userId: string, email?: string, name?: string) {
	Sentry.setUser({
		id: userId,
		email,
		username: name,
	})
}

/**
 * Clear user context on logout.
 */
export function clearUserContext() {
	Sentry.setUser(null)
}

export default Sentry
