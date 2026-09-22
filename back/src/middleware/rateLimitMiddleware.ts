import rateLimit from 'express-rate-limit'
import type { Request } from 'express'

/**
 * Password guessing, specifically.
 *
 * The general auth limiter allows 100 requests per quarter hour per IP, which
 * is some 9600 password attempts a day from one address. This one is keyed by
 * the account being guessed at, so a shared NAT does not shield an attacker
 * and does not punish everyone else either.
 */
export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req: Request) => String((req.body?.email ?? '').toLowerCase() || req.ip),
	skipSuccessfulRequests: true,
	message: { message: 'Too many sign-in attempts. Please wait 15 minutes.' },
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

// ─ Recordings Limiter (Recording management)
export const recordingsLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many recording requests, please try again in 15 minutes.' },
})

// ─ General API Limiter (Fallback for any unspecified routes)
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 300,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many API requests, please try again in 15 minutes.' },
})
