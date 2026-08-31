import { useCallback } from 'react'
import * as Sentry from '@sentry/react'

interface ErrorHandlerOptions {
	onError?: (error: Error) => void
	logToConsole?: boolean
	showAlert?: boolean
	captureToSentry?: boolean
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
	const { onError, logToConsole = true, showAlert = false, captureToSentry = true } = options

	return useCallback(
		async <T,>(asyncFn: () => Promise<T>, errorContext?: string): Promise<T | null> => {
			try {
				return await asyncFn()
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))

				if (logToConsole) {
					console.error(`[${errorContext || 'Error'}]`, err)
				}

				if (captureToSentry) {
					Sentry.captureException(err, {
						contexts: {
							handler: {
								context: errorContext || 'async error',
							},
						},
					})
				}

				if (showAlert) {
					alert(`Error: ${err.message}`)
				}

				if (onError) {
					onError(err)
				}

				return null
			}
		},
		[onError, logToConsole, showAlert, captureToSentry],
	)
}
