/**
 * Raised hands are numbered by when they went up, within their own room,
 * so everyone sees whose turn comes first.
 */
jest.mock('../src/models/Game', () => ({ Game: {} }))
jest.mock('../src/models/GameMessage', () => ({ GameMessage: {} }))
jest.mock('../src/models/User', () => ({ User: {} }))
jest.mock('../src/services/livekit', () => ({ roomNameFor: () => '', roomService: {}, muteMicrophones: async () => undefined }))
jest.mock('../src/services/recording', () => {
	const { EventEmitter } = require('events')
	return { activeRecording: async () => null, recordingEvents: new EventEmitter(), RecordingError: class extends Error {}, recordingMode: () => 'browser', startEgressRecording: async () => undefined, stopRecording: async () => undefined }
})
jest.mock('../src/services/notesDelivery', () => ({ cleanNotes: (s: string) => s, deliverGameNotes: async () => undefined }))

import { withHandQueue } from '../src/socket/gameRoom'

const p = (userId: string, handRaisedAt: number | null, breakoutRoomId: string | null = null) =>
	({ userId, handRaised: handRaisedAt !== null, handRaisedAt, breakoutRoomId })

describe('hand queue', () => {
	it('numbers raised hands by when they went up', () => {
		const out = withHandQueue([p('a', 300), p('b', 100), p('c', null), p('d', 200)])
		const place = Object.fromEntries(out.map(x => [x.userId, x.handQueue]))
		expect(place).toEqual({ b: 1, d: 2, a: 3, c: null })
	})

	it('moves everyone up when the first hand goes down', () => {
		const out = withHandQueue([p('a', 300), p('b', null), p('d', 200)])
		expect(Object.fromEntries(out.map(x => [x.userId, x.handQueue]))).toEqual({ a: 2, b: null, d: 1 })
	})

	it('counts each breakout room on its own', () => {
		const out = withHandQueue([p('a', 100), p('b', 200, 'room1'), p('c', 300, 'room1'), p('d', 400)])
		expect(Object.fromEntries(out.map(x => [x.userId, x.handQueue]))).toEqual({ a: 1, b: 1, c: 2, d: 2 })
	})
})
