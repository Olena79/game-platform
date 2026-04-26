import mongoose from 'mongoose'

export const connectDB = async (): Promise<void> => {
	const uri = process.env.MONGO_URI
	if (!uri) {
		throw new Error('MONGO_URI is not defined in .env')
	}
	await mongoose.connect(uri)
	console.log('MongoDB connected')

	// Drop stale phone_1 unique index left from an old schema version
	try {
		await mongoose.connection.collection('users').dropIndex('phone_1')
		console.log('[db] Dropped legacy phone_1 index')
	} catch {
		// Index already gone — nothing to do
	}
}
