import { Socket } from 'socket.io'
import { ZodSchema } from 'zod'
import logger from '../config/logger'

type EventHandler<T = any> = (data: T) => void | Promise<void>

export function validateSocketEvent<T>(schema: ZodSchema, handler: EventHandler<T>) {
	return async (data: any) => {
		try {
			const validated = schema.parse(data)
			await handler(validated as T)
		} catch (error: any) {
			logger.error('[socket validation]', error.errors || error.message)
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
