/**
 * A phone with the room in the background keeps its connection but loses
 * camera and microphone; its tile used to hang there. After the away time
 * it is hidden for everyone, and it comes back when the page is in front.
 */
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server } from 'socket.io'
import { io as connect, Socket as ClientSocket } from 'socket.io-client'

const GM = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const PLAYER = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const WATCHER = 'cccccccccccccccccccccccc'

const mockDb = { banned: [] as string[], saved: [] as unknown[] }
process.env.ROOM_AWAY_MS = '300'

jest.mock('../src/models/Game', () => {
	const doc = () => ({
		_id: '64f1a2b3c4d5e6f708192a3b', gameCode: 'PLAY23', spectatorCode: 'WATCH7',
		creatorId: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Test', registeredPlayers: [],
		bannedUserIds: [...mockDb.banned], useCoins: false, useInfluence: false, images: [], scenario: '',
	})
	return {
		Game: {
			findOne: () => {
				const d = doc()
				return { select: () => Promise.resolve(d), then: (ok: any, ko: any) => Promise.resolve(d).then(ok, ko) }
			},
			exists: (q: { bannedUserIds: string }) => Promise.resolve(mockDb.banned.includes(q.bannedUserIds) ? { _id: 'x' } : null),
			updateOne: async (_filter: unknown, update: any) => {
				mockDb.saved.push(update)
				mockDb.banned.push(update.$addToSet.bannedUserIds)
				return { acknowledged: true }
			},
		},
	}
})
jest.mock('../src/models/GameMessage', () => ({
	GameMessage: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) },
}))
jest.mock('../src/models/User', () => ({
	User: { findById: (id: string) => ({ select: () => ({ lean: async () => ({ name: `user-${String(id).slice(0, 2)}` }) }) }) },
}))
const removeParticipant = jest.fn(async () => undefined)
jest.mock('../src/services/livekit', () => ({
	roomNameFor: (gameId: string, breakoutId?: string) => `mindflow-${gameId}${breakoutId ? `-${breakoutId}` : ''}`,
	roomService: { removeParticipant: (...a: unknown[]) => (removeParticipant as any)(...a) },
	muteMicrophones: async () => undefined,
}))
jest.mock('../src/services/recording', () => {
	const { EventEmitter } = require('events')
	return {
		activeRecording: async () => null,
		recordingEvents: new EventEmitter(),
		RecordingError: class extends Error {},
		recordingMode: () => 'browser',
		startEgressRecording: async () => undefined,
		stopRecording: async () => undefined,
	}
})
jest.mock('../src/services/notesDelivery', () => ({ cleanNotes: (s: string) => s, deliverGameNotes: async () => undefined }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerGameRoom } = require('../src/socket/gameRoom')

let http: HttpServer
let url = ''
const clients: ClientSocket[] = []

beforeAll(done => {
	http = createServer()
	const io = new Server(http)
	io.use((socket, next) => { socket.data.userId = socket.handshake.auth.uid; next() })
	registerGameRoom(io)
	http.listen(0, () => { url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`; done() })
})
afterAll(done => {
	clients.forEach(c => c.disconnect())
	http.close(() => done())
})

function join(uid: string, code: string): Promise<{ socket: ClientSocket; state: any }> {
	return new Promise((resolve, reject) => {
		const socket = connect(url, { auth: { uid }, transports: ['websocket'], reconnection: false })
		clients.push(socket)
		socket.once('gr:error', (msg: string) => reject(new Error(msg)))
		socket.once('gr:state', (state: any) => resolve({ socket, state }))
		socket.on('connect', () => socket.emit('gr:join', { gameCode: code }))
	})
}
const nextState = (s: ClientSocket) => new Promise<any>(r => s.once('gr:state', r))
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('a phone with the room in the background', () => {
	it('is hidden after the away time and shown again when back; never the gamemaster', async () => {
		const gm = await join(GM, 'PLAY23')
		const player = await join(PLAYER, 'PLAY23')
		await wait(100)

		const seen = (state: any, id: string) => state.players.find((p: any) => p.userId === id)

		// The gamemaster going to the background changes nothing
		gm.socket.emit('gr:presence', { gameCode: 'PLAY23', away: true })
		player.socket.emit('gr:presence', { gameCode: 'PLAY23', away: true })
		const hidden = await nextState(gm.socket)
		expect(seen(hidden, PLAYER).away).toBe(true)
		expect(seen(hidden, GM).away).toBeFalsy()

		const back = nextState(gm.socket)
		player.socket.emit('gr:presence', { gameCode: 'PLAY23', away: false })
		expect(seen(await back, PLAYER).away).toBe(false)
	})

	it('is not hidden when it comes back before the away time', async () => {
		const player = clients[clients.length - 1]
		const gm = clients[clients.length - 2]
		let hiddenAgain = false
		gm.on('gr:state', (s: any) => { if (s.players.find((p: any) => p.userId === PLAYER)?.away) hiddenAgain = true })
		player.emit('gr:presence', { gameCode: 'PLAY23', away: true })
		await wait(100)
		player.emit('gr:presence', { gameCode: 'PLAY23', away: false })
		await wait(500)
		expect(hiddenAgain).toBe(false)
	})
})
