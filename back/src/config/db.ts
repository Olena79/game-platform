import mongoose from 'mongoose'

export const connectDB = async (): Promise<void> => {
	const uri = process.env.MONGO_URI
	if (!uri) {
		throw new Error('MONGO_URI is not defined in .env')
	}

	mongoose.connection.on('connected',    () => console.log('[db] MongoDB connected'))
	mongoose.connection.on('disconnected', () => console.log('[db] MongoDB disconnected — will retry'))
	mongoose.connection.on('error',        (err) => console.error('[db] MongoDB error:', err.message))

	await mongoose.connect(uri, {
		serverSelectionTimeoutMS: 10_000,  // fail fast on DNS / network issues
		socketTimeoutMS:          45_000,
		connectTimeoutMS:         10_000,
		heartbeatFrequencyMS:     10_000,  // detect drops quickly
	})

	// Drop stale phone_1 unique index left from an old schema version
	try {
		await mongoose.connection.collection('users').dropIndex('phone_1')
		console.log('[db] Dropped legacy phone_1 index')
	} catch {
		// Index already gone — nothing to do
	}
}
