import { cleanNotes } from '../src/services/notesDelivery'

/**
 * Notes reach the gamemaster's Telegram only when something was written.
 * A player name tapped by mistake in the notes panel ("Name — ") used to go
 * out as a message with nothing in it.
 */
describe('cleanNotes', () => {
	it('counts a single letter, digit or sign as something', () => {
		expect(cleanNotes('a')).toBe('a')
		expect(cleanNotes('7')).toBe('7')
		expect(cleanNotes('?')).toBe('?')
	})

	it('treats spaces, line breaks and invisible characters as nothing', () => {
		expect(cleanNotes('')).toBe('')
		expect(cleanNotes('   \n\n\t ')).toBe('')
		expect(cleanNotes('​﻿‍')).toBe('')
	})

	it('treats an inserted name with nothing after it as nothing', () => {
		expect(cleanNotes('Олена Клементьєва — ')).toBe('')
		expect(cleanNotes('Олена Клементьєва — \nІгор (Детектив) — \n')).toBe('')
	})

	it('keeps a name that has something written after it', () => {
		expect(cleanNotes('Ігор (Детектив) — підозрює кухаря')).toBe('Ігор (Детектив) — підозрює кухаря')
	})

	it('drops only the empty names from real notes', () => {
		expect(cleanNotes('Олена — \nРаунд 1: всі голосували за Ігоря\nІгор — ')).toBe('Раунд 1: всі голосували за Ігоря')
	})

	it('keeps the writing as it was otherwise', () => {
		expect(cleanNotes('  Перший рядок\n\n  другий з відступом  ')).toBe('Перший рядок\n\n  другий з відступом')
	})
})
