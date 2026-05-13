import { Server, Socket } from 'socket.io'

export function registerCommunity(io: Server) {
	io.on('connection', (socket: Socket) => {
		socket.on('com:join',  () => socket.join('room:community'))
		socket.on('com:leave', () => socket.leave('room:community'))
	})
}
