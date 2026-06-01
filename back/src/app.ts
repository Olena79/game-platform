import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import * as cron from 'node-cron'
import { connectDB } from './config/db'
import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import livekitRoutes from './routes/livekit'
import recordingRoutes from './routes/recordings'
import uploadRoutes from './routes/upload'
import { registerGameRoom } from './socket/gameRoom'
import { registerCommunity } from './socket/community'
import makeCommunityRouter from './routes/community'
import { Recording } from './models/Recording'
import { deleteFile } from './services/googleDrive'

const app = express()
const httpServer = createServer(app)
// Use explicit equality so CORS is closed by default when NODE_ENV is unset or misspelled
const isDev = process.env.NODE_ENV === 'development'

// Trust the first proxy hop (Render, Heroku, Railway all inject X-Forwarded-For).
// Without this, express-rate-limit sees the load-balancer IP and throttles everyone.
app.set('trust proxy', 1)

// ── Auth rate limiter ──────────────────────────────────────────────────────────
// Applied only to /api/auth/login and /api/auth/register to prevent brute-force.
const authLimiter = rateLimit({
	windowMs:         15 * 60 * 1000, // 15 minutes
	max:              100,             // requests per window per IP
	standardHeaders:  true,           // return RateLimit-* headers (RFC 6585)
	legacyHeaders:    false,
	message:          { message: 'Too many requests from this IP, please try again in 15 minutes.' },
})

// JWT_SECRET is validated at startup inside authMiddleware.ts (throws if missing).
// Redundant guard here so this file stays safe even if the import chain ever changes.
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET is not set.')

if (!isDev && !process.env.CLIENT_URL) {
	console.warn('[app] WARN: CLIENT_URL is not set in production — CORS will block all browser requests and email links will point to localhost.')
}

const io = new Server(httpServer, {
	cors: {
		origin: isDev ? true : process.env.CLIENT_URL || 'http://localhost:3000',
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
		origin: isDev ? true : process.env.CLIENT_URL || 'http://localhost:3000',
	}),
)
app.use(express.json())

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Games of Senses API' }))
app.get('/health', (_req, res) => res.status(200).send('OK'))

app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth',      authRoutes)
app.use('/api/upload',    uploadRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/livekit', livekitRoutes)
app.use('/api/recordings', recordingRoutes)
app.use('/api/community', makeCommunityRouter(io))

registerGameRoom(io)
registerCommunity(io)

// Delete expired recordings from Google Drive every 6 hours
cron.schedule('0 */6 * * *', async () => {
	try {
		const expired = await Recording.find({
			expiresAt: { $lte: new Date() },
			status: 'completed',
			driveFileId: { $ne: '' },
		})
		for (const rec of expired) {
			try { await deleteFile(rec.driveFileId) } catch { /* file may already be deleted */ }
			await rec.deleteOne()
		}
		if (expired.length > 0) console.log(`[cron] Cleaned up ${expired.length} expired recording(s)`)
	} catch (err) {
		console.error('[cron] Recording cleanup error:', err)
	}
})

const PORT = process.env.PORT || 5000

connectDB()
	.then(() => {
		httpServer.listen(PORT, () =>
			console.log(`Server running on http://localhost:${PORT}`),
		)
	})
	.catch(err => {
		console.error('MongoDB connection failed:', err)
		process.exit(1)
	})
