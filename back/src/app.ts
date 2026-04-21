import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { connectDB } from './config/db'
import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import livekitRoutes from './routes/livekit'
import { registerGameRoom } from './socket/gameRoom'

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

app.get('/', (_req, res) => res.json({ status: 'ok', message: 'MindFlow API' }))

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/livekit', livekitRoutes)

app.use(
	require('cors')({
		origin: '*',
	}),
)

registerGameRoom(io)

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
