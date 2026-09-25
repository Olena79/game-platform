import { checkPart, normaliseContentType, MAX_PARTS } from '../src/services/recording'
import { RECORDING_PART_SIZE } from '../src/services/storage'

/**
 * The browser recorder uploads a game in parts while it is played. R2 needs
 * every part but the last to be the same size, and the file is only as good
 * as the order of its parts — these pin what the server accepts.
 */
describe('recording parts', () => {
	const full = RECORDING_PART_SIZE

	it('stores the next part when it is full size', () => {
		expect(checkPart({ expectedPart: 1, receivedPart: 1, size: full, isFinal: false })).toBe('store')
	})

	it('refuses a middle part of any other size', () => {
		expect(checkPart({ expectedPart: 2, receivedPart: 2, size: full - 1, isFinal: false })).toMatch(/exactly/)
		expect(checkPart({ expectedPart: 2, receivedPart: 2, size: full + 1, isFinal: false })).toMatch(/exactly/)
	})

	it('lets the last part be shorter, even empty', () => {
		expect(checkPart({ expectedPart: 3, receivedPart: 3, size: 1234, isFinal: true })).toBe('store')
		expect(checkPart({ expectedPart: 3, receivedPart: 3, size: 0, isFinal: true })).toBe('store')
	})

	it('refuses a last part larger than a part', () => {
		expect(checkPart({ expectedPart: 3, receivedPart: 3, size: full + 1, isFinal: true })).toMatch(/at most/)
	})

	// A retry after a lost response must not fail or be stored twice
	it('acknowledges a part it already has', () => {
		expect(checkPart({ expectedPart: 5, receivedPart: 4, size: full, isFinal: false })).toBe('duplicate')
	})

	it('refuses a part that skips ahead, naming the one it expects', () => {
		expect(checkPart({ expectedPart: 5, receivedPart: 7, size: full, isFinal: false })).toBe('Expected part 5')
	})

	it('refuses nonsense part numbers', () => {
		expect(checkPart({ expectedPart: 1, receivedPart: 0, size: full, isFinal: false })).toBe('Invalid part number')
		expect(checkPart({ expectedPart: 1, receivedPart: 1.5, size: full, isFinal: false })).toBe('Invalid part number')
		expect(checkPart({ expectedPart: 1, receivedPart: NaN, size: full, isFinal: false })).toBe('Invalid part number')
	})

	it('stops a recording that grows past the cap', () => {
		expect(checkPart({ expectedPart: MAX_PARTS + 1, receivedPart: MAX_PARTS + 1, size: full, isFinal: false })).toBe('Recording too long')
	})
})

describe('recording formats', () => {
	it('accepts what browsers record, without codec details', () => {
		expect(normaliseContentType('video/webm;codecs=vp8,opus')).toBe('video/webm')
		expect(normaliseContentType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')).toBe('video/mp4')
		expect(normaliseContentType('audio/webm;codecs=opus')).toBe('audio/webm')
		expect(normaliseContentType('audio/mp4')).toBe('audio/mp4')
	})

	it('refuses anything else', () => {
		expect(normaliseContentType('text/html')).toBeNull()
		expect(normaliseContentType('application/octet-stream')).toBeNull()
		expect(normaliseContentType(undefined)).toBeNull()
		expect(normaliseContentType({ type: 'video/mp4' })).toBeNull()
	})
})
