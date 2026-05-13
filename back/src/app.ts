import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import * as cron from 'node-cron'
import { connectDB } from './config/db'
import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import livekitRoutes from './routes/livekit'
import recordingRoutes from './routes/recordings'
import { registerGameRoom } from './socket/gameRoom'
import { registerCommunity } from './socket/community'
import makeCommunityRouter from './routes/community'
import { Recording } from './models/Recording'
import { deleteFile } from './services/googleDrive'

const app = express()
const httpServer = createServer(app)
const isDev = process.env.NODE_ENV !== 'production'

const io = new Server(httpServer, {
	cors: {
		origin: isDev ? true : process.env.CLIENT_URL || 'http://localhost:3000',
		methods: ['GET', 'POST'],
	},
})

app.use(
	cors({
		origin: isDev ? true : process.env.CLIENT_URL || 'http://localhost:3000',
	}),
)
app.use(express.json())

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Games of Senses API' }))
app.get('/health', (_req, res) => res.status(200).send('OK'))

app.use('/api/auth', authRoutes)
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
