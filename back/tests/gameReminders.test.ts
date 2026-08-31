import { sendGameStartReminders } from '../src/services/gameReminders'
import { Game } from '../src/models/Game'
import { User } from '../src/models/User'
import { sendGameStartReminder } from '../src/services/email'

jest.mock('../src/models/Game')
jest.mock('../src/models/User')
jest.mock('../src/services/email')
jest.mock('../src/config/logger', () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
	},
}))

describe('Game Start Reminders', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe('sendGameStartReminders', () => {
		it('should find games scheduled in 30-35 minutes', async () => {
			const mockGame = {
				_id: 'game1',
				title: 'Test Game',
				gameCode: 'TST123',
				creatorId: 'user1',
				registeredPlayers: [],
				spectators: [],
				reminderSent: false,
				save: jest.fn(),
			}

			;(Game.find as jest.Mock).mockResolvedValue([mockGame])
			;(User.findById as jest.Mock).mockResolvedValue({
				_id: 'user1',
				email: 'gm@example.com',
				name: 'Game Master',
			})

			await sendGameStartReminders()

			expect(Game.find).toHaveBeenCalledWith(
				expect.objectContaining({
					reminderSent: false,
				}),
			)
		})

		it('should send reminders to GM and all participants', async () => {
			const mockGame = {
				_id: 'game1',
				title: 'Test Game',
				gameCode: 'TST123',
				creatorId: 'gm1',
				registeredPlayers: [
					{ userId: 'player1', name: 'Player 1' },
					{ userId: 'player2', name: 'Player 2' },
				],
				spectators: [{ userId: 'spectator1', name: 'Spectator 1' }],
				reminderSent: false,
				scheduledAt: new Date(),
				save: jest.fn(),
			}

			;(Game.find as jest.Mock).mockResolvedValue([mockGame])
			;(User.findById as jest.Mock).mockImplementation(id => {
				const users: any = {
					gm1: { _id: 'gm1', email: 'gm@example.com', name: 'GM' },
					player1: { _id: 'player1', email: 'player1@example.com', name: 'Player 1' },
					player2: { _id: 'player2', email: 'player2@example.com', name: 'Player 2' },
					spectator1: { _id: 'spectator1', email: 'spectator1@example.com', name: 'Spectator 1' },
				}
				return Promise.resolve(users[id])
			})

			await sendGameStartReminders()

			expect(sendGameStartReminder).toHaveBeenCalledTimes(4)
			expect(mockGame.save).toHaveBeenCalled()
		})

		it('should mark reminder as sent after sending', async () => {
			const mockGame = {
				_id: 'game1',
				title: 'Test Game',
				gameCode: 'TST123',
				creatorId: 'user1',
				registeredPlayers: [],
				spectators: [],
				reminderSent: false,
				save: jest.fn(),
			}

			;(Game.find as jest.Mock).mockResolvedValue([mockGame])
			;(User.findById as jest.Mock).mockResolvedValue({
				_id: 'user1',
				email: 'gm@example.com',
				name: 'GM',
			})

			await sendGameStartReminders()

			expect(mockGame.reminderSent).toBe(true)
			expect(mockGame.save).toHaveBeenCalled()
		})

		it('should handle multiple games', async () => {
			const mockGames = [
				{
					_id: 'game1',
					title: 'Game 1',
					gameCode: 'G1',
					creatorId: 'user1',
					registeredPlayers: [],
					spectators: [],
					reminderSent: false,
					save: jest.fn(),
				},
				{
					_id: 'game2',
					title: 'Game 2',
					gameCode: 'G2',
					creatorId: 'user2',
					registeredPlayers: [],
					spectators: [],
					reminderSent: false,
					save: jest.fn(),
				},
			]

			;(Game.find as jest.Mock).mockResolvedValue(mockGames)
			;(User.findById as jest.Mock).mockResolvedValue({
				_id: 'user1',
				email: 'user@example.com',
				name: 'User',
			})

			await sendGameStartReminders()

			expect(Game.find).toHaveBeenCalled()
			expect(mockGames[0].save).toHaveBeenCalled()
			expect(mockGames[1].save).toHaveBeenCalled()
		})

		it('should handle missing users gracefully', async () => {
			const mockGame = {
				_id: 'game1',
				title: 'Test Game',
				gameCode: 'TST123',
				creatorId: 'deleted-user',
				registeredPlayers: [{ userId: 'deleted-player' }],
				spectators: [],
				reminderSent: false,
				save: jest.fn(),
			}

			;(Game.find as jest.Mock).mockResolvedValue([mockGame])
			;(User.findById as jest.Mock).mockResolvedValue(null)

			await expect(sendGameStartReminders()).resolves.not.toThrow()
		})

		it('should handle email send errors gracefully', async () => {
			const mockGame = {
				_id: 'game1',
				title: 'Test Game',
				gameCode: 'TST123',
				creatorId: 'user1',
				registeredPlayers: [],
				spectators: [],
				reminderSent: false,
				save: jest.fn(),
			}

			;(Game.find as jest.Mock).mockResolvedValue([mockGame])
			;(User.findById as jest.Mock).mockResolvedValue({
				_id: 'user1',
				email: 'gm@example.com',
				name: 'GM',
			})
			;(sendGameStartReminder as jest.Mock).mockRejectedValue(new Error('Email send failed'))

			await expect(sendGameStartReminders()).resolves.not.toThrow()
		})

		it('should skip games that already had reminder sent', async () => {
			;(Game.find as jest.Mock).mockResolvedValue([])

			await sendGameStartReminders()

			// Verify the query filtered by reminderSent: false
			const query = (Game.find as jest.Mock).mock.calls[0][0]
			expect(query.reminderSent).toBe(false)
		})
	})

	describe('Time window', () => {
		it('should check games within 30-35 minute window', async () => {
			;(Game.find as jest.Mock).mockResolvedValue([])

			await sendGameStartReminders()

			const query = (Game.find as jest.Mock).mock.calls[0][0]
			expect(query.scheduledAt).toBeDefined()
			expect(query.scheduledAt.$gte).toBeDefined()
			expect(query.scheduledAt.$lte).toBeDefined()
		})

		it('should not send reminders for games starting now or in the past', async () => {
			;(Game.find as jest.Mock).mockResolvedValue([])

			await sendGameStartReminders()

			const query = (Game.find as jest.Mock).mock.calls[0][0]
			const inPast = new Date(Date.now() - 5 * 60 * 1000)

			expect(inPast.getTime()).toBeLessThan(query.scheduledAt.$gte.getTime())
		})
	})
})
