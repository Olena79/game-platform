/**
 * Environment every test run needs.
 *
 * Several modules refuse to load without these (tokenService throws on a
 * missing JWT_SECRET at import time), which used to take whole suites down
 * before a single test ran.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long'
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id.apps.googleusercontent.com'
process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'test-livekit-key'
process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'test-livekit-secret'
process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://test.livekit.cloud'
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
