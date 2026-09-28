import { describe, it, expect, beforeEach } from 'vitest'
import { isIOS, preventIosAutoZoom } from './iosNoAutoZoom'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const BASE = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

function page() {
	document.head.innerHTML = `<meta name="viewport" content="${BASE}">`
	return document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!
}
const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints } as Navigator)

describe('iOS auto-zoom on text fields', () => {
	beforeEach(() => { document.head.innerHTML = '' })

	it('recognises iPhone and iPad (which calls itself a Mac with touch), not Android or a Mac', () => {
		expect(isIOS(IPHONE, 5)).toBe(true)
		expect(isIOS(MAC, 5)).toBe(true)
		expect(isIOS(MAC, 0)).toBe(false)
		expect(isIOS(ANDROID, 5)).toBe(false)
	})

	it('stops the zoom on an iPhone, keeping the rest of the viewport', () => {
		const meta = page()
		expect(preventIosAutoZoom(document, nav(IPHONE, 5))).toBe(true)
		expect(meta.content).toBe(`${BASE}, maximum-scale=1`)
		// Only once
		preventIosAutoZoom(document, nav(IPHONE, 5))
		expect(meta.content.match(/maximum-scale/g)).toHaveLength(1)
	})

	it('leaves Android alone, where it would block pinch zoom', () => {
		const meta = page()
		expect(preventIosAutoZoom(document, nav(ANDROID, 5))).toBe(false)
		expect(meta.content).toBe(BASE)
	})
})
