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
import helmet from 'helmet'
import * as cron from 'node-cron'
import { connectDB } from './config/db'
import logger from './config/logger'
import { requestLogger } from './middleware/requestLogger'
import { getSentryMiddleware } from './config/sentry'
import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import livekitRoutes from './routes/livekit'
import accountRoutes from './routes/account'
import uploadRoutes from './routes/upload'
import telegramRoutes from './routes/telegram'
import recordingRoutes from './routes/recordings'
import { registerGameRoom } from './socket/gameRoom'
import { registerCommunity } from './socket/community'
import makeCommunityRouter from './routes/community'
import { authenticateAccessToken } from './middleware/authMiddleware'
import { cleanupExpiredRecordings, syncRecordings } from './services/recording'
import { verifyStorageAccess } from './services/storage'
import { startTelegramPolling, stopTelegramPolling } from './services/telegramBot'
import {
	authLimiter,
	gamesLimiter,
	communityLimiter,
	uploadLimiter,
	livekitLimiter,
	recordingsLimiter,
	loginLimiter,
} from './middleware/rateLimitMiddleware'

const app = express()
const httpServer = createServer(app)
// Use explicit equality so CORS is closed by default when NODE_ENV is unset or misspelled
const isDev = process.env.NODE_ENV === 'development'

// Trust the first proxy hop (Render, Heroku, Railway all inject X-Forwarded-For).
// Without this, express-rate-limit sees the load-balancer IP and throttles everyone.
app.set('trust proxy', 1)

// One list for both Express and Socket.IO. They used to be built
// differently: with two domains in CLIENT_URL the API worked and the
// WebSocket did not, which reads as "the room will not open".
const allowedOrigins = isDev
	? ['http://localhost:5173', 'http://localhost:3000']
	: (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(url => url.trim()).filter(Boolean)
logger.info(`CORS configured for: ${allowedOrigins.join(', ')}`, { context: 'app:cors' })

if (!isDev && !process.env.CLIENT_URL) {
	logger.warn('CLIENT_URL is not set in production — CORS will block all browser requests and password reset links will point nowhere', {
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
io.use(async (socket, next) => {
	const token = socket.handshake.auth?.token
	if (!token) {
		// No token — allow connection without an authenticated identity.
		// gr:join will reject if socket.data.userId is not set.
		socket.data.userId = null
		return next()
	}
	// Same check as the REST API: an access token (not a reset link), for an
	// account that still exists and has not reset its password since.
	const userId = typeof token === 'string' ? await authenticateAccessToken(token) : null
	if (!userId) return next(new Error('Authentication error'))
	socket.data.userId = userId
	next()
})

// Security headers. The API serves JSON only, so the defaults fit; the
// frontend's headers are set by its host (see front/vercel.json).
app.use(helmet())
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

// Recordings: closes recordings whose browser went quiet, follows LiveKit
// egress jobs to the end, and deletes files after 7 days.
cron.schedule('* * * * *', () => { void syncRecordings() })
cron.schedule('0 */6 * * *', () => {
	cleanupExpiredRecordings().catch(err => logger.error('Recording cleanup error', { task: 'cron:cleanup', error: err }))
})

const PORT = process.env.PORT || 5000

connectDB()
	.then(() => {
		// Start Telegram bot polling
		startTelegramPolling()

		// Recording storage is only exercised when someone presses "record",
		// so check it at startup — a misconfigured bucket should be found in
		// the deploy log, not in front of the club.
		verifyStorageAccess().then(({ ok, detail }) => {
			if (ok) logger.info(`Recording storage ready — ${detail}`, { context: 'server:startup' })
			else logger.error(`Recording storage NOT usable — recordings will fail: ${detail}`, { context: 'server:startup' })
		})

		// Catch up on whatever finished or expired while the server was down
		void syncRecordings()
		cleanupExpiredRecordings().catch(err => logger.error('Recording cleanup error', { task: 'cron:cleanup', error: err }))

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
