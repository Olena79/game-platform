/**
 * iPhone and iPad Safari zoom the page in when a text field smaller than
 * 16px is tapped, and do not zoom back out. The site changes pages without
 * reloading, so the zoom stayed on every next page and people had to pinch
 * it back each time (reported 2026-09-28). Our fields are 13–15px.
 *
 * `maximum-scale=1` stops that automatic zoom. On iOS it does not stop the
 * person from zooming with two fingers (Safari ignores it for pinch since
 * iOS 10), so nothing is taken away. Elsewhere — Android — it would block
 * pinch zoom, so it is added on iOS only.
 */
export function isIOS(ua: string, maxTouchPoints: number): boolean {
	return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
}

export function preventIosAutoZoom(doc: Document = document, nav: Navigator = navigator): boolean {
	if (!isIOS(nav.userAgent, nav.maxTouchPoints ?? 0)) return false
	const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]')
	if (!meta || /maximum-scale/.test(meta.content)) return false
	meta.content = `${meta.content}, maximum-scale=1`
	return true
}
