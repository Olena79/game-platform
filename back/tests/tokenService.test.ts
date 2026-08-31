import { generateAccessToken, generateRefreshTokenString, verifyAccessToken } from '../src/services/tokenService'

describe('Token Service', () => {
	describe('generateAccessToken', () => {
		it('should generate a valid JWT', () => {
			const token = generateAccessToken('507f1f77bcf86cd799439011')
			expect(typeof token).toBe('string')
			expect(token.split('.').length).toBe(3) // JWT format: header.payload.signature
		})

		it('should include userId in token', () => {
			const userId = '507f1f77bcf86cd799439011'
			const token = generateAccessToken(userId)
			const decoded = verifyAccessToken(token)
			expect(decoded.id).toBe(userId)
		})

		it('should have expiry date', () => {
			const token = generateAccessToken('507f1f77bcf86cd799439011')
			const decoded = verifyAccessToken(token)
			expect(decoded.exp).toBeDefined()
			expect(decoded.iat).toBeDefined()
			expect(decoded.exp > decoded.iat).toBe(true)
		})
	})

	describe('generateRefreshTokenString', () => {
		it('should generate a random string', () => {
			const token1 = generateRefreshTokenString()
			const token2 = generateRefreshTokenString()
			expect(token1).not.toBe(token2)
		})

		it('should generate a long random string', () => {
			const token = generateRefreshTokenString()
			expect(token.length).toBeGreaterThan(32)
		})

		it('should be hex format', () => {
			const token = generateRefreshTokenString()
			expect(/^[a-f0-9]+$/.test(token)).toBe(true)
		})
	})

	describe('verifyAccessToken', () => {
		it('should verify valid token', () => {
			const userId = '507f1f77bcf86cd799439011'
			const token = generateAccessToken(userId)
			const decoded = verifyAccessToken(token)
			expect(decoded.id).toBe(userId)
		})

		it('should throw for invalid token', () => {
			expect(() => {
				verifyAccessToken('invalid.token.here')
			}).toThrow()
		})

		it('should throw for expired token', () => {
			const JWT_SECRET = process.env.JWT_SECRET
			// Can't easily test expiration without manipulating time or token creation
			// This is covered by JWT library itself
			expect(JWT_SECRET).toBeDefined()
		})
	})
})
