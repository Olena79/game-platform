import { Socket } from 'socket.io'
import { ZodSchema } from 'zod'
import logger from '../config/logger'

type EventHandler<T = any> = (data: T) => void | Promise<void>

/**
 * Rejected events used to vanish into the log while the client went on
 * believing it had acted — that is how a gamemaster could never clear a
 * shown picture. With a socket passed in, the sender hears about it.
 */
/**
 * How many events one socket may send per second before the rest are ignored.
 *
 * gr:react broadcasts twice to the whole room and gr:chat writes to the
 * database, so a client in a loop could flatten a game for everyone in it.
 */
const EVENTS_PER_SECOND = 20
const rates = new WeakMap<Socket, { count: number; windowStart: number }>()

function withinRate(socket: Socket): boolean {
	const now = Date.now()
	const entry = rates.get(socket)
	if (!entry || now - entry.windowStart > 1000) {
		rates.set(socket, { count: 1, windowStart: now })
		return true
	}
	entry.count += 1
	return entry.count <= EVENTS_PER_SECOND
}

export function validateSocketEvent<T>(schema: ZodSchema, handler: EventHandler<T>, socket?: Socket) {
	return async (data: any) => {
		if (socket && !withinRate(socket)) {
			logger.warn('[socket] event rate exceeded', { socketId: socket.id })
			return
		}
		try {
			const validated = schema.parse(data)
			await handler(validated as T)
		} catch (error: any) {
			// Zod 4 exposes `issues`; `errors` is left for older throwers
			const issues = error?.issues ?? error?.errors
			logger.error('[socket validation]', { issues: issues ?? error?.message })
			// gr:error means "this room is unusable"; a rejected command is not that
			socket?.emit('gr:action-error', issues?.[0]?.message ?? 'Invalid payload')
		}
	}
}

export function validateSocketEventWithSocket<T>(schema: ZodSchema, handler: (socket: Socket, data: T) => void | Promise<void>) {
	return (socket: Socket) => {
		return async (data: any) => {
			try {
				const validated = schema.parse(data)
				await handler(socket, validated as T)
			} catch (error: any) {
				logger.error('[socket validation]', error.errors || error.message)
				socket.emit('gr:error', 'Invalid payload')
			}
		}
	}
}
