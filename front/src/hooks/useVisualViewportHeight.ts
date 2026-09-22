import { useEffect } from 'react'

/**
 * Publishes the visible viewport height as `--vvh`.
 *
 * On iOS Safari `vh` (and even `dvh`) ignore the on-screen keyboard, so a
 * panel sized in viewport units keeps its input underneath the keyboard once
 * it opens. visualViewport is the one measurement that shrinks with it.
 */
export function useVisualViewportHeight(): void {
	useEffect(() => {
		const vv = window.visualViewport
		if (!vv) return

		const apply = () => {
			document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
		}
		apply()
		vv.addEventListener('resize', apply)
		vv.addEventListener('scroll', apply)
		return () => {
			vv.removeEventListener('resize', apply)
			vv.removeEventListener('scroll', apply)
			document.documentElement.style.removeProperty('--vvh')
		}
	}, [])
}
