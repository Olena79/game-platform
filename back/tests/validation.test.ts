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

		it('should reject an out-of-range player count', () => {
			expect(() => createGameSchema.parse({ title: 'Valid Title', maxPlayers: 1000 })).toThrow()
		})

		it('should reject maxPlayers below minPlayers', () => {
			expect(() => createGameSchema.parse({ title: 'Valid Title', minPlayers: 8, maxPlayers: 4 })).toThrow()
		})

		it('should keep every field the create form sends', () => {
			const parsed = createGameSchema.parse({
				title: 'Test Game',
				scenario: 'secret plot',
				minPlayers: 3,
				maxPlayers: 7,
				useCoins: true,
				coinsPerPlayer: 10,
				participationCost: 200,
				gmCardNumber: '1234123412341234',
				coverImage: 'https://example.com/c.png',
				images: ['https://example.com/a.png'],
				defaultTimerSeconds: 600,
			})
			expect(parsed.scenario).toBe('secret plot')
			expect(parsed.maxPlayers).toBe(7)
			expect(parsed.coinsPerPlayer).toBe(10)
			expect(parsed.participationCost).toBe(200)
			expect(parsed.defaultTimerSeconds).toBe(600)
			expect(parsed.images).toHaveLength(1)
		})

		it('should reject a card number that is not 16 digits', () => {
			expect(() => createGameSchema.parse({ title: 'Valid Title', gmCardNumber: '12345' })).toThrow()
		})
	})

	describe('createPostSchema', () => {
		it('should validate correct post data', () => {
			expect(() => createPostSchema.parse({ text: 'This is a post', topic: 'tema' })).not.toThrow()
		})

		it('should reject empty text', () => {
			expect(() => createPostSchema.parse({ text: '' })).toThrow()
		})

		// The model caps text at 1000; anything longer used to pass validation
		// and then fail as a 500 inside Mongoose.
		it('should reject text longer than the model allows', () => {
			expect(() => createPostSchema.parse({ text: 'x'.repeat(1001) })).toThrow()
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
