import mongoose from 'mongoose'
import logger from './logger'

export const connectDB = async (): Promise<void> => {
	const uri = process.env.MONGO_URI
	if (!uri) {
		throw new Error('MONGO_URI is not defined in .env')
	}
	// Only the host: the connection string carries the database password, and
	// logs are read by more people and kept longer than secrets should be.
	logger.info('Connecting to MongoDB...', { host: mongoHost(uri) })

	mongoose.connection.on('connected',    () => logger.info('[db] MongoDB connected'))
	mongoose.connection.on('disconnected', () => logger.info('[db] MongoDB disconnected — will retry'))
	mongoose.connection.on('error',        (err) => logger.error('[db] MongoDB error:', err.message))

	await mongoose.connect(uri, {
		serverSelectionTimeoutMS: 10_000,
		socketTimeoutMS:          45_000,
		connectTimeoutMS:         10_000,
		heartbeatFrequencyMS:     10_000,
		retryWrites: true,
		w: 'majority',
		family: 4,
	} as any)

	// Drop stale phone_1 unique index left from an old schema version
	try {
		await mongoose.connection.collection('users').dropIndex('phone_1')
		logger.info('[db] Dropped legacy phone_1 index')
	} catch {
		// Index already gone — nothing to do
	}
}

/** "cluster0.abcde.mongodb.net" out of a connection string — never the credentials. */
export function mongoHost(uri: string): string {
	const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '')
	const hostPart = afterScheme.slice(afterScheme.lastIndexOf('@') + 1)
	return hostPart.split(/[/?]/)[0] || 'unknown'
}
