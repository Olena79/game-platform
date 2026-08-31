import {
	registerSchema,
	loginSchema,
	createGameSchema,
	createPostSchema,
	grChatSchema,
	grVoteCreateSchema,
} from '../src/validation/schemas'

describe('Validation Schemas', () => {
	describe('registerSchema', () => {
		it('should validate correct registration data', () => {
			const validData = {
				email: 'user@example.com',
				password: 'securePassword123',
			}
			expect(() => registerSchema.parse(validData)).not.toThrow()
		})

		it('should reject invalid email', () => {
			const invalidData = {
				email: 'invalid-email',
				password: 'securePassword123',
			}
			expect(() => registerSchema.parse(invalidData)).toThrow()
		})

		it('should reject short password', () => {
			const invalidData = {
				email: 'user@example.com',
				password: 'short',
			}
			expect(() => registerSchema.parse(invalidData)).toThrow()
		})
	})

	describe('loginSchema', () => {
		it('should validate correct login data', () => {
			const validData = {
				email: 'user@example.com',
				password: 'password123',
			}
			expect(() => loginSchema.parse(validData)).not.toThrow()
		})

		it('should reject missing email', () => {
			const invalidData = {
				password: 'password123',
			}
			expect(() => loginSchema.parse(invalidData)).toThrow()
		})
	})

	describe('createGameSchema', () => {
		it('should validate correct game data', () => {
			const validData = {
				title: 'Test Game',
				description: 'A test game description',
				maxParticipants: 8,
				recordingEnabled: true,
			}
			expect(() => createGameSchema.parse(validData)).not.toThrow()
		})

		it('should reject short title', () => {
			const invalidData = {
				title: 'ab',
				description: 'Description',
			}
			expect(() => createGameSchema.parse(invalidData)).toThrow()
		})

		it('should reject invalid maxParticipants', () => {
			const invalidData = {
				title: 'Valid Title',
				maxParticipants: 1000,
			}
			expect(() => createGameSchema.parse(invalidData)).toThrow()
		})

		it('should provide defaults for optional fields', () => {
			const validData = {
				title: 'Test Game',
			}
			const parsed = createGameSchema.parse(validData)
			expect(parsed.maxParticipants).toBe(10)
			expect(parsed.recordingEnabled).toBe(true)
		})
	})

	describe('createPostSchema', () => {
		it('should validate correct post data', () => {
			const validData = {
				text: 'This is a post',
				images: ['https://example.com/image.jpg'],
			}
			expect(() => createPostSchema.parse(validData)).not.toThrow()
		})

		it('should reject empty text', () => {
			const invalidData = {
				text: '',
				images: [],
			}
			expect(() => createPostSchema.parse(invalidData)).toThrow()
		})

		it('should reject invalid image URLs', () => {
			const invalidData = {
				text: 'Valid text',
				images: ['not-a-url'],
			}
			expect(() => createPostSchema.parse(invalidData)).toThrow()
		})
	})

	describe('grChatSchema', () => {
		it('should validate correct chat message', () => {
			const validData = {
				gameCode: 'ABC123',
				text: 'Hello everyone!',
				recipients: [],
			}
			expect(() => grChatSchema.parse(validData)).not.toThrow()
		})

		it('should reject empty message', () => {
			const invalidData = {
				gameCode: 'ABC123',
				text: '',
			}
			expect(() => grChatSchema.parse(invalidData)).toThrow()
		})

		it('should reject message longer than 500 chars', () => {
			const invalidData = {
				gameCode: 'ABC123',
				text: 'a'.repeat(501),
			}
			expect(() => grChatSchema.parse(invalidData)).toThrow()
		})
	})

	describe('grVoteCreateSchema', () => {
		it('should validate correct vote creation', () => {
			const validData = {
				gameCode: 'ABC123',
				question: 'What is your favorite color?',
				options: ['Red', 'Blue', 'Green'],
				isAnonymous: false,
				multipleChoice: false,
			}
			expect(() => grVoteCreateSchema.parse(validData)).not.toThrow()
		})

		it('should reject vote with less than 2 options', () => {
			const invalidData = {
				gameCode: 'ABC123',
				question: 'Question?',
				options: ['Only one option'],
				isAnonymous: false,
				multipleChoice: false,
			}
			expect(() => grVoteCreateSchema.parse(invalidData)).toThrow()
		})

		it('should reject long question', () => {
			const invalidData = {
				gameCode: 'ABC123',
				question: 'a'.repeat(301),
				options: ['A', 'B'],
				isAnonymous: false,
				multipleChoice: false,
			}
			expect(() => grVoteCreateSchema.parse(invalidData)).toThrow()
		})
	})
})
