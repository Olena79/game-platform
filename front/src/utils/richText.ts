import DOMPurify from 'dompurify'

/**
 * The scenario keeps the formatting it was pasted with — bold, italic,
 * underline, colours, lists — and nothing else. Scripts, links, images,
 * fonts and sizes from the source document are dropped; of inline styles
 * only colour, background, weight, slant and underline/strike survive.
 *
 * Scenarios written before this were plain text: they are shown as they
 * were, line breaks kept.
 */

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup', 'br', 'p', 'div', 'span', 'font',
	'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote']
const ALLOWED_STYLE = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line']

let hooked = false
function ensureHook() {
	if (hooked) return
	hooked = true
	DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
		if (data.attrName !== 'style') return
		const kept = data.attrValue
			.split(';')
			.map(rule => rule.trim())
			.filter(rule => {
				const name = rule.split(':')[0]?.trim().toLowerCase()
				const value = rule.slice(rule.indexOf(':') + 1).toLowerCase()
				// No url(), expression() or other tricks inside a colour
				return name && ALLOWED_STYLE.includes(name) && !/url\(|expression|javascript:/.test(value)
			})
		data.attrValue = kept.join('; ')
		if (!data.attrValue) data.keepAttr = false
	})
}

/** True when the text carries HTML markup (a scenario with formatting). */
export function isRichText(text: string): boolean {
	return /<\/?(b|strong|i|em|u|s|span|p|div|br|font|ul|ol|li|h[1-4]|mark|blockquote)\b[^>]*>/i.test(text)
}

/** Formatting kept, everything risky or foreign removed. */
export function sanitizeRichText(html: string): string {
	ensureHook()
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: ['style', 'color'],
		KEEP_CONTENT: true,
	})
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Plain text as HTML, its line breaks kept. */
export function plainToHtml(text: string): string {
	return escapeHtml(text).replace(/\r?\n/g, '<br>')
}

/** Whatever was stored — old plain text or new formatted text — as safe HTML. */
export function scenarioHtml(stored: string): string {
	if (!stored) return ''
	return isRichText(stored) ? sanitizeRichText(stored) : plainToHtml(stored)
}

/** Is there anything to read once the markup is gone? */
export function hasText(html: string): boolean {
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
}
