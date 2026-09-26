import { describe, it, expect } from 'vitest'
import { cleanNotes } from '../src/utils/notes'

// Must match the server's rule (back/tests/notes.test.ts)
describe('cleanNotes (room)', () => {
	it('sends nothing for spaces or a player name alone', () => {
		expect(cleanNotes('  \n ')).toBe('')
		expect(cleanNotes('Олена Клементьєва — ')).toBe('')
	})
	it('sends any real character', () => {
		expect(cleanNotes('!')).toBe('!')
		expect(cleanNotes('Ігор — підозрює кухаря')).toBe('Ігор — підозрює кухаря')
	})
})
