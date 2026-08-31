import { sendGMRegistrationNotification } from '../src/services/email'

// Mock nodemailer and SendGrid
jest.mock('nodemailer', () => ({
	createTransport: jest.fn(() => ({
		sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
	})),
}))

jest.mock('@sendgrid/mail', () => ({
	setApiKey: jest.fn(),
	send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}))

describe('GM Registration Notifications', () => {
	describe('sendGMRegistrationNotification', () => {
		it('should send notification for player registration', async () => {
			await expect(
				sendGMRegistrationNotification(
					'gm@example.com',
					'Game Master',
					'John Player',
					'player',
					{
						title: 'Epic Quest',
						description: 'An amazing adventure',
						gameCode: 'ABC123',
					},
				),
			).resolves.not.toThrow()
		})

		it('should send notification for spectator registration', async () => {
			await expect(
				sendGMRegistrationNotification(
					'gm@example.com',
					'Game Master',
					'Jane Spectator',
					'spectator',
					{
						title: 'Quiz Night',
						gameCode: 'XYZ789',
					},
				),
			).resolves.not.toThrow()
		})

		it('should handle HTML escaping in names', async () => {
			await expect(
				sendGMRegistrationNotification(
					'gm@example.com',
					'GM <script>alert("xss")</script>',
					'Player <img src=x onerror=alert("xss")>',
					'player',
					{
						title: 'Test Game',
						gameCode: 'TEST',
					},
				),
			).resolves.not.toThrow()
		})

		it('should include game title in subject', async () => {
			const sgMail = require('@sendgrid/mail')
			sgMail.send.mockClear()

			await sendGMRegistrationNotification(
				'gm@example.com',
				'GM',
				'Player',
				'player',
				{
					title: 'Mystery Game',
					gameCode: 'MYS999',
				},
			)

			expect(sgMail.send).toHaveBeenCalled()
			const call = sgMail.send.mock.calls[0][0]
			expect(call.subject).toContain('Mystery Game')
			expect(call.subject).toContain('MYS999')
		})

		it('should include role indicator in subject', async () => {
			const sgMail = require('@sendgrid/mail')
			sgMail.send.mockClear()

			await sendGMRegistrationNotification(
				'gm@example.com',
				'GM',
				'Player',
				'player',
				{ title: 'Game', gameCode: 'G1' },
			)

			const call = sgMail.send.mock.calls[0][0]
			expect(call.subject).toContain('Гравець')

			sgMail.send.mockClear()

			await sendGMRegistrationNotification(
				'gm@example.com',
				'GM',
				'Spectator',
				'spectator',
				{ title: 'Game', gameCode: 'G2' },
			)

			const call2 = sgMail.send.mock.calls[0][0]
			expect(call2.subject).toContain('Глядач')
		})

		it('should skip if EMAIL_ENABLED is false', async () => {
			const originalEnv = process.env.EMAIL_ENABLED
			process.env.EMAIL_ENABLED = 'false'

			const sgMail = require('@sendgrid/mail')
			sgMail.send.mockClear()

			await sendGMRegistrationNotification(
				'gm@example.com',
				'GM',
				'Player',
				'player',
				{ title: 'Game', gameCode: 'TEST' },
			)

			expect(sgMail.send).not.toHaveBeenCalled()
			process.env.EMAIL_ENABLED = originalEnv
		})

		it('should handle descriptions with special characters', async () => {
			await expect(
				sendGMRegistrationNotification(
					'gm@example.com',
					'GM',
					'Player',
					'player',
					{
						title: 'Game with <tags>',
						description: 'Description with & ampersand and "quotes"',
						gameCode: 'TEST',
					},
				),
			).resolves.not.toThrow()
		})

		it('should work with different role types', async () => {
			for (const role of ['player', 'spectator'] as const) {
				await expect(
					sendGMRegistrationNotification(
						'gm@example.com',
						'GM',
						'Participant',
						role,
						{
							title: 'Test Game',
							gameCode: 'TST',
						},
					),
				).resolves.not.toThrow()
			}
		})
	})
})
