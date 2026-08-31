import morgan from 'morgan'
import logger from '../config/logger'

// Custom Morgan token for timestamp
morgan.token('timestamp', () => {
	return new Date().toISOString()
})

// Custom Morgan token for user ID (will be extracted from JWT if available)
morgan.token('user-id', (req: any) => {
	return req.userId || 'anonymous'
})

// Custom Morgan token for response time in ms
morgan.token('response-time-ms', (req: any, res: any) => {
	if (!res._header) return 'N/A'
	const start = (req._startTime as number) || Date.now()
	const duration = Date.now() - start
	return `${duration}ms`
})

// Stream for Morgan to use Winston
const stream = {
	write: (message: string) => {
		// Remove trailing newline that Morgan adds
		const trimmedMessage = message.trim()
		// Only log if message is not empty
		if (trimmedMessage) {
			logger.info(trimmedMessage)
		}
	},
}

// Create Morgan middleware with custom format
// Format: timestamp [HTTP_METHOD] path HTTP/1.1 STATUS DURATION userId
export const requestLogger = morgan(
	':timestamp :method :url HTTP/:http-version :status :response-time-ms [:user-id]',
	{
		stream,
		// Skip health checks and status endpoints (too noisy)
		skip: (req: any) => {
			const path = req.path
			return path === '/health' || path === '/'
		},
	}
)

export default requestLogger
