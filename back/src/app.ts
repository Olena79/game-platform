import 'dotenv/config'
import { initializeSentry } from './config/sentry'

// Initialize Sentry FIRST, before any other code
initializeSentry()

// Add global error handlers for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
	const logger = require('./config/logger').default
	logger.error('Unhandled Rejection', {
		reason: reason instanceof Error ? reason.message : String(reason),
		stack: reason instanceof Error ? reason.stack : undefined,
		promise: String(promise),
	})
})

// Add handler for uncaught exceptions
process.on('uncaughtException', (error) => {
	const logger = require('./config/logger').default
	logger.error('Uncaught Exception', {
		message: error.message,
		stack: error.stack,
	})
	// Exit gracefully to let process manager restart
	process.exit(1)
})

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import * as cron from 'node-cron'
import { connectDB } from './config/db'
import logger from './config/logger'
import { requestLogger } from './middleware/requestLogger'
import { getSentryMiddleware } from './config/sentry'
import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import livekitRoutes from './routes/livekit'
import recordingRoutes, { finalizeStaleUploads } from './routes/recordings'
import accountRoutes from './routes/account'
import uploadRoutes from './routes/upload'
import telegramRoutes from './routes/telegram'
import { registerGameRoom } from './socket/gameRoom'
import { registerCommunity } from './socket/community'
import makeCommunityRouter from './routes/community'
import { Recording } from './models/Recording'
import { deleteFile, verifyDriveAccess } from './services/googleDrive'
import { startTelegramPolling, stopTelegramPolling } from './services/telegramBot'
import {
	authLimiter,
	gamesLimiter,
	communityLimiter,
	uploadLimiter,
	livekitLimiter,
	recordingsLimiter,
	loginLimiter,
	apiLimiter,
} from './middleware/rateLimitMiddleware'

const app = express()
const httpServer = createServer(app)
// Use explicit equality so CORS is closed by default when NODE_ENV is unset or misspelled
const isDev = process.env.NODE_ENV === 'development'

// Trust the first proxy hop (Render, Heroku, Railway all inject X-Forwarded-For).
// Without this, express-rate-limit sees the load-balancer IP and throttles everyone.
app.set('trust proxy', 1)

// JWT_SECRET is validated at startup inside authMiddleware.ts (throws if missing).
// Redundant guard here so this file stays safe even if the import chain ever changes.
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET is not set.')

// One list for both Express and Socket.IO. They used to be built
// differently: with two domains in CLIENT_URL the API worked and the
// WebSocket did not, which reads as "the room will not open".
const allowedOrigins = isDev
	? ['http://localhost:5173', 'http://localhost:3000']
	: (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(url => url.trim()).filter(Boolean)
logger.info(`CORS configured for: ${allowedOrigins.join(', ')}`, { context: 'app:cors' })

if (!isDev && !process.env.CLIENT_URL) {
	logger.warn('CLIENT_URL is not set in production — CORS will block all browser requests and email links will point to localhost', {
		context: 'app:startup',
	})
}

const io = new Server(httpServer, {
	cors: {
		origin: isDev ? true : allowedOrigins,
		credentials: true,
		methods: ['GET', 'POST'],
	},
})

// ── Socket.IO auth middleware (runs on every handshake) ────────────────────────
// Strategy: optional token — lets unauthenticated browsers connect (needed for
// the community feed which is publicly readable), but rejects connections that
// send an explicitly invalid/expired token. Game room events enforce userId
// separately via socket.data.userId (see gameRoom.ts / gr:join).
io.use((socket, next) => {
	const token = socket.handshake.auth?.token as string | undefined
	if (!token) {
		// No token — allow connection without an authenticated identity.
		// gr:join will reject if socket.data.userId is not set.
		socket.data.userId = null
		return next()
	}
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as { id: string }
		socket.data.userId = decoded.id
		next()
	} catch {
		// Explicitly forged or expired token → reject the handshake immediately.
		next(new Error('Authentication error'))
	}
})

app.use(
	cors({
		origin: isDev ? true : allowedOrigins,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
		maxAge: 86400,
	}),
)
app.use(express.json())
app.use(requestLogger)

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Games of Senses API' }))
app.get('/health', (_req, res) => res.status(200).send('OK'))

// ── Rate limiting by API section ──────────────────────────────────────────────
// Each endpoint is limited based on its resource cost and use frequency
app.use('/api/auth/login',  loginLimiter)
app.use('/api/auth',        authLimiter, authRoutes)
app.use('/api/telegram',    telegramRoutes)
app.use('/api/account',     authLimiter, accountRoutes)
app.use('/api/upload',      uploadLimiter, uploadRoutes)
app.use('/api/games',       gamesLimiter, gameRoutes)
app.use('/api/livekit',     livekitLimiter, livekitRoutes)
app.use('/api/recordings',  recordingsLimiter, recordingRoutes)
app.use('/api/community',   communityLimiter, makeCommunityRouter(io))

registerGameRoom(io)
registerCommunity(io)

// ── Sentry error handler (must be after all other middleware and routes) ───────
app.use(getSentryMiddleware()[1])

// Delete expired recordings from Google Drive every 6 hours.
// Recordings expire 7 days after they start (set in routes/recordings.ts).
const cleanupExpiredRecordings = async () => {
	try {
		const expired = await Recording.find({ expiresAt: { $lte: new Date() } })
		let removed = 0
		let kept = 0
		for (const rec of expired) {
			if (rec.driveFileId) {
				try {
					await deleteFile(rec.driveFileId)
				} catch (err) {
					// Drive still holds the file: keep the row so the next run
					// retries instead of leaking an orphaned video forever.
					kept++
					logger.warn('Could not delete recording from Drive', {
						task: 'cron:cleanup',
						recordingId: String(rec._id),
						error: err instanceof Error ? err.message : String(err),
					})
					continue
				}
			}
			// Rows with no file (upload never finished) just go
			await rec.deleteOne()
			removed++
		}
		if (removed > 0 || kept > 0) {
			logger.info(`Cleaned up ${removed} expired recording(s), ${kept} retained for retry`, { task: 'cron:cleanup' })
		}
	} catch (err) {
		logger.error('Recording cleanup error', { task: 'cron:cleanup', error: err })
	}
}

cron.schedule('0 */6 * * *', cleanupExpiredRecordings)

// Close recordings whose observer window disappeared, so the part that did
// reach Drive becomes a playable file instead of an unfinished upload session.
cron.schedule('*/2 * * * *', () => { void finalizeStaleUploads() })


const PORT = process.env.PORT || 5000

connectDB()
	.then(() => {
		// Start Telegram bot polling
		startTelegramPolling()

		// Recording storage is only exercised when a game ends, so check it at
		// startup — a misconfigured Drive should not be discovered by losing a game.
		verifyDriveAccess().then(({ ok, detail }) => {
			if (ok) logger.info(`Google Drive ready — ${detail}`, { context: 'server:startup' })
			else logger.error(`Google Drive NOT usable — recordings will fail to save: ${detail}`, { context: 'server:startup' })
		})

		// Clear anything that expired while the server was down
		cleanupExpiredRecordings()

		httpServer.listen(PORT, () => {
			logger.info(`Server running on http://localhost:${PORT}`, { context: 'server:startup', port: PORT })
		})
	})
	.catch(err => {
		logger.error('MongoDB connection failed', { context: 'database:connection', error: err })
		process.exit(1)
	})

// Graceful shutdown handlers — stop Telegram polling before exit
const handleShutdown = (signal: string) => {
	logger.info(`Received ${signal}, shutting down gracefully...`, { context: 'shutdown' })
	stopTelegramPolling()

	httpServer.close(() => {
		logger.info('Server closed', { context: 'shutdown' })
		process.exit(0)
	})

	// Force exit after 10 seconds if graceful shutdown hangs
	setTimeout(() => {
		logger.error('Graceful shutdown timeout exceeded, forcing exit', { context: 'shutdown' })
		process.exit(1)
	}, 10000)
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))
