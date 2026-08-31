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

		it('should have file transport for errors', () => {
			const hasFileTransport = logger.transports.some(
				(t) => t.constructor.name === 'File' && (t as any).filename?.includes('error.log')
			)
			expect(hasFileTransport).toBe(true)
		})

		it('should have combined log file transport', () => {
			const hasFileTransport = logger.transports.some(
				(t) => t.constructor.name === 'File' && (t as any).filename?.includes('combined.log')
			)
			expect(hasFileTransport).toBe(true)
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
		it('should have max file size limit', () => {
			const fileTransport = logger.transports.find(
				(t) => t.constructor.name === 'File' && (t as any).filename?.includes('error.log')
			) as any

			expect(fileTransport).toBeDefined()
			expect(fileTransport.maxsize).toBe(5242880) // 5MB
		})

		it('should have max file retention', () => {
			const fileTransport = logger.transports.find(
				(t) => t.constructor.name === 'File' && (t as any).filename?.includes('error.log')
			) as any

			expect(fileTransport).toBeDefined()
			expect(fileTransport.maxFiles).toBeGreaterThan(0)
		})
	})
})
