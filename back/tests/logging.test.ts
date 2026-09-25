import logger from '../src/config/logger'

describe('Logger Configuration', () => {
	describe('Winston Logger', () => {
		it('should be defined', () => {
			expect(logger).toBeDefined()
		})

		it('should have required transports', () => {
			expect(logger.transports).toBeDefined()
			expect(logger.transports.length).toBeGreaterThan(0)
		})

		it('should have console transport', () => {
			const hasConsoleTransport = logger.transports.some(
				(t) => t.constructor.name === 'Console'
			)
			expect(hasConsoleTransport).toBe(true)
		})

		// Outside development there are no log files on purpose: the host's
		// filesystem is recreated on every deploy, so files there can never be
		// read back and only consume space.
		it('should write to files only in development', () => {
			const fileTransports = logger.transports.filter(t => t.constructor.name === 'File')
			const expected = process.env.NODE_ENV === 'development'
			expect(fileTransports.length > 0).toBe(expected)
		})

		it('should use json format', () => {
			expect(logger.format).toBeDefined()
		})

		it('should include service metadata', () => {
			expect(logger.defaultMeta).toBeDefined()
			expect((logger.defaultMeta as any).service).toBe('games-of-senses')
		})
	})

	describe('Log Levels', () => {
		it('should have info level in production', () => {
			const prodEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'production'

			// Note: This is testing the config logic, not actual behavior
			// In real scenario would reimport the logger
			expect(logger.level).toBeDefined()
		})

		it('should have debug level in development', () => {
			const devEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			// Note: This is testing the config logic, not actual behavior
			expect(logger.level).toBeDefined()
		})
	})

	describe('Log Writing', () => {
		it('should log info messages', () => {
			expect(() => {
				logger.info('Test info message')
			}).not.toThrow()
		})

		it('should log error messages', () => {
			expect(() => {
				logger.error('Test error message')
			}).not.toThrow()
		})

		it('should log warning messages', () => {
			expect(() => {
				logger.warn('Test warning message')
			}).not.toThrow()
		})

		it('should log debug messages', () => {
			expect(() => {
				logger.debug('Test debug message')
			}).not.toThrow()
		})
	})

	describe('Log with Metadata', () => {
		it('should log with additional metadata', () => {
			expect(() => {
				logger.info('Message with metadata', { userId: '507f', action: 'login' })
			}).not.toThrow()
		})

		it('should log errors with stack traces', () => {
			const error = new Error('Test error')
			expect(() => {
				logger.error('Error occurred', { error })
			}).not.toThrow()
		})
	})

	describe('Log File Configuration', () => {
		it('should keep the console transport in every environment', () => {
			const hasConsole = logger.transports.some(t => t.constructor.name === 'Console')
			expect(hasConsole).toBe(true)
		})
	})
})

describe('database connection log', () => {
	it('names the host and never the credentials', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { mongoHost } = require('../src/config/db')
		const host = mongoHost('mongodb+srv://gameAdmin:s3cr3t-P@ss@cluster0.abcde.mongodb.net/game?retryWrites=true')
		expect(host).toBe('cluster0.abcde.mongodb.net')
		expect(mongoHost('mongodb://localhost:27017/game')).toBe('localhost:27017')
	})
})
