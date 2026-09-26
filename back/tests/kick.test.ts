/**
 * The gamemaster removing someone for good, through a real Socket.IO room.
 *
 * The database is a stand-in; everything else — the room, resolveSeat, the
 * event validation — is the real code. What is pinned: only the gamemaster
 * can do it, the gamemaster cannot be removed, the removed person is told,
 * disconnected and gone from the roster, the others stay, and neither code
 * lets the removed person back in.
 */
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server } from 'socket.io'
import { io as connect, Socket as ClientSocket } from 'socket.io-client'

const GM = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const PLAYER = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const WATCHER = 'cccccccccccccccccccccccc'

const mockDb = { banned: [] as string[], saved: [] as unknown[] }

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

import { registerGameRoom } from '../src/socket/gameRoom'

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

describe('removing someone from the game', () => {
	it('works end to end, for the gamemaster only, and for good', async () => {
		const gm = await join(GM, 'PLAY23')
		const player = await join(PLAYER, 'PLAY23')
		const watcher = await join(WATCHER, 'WATCH7')
		await wait(100)

		// A player cannot remove anyone
		player.socket.emit('gr:kick', { gameCode: 'PLAY23', targetUserId: WATCHER })
		// Nor can the gamemaster remove themselves
		gm.socket.emit('gr:kick', { gameCode: 'PLAY23', targetUserId: GM })
		await wait(200)
		expect(mockDb.saved).toHaveLength(0)

		const told = new Promise<void>(r => watcher.socket.once('gr:kicked', () => r()))
		const closed = new Promise<void>(r => watcher.socket.once('disconnect', () => r()))
		const gmSees = nextState(gm.socket)
		gm.socket.emit('gr:kick', { gameCode: 'PLAY23', targetUserId: WATCHER })
		await told
		await closed
		const after = await gmSees

		// Saved on the game: banned, and registrations as player and spectator dropped
		expect(mockDb.saved).toHaveLength(1)
		expect(mockDb.saved[0]).toMatchObject({
			$addToSet: { bannedUserIds: WATCHER },
			$pull: { registeredPlayers: { userId: WATCHER }, spectators: { userId: WATCHER } },
		})
		// Gone from the roster; the others are still there
		const ids = after.players.map((p: any) => p.userId)
		expect(ids).not.toContain(WATCHER)
		expect(ids).toEqual(expect.arrayContaining([GM, PLAYER]))
		// Out of the video room too
		expect(removeParticipant).toHaveBeenCalledWith('mindflow-64f1a2b3c4d5e6f708192a3b', WATCHER)

		// No way back: neither the spectator code nor the player code
		await expect(join(WATCHER, 'WATCH7')).rejects.toThrow('REMOVED')
		await expect(join(WATCHER, 'PLAY23')).rejects.toThrow('REMOVED')
		// The player who stayed can still act in the room
		expect(player.socket.connected).toBe(true)
	})
})
