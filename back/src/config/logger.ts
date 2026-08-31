import winston from 'winston'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

// Log format with timestamp, level, and context
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json()
)

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
	winston.format.timestamp({ format: 'HH:mm:ss' }),
	winston.format.colorize(),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let metaStr = ''
		if (Object.keys(meta).length > 0) {
			metaStr = ` ${JSON.stringify(meta)}`
		}
		return `${timestamp} [${level}]: ${message}${metaStr}`
	})
)

// Create logger instance
const logger = winston.createLogger({
	level: isDev ? 'debug' : 'info',
	format: logFormat,
	defaultMeta: { service: 'games-of-senses' },
	transports: [
		// Console output (always)
		new winston.transports.Console({
			format: consoleFormat,
		}),
		// Error file
		new winston.transports.File({
			filename: path.join(process.cwd(), 'logs', 'error.log'),
			level: 'error',
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		}),
		// All logs file
		new winston.transports.File({
			filename: path.join(process.cwd(), 'logs', 'combined.log'),
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		}),
	],
})

// In production, also log to file
if (!isDev) {
	logger.add(
		new winston.transports.File({
			filename: path.join(process.cwd(), 'logs', 'app.log'),
			maxsize: 5242880,
			maxFiles: 10,
		})
	)
}

export default logger
