import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

// Загружаем переменные из .env
dotenv.config()

const app = express()
const httpServer = createServer(app)

// Настройка Socket.io
const io = new Server(httpServer, {
	cors: {
		origin: 'http://localhost:3000',
		methods: ['GET', 'POST'],
	},
})

// Middleware
app.use(cors())
app.use(express.json())

// Базовый маршрут для проверки
app.get('/', (req, res) => {
	res.send('Сервер Game Forge работает!')
})

// Логика Socket.io (живое общение)
io.on('connection', socket => {
	console.log(`Пользователь подключился: ${socket.id}`)

	// Когда кто-то заходит в комнату по коду игры
	socket.on('join_room', gameCode => {
		socket.join(gameCode)
		console.log(`Игрок вошел в игру: ${gameCode}`)
	})

	// Передача действий (движение карт, кубиков и т.д.)
	socket.on('send_move', data => {
		// Рассылаем всем в этой же комнате
		socket.to(data.gameCode).emit('receive_move', data)
	})

	socket.on('disconnect', () => {
		console.log('Пользователь отключился')
	})
})

// Подключение к MongoDB
/*
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/game_forge";
mongoose.connect(MONGO_URI)
  .then(() => console.log("🔥 База данных MongoDB подключена"))
  .catch((err) => console.error("❌ Ошибка БД:", err));
*/

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
	console.log(`🚀 Сервер запущен на http://localhost:${PORT}`)
})
