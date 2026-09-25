import jwt from 'jsonwebtoken'
import {
	generateAccessToken,
	generateRefreshTokenString,
	verifyAccessToken,
	generatePasswordResetToken,
	verifyPasswordResetToken,
} from '../src/services/tokenService'

const USER_ID = '507f1f77bcf86cd799439011'

describe('Token Service', () => {
	describe('generateAccessToken', () => {
		it('should generate a valid JWT', () => {
			const token = generateAccessToken(USER_ID)
			expect(typeof token).toBe('string')
			expect(token.split('.').length).toBe(3) // JWT format: header.payload.signature
		})

		it('should include userId and token version', () => {
			const decoded = verifyAccessToken(generateAccessToken(USER_ID, 3))
			expect(decoded.id).toBe(USER_ID)
			expect(decoded.tv).toBe(3)
		})

		it('should have expiry date', () => {
			const decoded = verifyAccessToken(generateAccessToken(USER_ID))
			expect(decoded.exp).toBeDefined()
			expect(decoded.iat).toBeDefined()
			expect(decoded.exp > decoded.iat).toBe(true)
		})
	})

	describe('generateRefreshTokenString', () => {
		it('should generate a random string', () => {
			expect(generateRefreshTokenString()).not.toBe(generateRefreshTokenString())
		})

		it('should generate a long random string', () => {
			expect(generateRefreshTokenString().length).toBeGreaterThan(32)
		})

		it('should be hex format', () => {
			expect(/^[a-f0-9]+$/.test(generateRefreshTokenString())).toBe(true)
		})
	})

	describe('verifyAccessToken', () => {
		it('should verify valid token', () => {
			expect(verifyAccessToken(generateAccessToken(USER_ID)).id).toBe(USER_ID)
		})

		it('should throw for invalid token', () => {
			expect(() => verifyAccessToken('invalid.token.here')).toThrow()
		})

		it('should throw for expired token', () => {
			const expired = jwt.sign({ id: USER_ID, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET!)
			expect(() => verifyAccessToken(expired)).toThrow()
		})

		// A password reset link signed with the same secret used to open the
		// whole API for half an hour.
		it('refuses a password reset token', () => {
			const reset = generatePasswordResetToken(USER_ID, '$2a$10$hash')
			expect(() => verifyAccessToken(reset)).toThrow()
		})

		it('refuses any token that carries a purpose', () => {
			const other = jwt.sign({ id: USER_ID, purpose: 'tg-link' }, process.env.JWT_SECRET!)
			expect(() => verifyAccessToken(other)).toThrow()
		})
	})

	describe('password reset tokens', () => {
		const hash = '$2a$10$abcdefghijklmnopqrstuv'

		it('verifies against the password it was issued for', async () => {
			const token = generatePasswordResetToken(USER_ID, hash)
			await expect(verifyPasswordResetToken(token, async () => hash)).resolves.toBe(USER_ID)
		})

		// Single use: once the password changes, every earlier link is dead
		it('stops working once the password has changed', async () => {
			const token = generatePasswordResetToken(USER_ID, hash)
			await expect(verifyPasswordResetToken(token, async () => '$2a$10$somethingelse')).resolves.toBeNull()
		})

		it('refuses an access token', async () => {
			await expect(verifyPasswordResetToken(generateAccessToken(USER_ID), async () => hash)).resolves.toBeNull()
		})

		it('refuses a token for an account that is gone', async () => {
			const token = generatePasswordResetToken(USER_ID, hash)
			await expect(verifyPasswordResetToken(token, async () => null)).resolves.toBeNull()
		})
	})
})
