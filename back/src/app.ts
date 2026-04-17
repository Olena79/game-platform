import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db'
import authRoutes from './routes/auth'

dotenv.config()

const app = express()
const httpServer = createServer(app)

const isDev = process.env.NODE_ENV !== 'production'

const io = new Server(httpServer, {
	cors: {
		origin: isDev ? true : process.env.CLIENT_URL,
		methods: ['GET', 'POST'],
	},
})

app.use(cors({ origin: isDev ? true : process.env.CLIENT_URL }))
app.use(express.json())

app.get('/', (_req, res) => {
	res.json({ status: 'ok', message: 'MindFlow API is running' })
})

app.use('/api/auth', authRoutes)

io.on('connection', socket => {
	console.log(`Connected: ${socket.id}`)

	socket.on('join_room', (gameCode: string) => {
		socket.join(gameCode)
		console.log(`Player joined room: ${gameCode}`)
	})

	socket.on('send_move', (data: { gameCode: string }) => {
		socket.to(data.gameCode).emit('receive_move', data)
	})

	socket.on('disconnect', () => {
		console.log(`Disconnected: ${socket.id}`)
	})
})

const PORT = process.env.PORT || 5000

connectDB()
	.then(() => {
		httpServer.listen(PORT, () => {
			console.log(`Server running on http://localhost:${PORT}`)
		})
	})
	.catch(err => {
		console.error('Failed to connect to MongoDB:', err)
		process.exit(1)
	})
