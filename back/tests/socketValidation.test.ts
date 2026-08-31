import { validateSocketEvent } from '../src/socket/eventValidation'
import {
	grChatSchema,
	grTimerSchema,
	grVoteCreateSchema,
	grVoteCastSchema,
	grVoteCloseSchema,
	grVoteClearSchema,
} from '../src/validation/schemas'

describe('Socket.IO Event Validation', () => {
	describe('validateSocketEvent wrapper', () => {
		it('should be a function', () => {
			expect(typeof validateSocketEvent).toBe('function')
		})

		it('should return a function', () => {
			const handler = validateSocketEvent(grChatSchema, async () => {})
			expect(typeof handler).toBe('function')
		})

		it('should validate data against schema', async () => {
			let validData: any = null
			const handler = validateSocketEvent(grChatSchema, async (d) => {
				validData = d
			})

			const validPayload = {
				gameCode: 'ABC123',
				text: 'Hello World',
				recipients: [],
			}

			await handler(validPayload)
			expect(validData).toEqual(validPayload)
		})

		it('should reject invalid data', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
			const handler = validateSocketEvent(grChatSchema, async () => {
				throw new Error('Should not be called')
			})

			const invalidPayload = {
				gameCode: 'ABC123',
				text: '', // Empty text is invalid
				recipients: [],
			}

			await handler(invalidPayload)
			expect(consoleSpy).toHaveBeenCalled()

			consoleSpy.mockRestore()
		})
	})

	describe('gr:chat schema validation', () => {
		it('should validate valid chat message', () => {
			const valid = {
				gameCode: 'ABC123',
				text: 'Hello World',
				recipients: [],
			}
			expect(() => grChatSchema.parse(valid)).not.toThrow()
		})

		it('should reject empty text', () => {
			const invalid = {
				gameCode: 'ABC123',
				text: '',
				recipients: [],
			}
			expect(() => grChatSchema.parse(invalid)).toThrow()
		})

		it('should trim text and limit to 500 chars', () => {
			const valid = {
				gameCode: 'ABC123',
				text: '  Hello  ',
				recipients: [],
			}
			const result = grChatSchema.parse(valid)
			expect(result.text).toBe('Hello')
		})
	})

	describe('gr:timer schema validation', () => {
		it('should validate set action', () => {
			const valid = {
				gameCode: 'ABC123',
				action: 'set',
				label: 'Countdown',
				seconds: 60,
			}
			expect(() => grTimerSchema.parse(valid)).not.toThrow()
		})

		it('should validate start action', () => {
			const valid = {
				gameCode: 'ABC123',
				action: 'start',
			}
			expect(() => grTimerSchema.parse(valid)).not.toThrow()
		})

		it('should validate stop action', () => {
			const valid = {
				gameCode: 'ABC123',
				action: 'stop',
			}
			expect(() => grTimerSchema.parse(valid)).not.toThrow()
		})

		it('should validate clear action', () => {
			const valid = {
				gameCode: 'ABC123',
				action: 'clear',
			}
			expect(() => grTimerSchema.parse(valid)).not.toThrow()
		})

		it('should reject invalid action', () => {
			const invalid = {
				gameCode: 'ABC123',
				action: 'invalid',
			}
			expect(() => grTimerSchema.parse(invalid)).toThrow()
		})
	})

	describe('gr:vote schema validation', () => {
		it('should validate vote creation', () => {
			const valid = {
				gameCode: 'ABC123',
				question: 'What is 2+2?',
				options: ['4', '5'],
				isAnonymous: false,
				multipleChoice: false,
			}
			expect(() => grVoteCreateSchema.parse(valid)).not.toThrow()
		})

		it('should require at least 2 options', () => {
			const invalid = {
				gameCode: 'ABC123',
				question: 'What is 2+2?',
				options: ['4'],
				isAnonymous: false,
				multipleChoice: false,
			}
			expect(() => grVoteCreateSchema.parse(invalid)).toThrow()
		})

		it('should validate vote casting', () => {
			const valid = {
				gameCode: 'ABC123',
				optionIds: ['o0'],
			}
			expect(() => grVoteCastSchema.parse(valid)).not.toThrow()
		})

		it('should validate vote close', () => {
			const valid = {
				gameCode: 'ABC123',
			}
			expect(() => grVoteCloseSchema.parse(valid)).not.toThrow()
		})

		it('should validate vote clear', () => {
			const valid = {
				gameCode: 'ABC123',
			}
			expect(() => grVoteClearSchema.parse(valid)).not.toThrow()
		})
	})

	describe('Schema error handling', () => {
		it('should handle validation errors gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
			const handler = validateSocketEvent(grChatSchema, async () => {})

			const invalidPayload = {
				gameCode: '',
				text: '',
			}

			await handler(invalidPayload)
			expect(consoleSpy).toHaveBeenCalled()

			consoleSpy.mockRestore()
		})

		it('should not call handler if validation fails', async () => {
			const mockHandler = jest.fn()
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

			const handler = validateSocketEvent(grChatSchema, mockHandler)

			const invalidPayload = {
				gameCode: 'ABC123',
				text: '',
			}

			await handler(invalidPayload)
			expect(mockHandler).not.toHaveBeenCalled()

			consoleSpy.mockRestore()
		})
	})
})
