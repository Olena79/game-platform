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
	// Console only in production: the hosting platform collects stdout, while
	// files sit on a disk that is thrown away at every deploy and restart —
	// they cannot be read back and consume space in the meantime.
	transports: [
		new winston.transports.Console({
			format: consoleFormat,
		}),
		...(isDev
			? [
				new winston.transports.File({
					filename: path.join(process.cwd(), 'logs', 'error.log'),
					level: 'error',
					maxsize: 5242880,
					maxFiles: 5,
				}),
				new winston.transports.File({
					filename: path.join(process.cwd(), 'logs', 'combined.log'),
					maxsize: 5242880,
					maxFiles: 5,
				}),
			]
			: []),
	],
})

export default logger
