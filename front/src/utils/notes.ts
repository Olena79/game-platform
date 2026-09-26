/** Characters that take up no room: zero-width spaces and joiners, the BOM */
const INVISIBLE = /[​-‍⁠﻿]/g
/** A line the "insert player" button produced with nothing written after it */
const BARE_LABEL = /^[^\n]*\s—\s*$/

/**
 * The notes as they are worth sending — the same rule the server applies
 * (back/src/services/notesDelivery.ts): invisible characters and lines that
 * are only an inserted player name do not count. Empty means nothing to send.
 */
export function cleanNotes(notes: string): string {
	return notes
		.replace(INVISIBLE, '')
		.split('\n')
		.filter(line => !BARE_LABEL.test(line))
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}
