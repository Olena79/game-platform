import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'

/**
 * Password guessing, specifically.
 *
 * The general auth limiter allows 100 requests per quarter hour per IP, which
 * is some 9600 password attempts a day from one address. This one is keyed by
 * the account being guessed at *and* the address guessing: keyed by the
 * account alone, ten wrong attempts from anywhere locked the real owner out
 * for a quarter of an hour.
 */
function emailKey(req: Request): string {
	return String(req.body?.email ?? '').trim().toLowerCase()
}

export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	// The helper matters: an IPv6 client owns a whole subnet and would
	// otherwise get a fresh bucket per request.
	keyGenerator: (req: Request) => `${emailKey(req)}|${ipKeyGenerator(req.ip ?? '')}`,
	skipSuccessfulRequests: true,
	message: { message: 'Too many sign-in attempts. Please wait 15 minutes.' },
})

/**
 * Reset links go to the account owner's Telegram. Without a per-address cap,
 * anyone could fill a stranger's chat with them.
 */
export const forgotPasswordLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 3,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req: Request) => emailKey(req) || ipKeyGenerator(req.ip ?? ''),
	// Same answer as a real request, so the limit says nothing about the account
	handler: (_req, res) => { res.json({ ok: true }) },
})

// ─ Auth Limiter (Already in use)
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many auth requests, please try again in 15 minutes.' },
})

// ─ Games API Limiter (Browse, create, edit games)
export const gamesLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 500,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many game requests, please try again in 15 minutes.' },
})

// ─ Community Limiter (Posts, comments, likes)
export const communityLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 500,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many community requests, please try again in 15 minutes.' },
})

// ─ Upload Limiter (Expensive operation — Cloudinary)
export const uploadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 50,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many upload requests, please try again in 15 minutes.' },
})

// ─ LiveKit Limiter (Token generation)
export const livekitLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many LiveKit token requests, please try again in 15 minutes.' },
})
