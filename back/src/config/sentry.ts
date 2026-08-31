import logger from '../config/logger'
import * as Sentry from '@sentry/node'

const isDev = process.env.NODE_ENV === 'development'
const SENTRY_DSN = process.env.SENTRY_DSN_BACKEND

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Should be called at the very start of app initialization, before any other code.
 */
export function initializeSentry() {
	if (!SENTRY_DSN && !isDev) {
		logger.warn('[sentry] WARN: SENTRY_DSN_BACKEND not set in production')
		return false
	}

	if (!SENTRY_DSN) {
		logger.info('[sentry] Sentry disabled (no DSN provided or in development)')
		return false
	}

	Sentry.init({
		dsn: SENTRY_DSN,
		environment: process.env.NODE_ENV || 'development',
		tracesSampleRate: isDev ? 1.0 : 0.1, // 10% in production for performance monitoring
		debug: isDev,
		integrations: [
			// Default integrations
			new Sentry.Integrations.Http({ tracing: true }),
			new Sentry.Integrations.OnUncaughtException(),
			new Sentry.Integrations.OnUnhandledRejection(),
		],
		// Attach stack traces to all messages
		attachStacktrace: true,
		// Always capture breadcrumbs for better context
		maxBreadcrumbs: 50,
	})

	logger.info('[sentry] Sentry initialized successfully')
	return true
}

/**
 * Create Sentry middleware for Express.
 * Should be applied AFTER other middleware but BEFORE route handlers.
 */
export function getSentryMiddleware() {
	return [
		Sentry.Handlers.requestHandler(),
		Sentry.Handlers.errorHandler({
			shouldHandleError(error) {
				// Capture all errors except client 400 errors
				if (error.status === 400) return false
				return true
			},
		}),
	]
}

/**
 * Capture exception manually (useful for try-catch blocks).
 */
export function captureException(error: Error, context?: Record<string, any>) {
	Sentry.captureException(error, {
		contexts: {
			app: context || {},
		},
	})
}

/**
 * Capture message (for non-error events).
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
	Sentry.captureMessage(message, level)
}

/**
 * Add breadcrumb for tracking request flow.
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
	Sentry.addBreadcrumb({
		message,
		level: 'info',
		data,
	})
}

export default Sentry
