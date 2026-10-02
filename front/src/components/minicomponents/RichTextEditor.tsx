import { useEffect, useRef } from 'react'
import { hasText, plainToHtml, sanitizeRichText, scenarioHtml } from '../../utils/richText'

interface Props {
	value: string
	onChange: (html: string) => void
	placeholder?: string
}

/**
 * The scenario field: text pasted from a document keeps its bold, italic,
 * underline and colours (Ctrl/⌘+B, I, U work too). What it hands back is
 * already cleaned — see utils/richText.
 *
 * Light grey with black text, like the scenario tab in the room: pasted
 * documents are mostly black text, which a dark field would hide.
 */
export const RichTextEditor = ({ value, onChange, placeholder }: Props) => {
	const ref = useRef<HTMLDivElement>(null)
	const lastEmitted = useRef<string | null>(null)

	// Loaded from outside (editing a game): show it. Our own typing is not
	// written back, or the caret would jump to the start on every key.
	useEffect(() => {
		const el = ref.current
		if (!el || value === lastEmitted.current) return
		el.innerHTML = scenarioHtml(value)
		lastEmitted.current = value
	}, [value])

	const emit = () => {
		const el = ref.current
		if (!el) return
		const html = hasText(el.innerHTML) ? sanitizeRichText(el.innerHTML) : ''
		lastEmitted.current = html
		onChange(html)
	}

	// Pasted (or dropped) content is cleaned before it touches the page —
	// otherwise a booby-trapped image in the clipboard could run its code
	// the moment it was inserted, before any later clean-up
	const insertClean = (e: React.ClipboardEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement>) => {
		const data = 'clipboardData' in e ? e.clipboardData : e.dataTransfer
		if (!data) return
		e.preventDefault()
		const html = data.getData('text/html')
		const clean = html ? sanitizeRichText(html) : plainToHtml(data.getData('text/plain'))
		document.execCommand('insertHTML', false, clean)
		emit()
	}

	// On leaving the field, show the cleaned version
	const tidy = () => {
		const el = ref.current
		if (!el) return
		const clean = hasText(el.innerHTML) ? sanitizeRichText(el.innerHTML) : ''
		if (clean !== el.innerHTML) el.innerHTML = clean
		lastEmitted.current = clean
		onChange(clean)
	}

	return (
		<div
			ref={ref}
			contentEditable
			suppressContentEditableWarning
			role='textbox'
			aria-multiline='true'
			aria-label={placeholder}
			data-placeholder={placeholder}
			onInput={emit}
			onPaste={insertClean}
			onDrop={insertClean}
			onBlur={tidy}
			className='rich-text-editor w-full rounded-[12px] py-[12px] px-[14px] text-[14px] leading-[1.7] focus:outline-none min-h-[160px] max-h-[60vh] overflow-y-auto break-words'
			style={{ background: '#e4e6eb', color: '#111', border: '1px solid #b9bec9' }}
		/>
	)
}
