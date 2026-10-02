import { describe, it, expect } from 'vitest'
import { hasText, isRichText, scenarioHtml, sanitizeRichText } from './richText'

describe('scenario formatting', () => {
	it('keeps bold, italic, underline and colours', () => {
		const html = sanitizeRichText('<p><b>Акт 1</b> <i>тихо</i> <u>важливо</u> <span style="color: rgb(255, 0, 0); font-size: 40px; font-family: Arial">червоне</span></p>')
		expect(html).toContain('<b>Акт 1</b>')
		expect(html).toContain('<i>тихо</i>')
		expect(html).toContain('<u>важливо</u>')
		expect(html).toContain('color: rgb(255, 0, 0)')
		expect(html).not.toContain('font-size')
		expect(html).not.toContain('font-family')
	})

	it('removes scripts, handlers, links and images', () => {
		const html = sanitizeRichText('<p onclick="x()">Текст<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:x">посилання</a></p>')
		expect(html).not.toMatch(/script|onclick|onerror|<img|<a |javascript/)
		expect(html).toContain('Текст')
		expect(html).toContain('посилання')
	})

	it('refuses url() hidden in a style', () => {
		const html = sanitizeRichText('<span style="background-color: url(http://evil)">x</span>')
		expect(html).not.toContain('url(')
	})

	it('shows an old plain-text scenario as before, line breaks kept and nothing interpreted', () => {
		expect(isRichText('Рядок 1\nРядок 2')).toBe(false)
		expect(scenarioHtml('Рядок 1\nРядок 2 <3')).toBe('Рядок 1<br>Рядок 2 &lt;3')
	})

	it('knows an empty editor from a written one', () => {
		expect(hasText('<p><br></p>')).toBe(false)
		expect(hasText('<p><b>x</b></p>')).toBe(true)
	})
})
