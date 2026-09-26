import { webcrypto } from 'crypto'
import {
	checkCode, closeSession, hashPassphrase, issueCode, lockedUntil, MAX_FAILURES,
	openSession, recordFailure, resetAdminAuthState, sessionFor, verifyPassphrase, LOCKOUT_MS,
} from '../src/services/adminAuth'

/**
 * The administrator makes the passphrase hash in their own browser (the
 * snippet in CLAUDE.md), so the server must accept exactly what WebCrypto
 * produces — this is the same computation.
 */
async function browserSnippetHash(phrase: string): Promise<string> {
	const subtle = webcrypto.subtle
	const salt = webcrypto.getRandomValues(new Uint8Array(16))
	const key = await subtle.importKey('raw', new TextEncoder().encode(phrase.normalize('NFC').trim()), 'PBKDF2', false, ['deriveBits'])
	const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, key, 256)
	const b64 = (u: ArrayBuffer | Uint8Array) => Buffer.from(u instanceof Uint8Array ? u : new Uint8Array(u)).toString('base64')
	return `pbkdf2$600000$${b64(salt)}$${b64(bits)}`
}

describe('admin passphrase', () => {
	it('accepts the hash made in a browser', async () => {
		const stored = await browserSnippetHash('червоний кит танцює під дощем 1987')
		expect(await verifyPassphrase('червоний кит танцює під дощем 1987', stored)).toBe(true)
		expect(await verifyPassphrase('  червоний кит танцює під дощем 1987 ', stored)).toBe(true)
		expect(await verifyPassphrase('червоний кит танцює під дощем 1988', stored)).toBe(false)
	})

	it('round-trips its own hash format', async () => {
		const stored = await hashPassphrase('a long phrase', 100_000)
		expect(await verifyPassphrase('a long phrase', stored)).toBe(true)
		expect(await verifyPassphrase('a long phrase.', stored)).toBe(false)
	})

	it('refuses everything when nothing or garbage is configured', async () => {
		expect(await verifyPassphrase('x', undefined)).toBe(false)
		expect(await verifyPassphrase('x', '')).toBe(false)
		expect(await verifyPassphrase('x', 'plain-text-password')).toBe(false)
		expect(await verifyPassphrase('x', 'pbkdf2$10$AAAA$BBBB')).toBe(false)
	})
})

describe('admin code and session', () => {
	beforeEach(() => resetAdminAuthState())

	it('a code works once, for the user it was issued to', () => {
		const code = issueCode('admin')
		expect(checkCode('someone-else', code)).toBe('expired')
		const again = issueCode('admin')
		expect(checkCode('admin', again)).toBe('ok')
		expect(checkCode('admin', again)).toBe('expired')
	})

	it('three wrong tries spend the code', () => {
		const code = issueCode('admin')
		const wrong = code === '000000' ? '111111' : '000000'
		expect(checkCode('admin', wrong)).toBe('wrong')
		expect(checkCode('admin', wrong)).toBe('wrong')
		expect(checkCode('admin', wrong)).toBe('wrong')
		expect(checkCode('admin', code)).toBe('expired')
	})

	it('locks after repeated failures, for an hour', () => {
		const now = Date.now()
		for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure(now)
		expect(lockedUntil(now)).toBeNull()
		recordFailure(now)
		expect(lockedUntil(now)).toBe(now + LOCKOUT_MS)
		expect(lockedUntil(now + LOCKOUT_MS + 1)).toBeNull()
	})

	it('a session belongs to its user and ends on logout', () => {
		const { token } = openSession('admin')
		expect(sessionFor(token, 'admin')).not.toBeNull()
		expect(sessionFor(token, 'intruder')).toBeNull()
		expect(sessionFor('made-up', 'admin')).toBeNull()
		expect(sessionFor(undefined, 'admin')).toBeNull()
		closeSession(token)
		expect(sessionFor(token, 'admin')).toBeNull()
	})
})
