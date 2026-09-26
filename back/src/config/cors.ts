import type { CorsOptions } from 'cors'

/**
 * Every request header the site sends to the API. The browser checks this
 * list before any cross-origin request that carries a header of its own —
 * a header missing here makes the request fail without ever reaching the
 * server. That is how recordings died after a few minutes of retrying:
 * the recorder sent `X-Final` and this list did not allow it.
 */
export const ALLOWED_REQUEST_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Final']

export function corsOptions(origin: CorsOptions['origin']): CorsOptions {
	return {
		origin,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowedHeaders: ALLOWED_REQUEST_HEADERS,
		maxAge: 86400,
	}
}
