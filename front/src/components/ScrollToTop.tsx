import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Every page opens at its top. Pages change without a reload, so the
 * window kept its scroll: someone at the bottom of one page who tapped the
 * phone menu landed at the bottom of the next (2026-10-09). Going back
 * (POP) is left to the browser, which returns to where the person was.
 */
export const ScrollToTop = () => {
	const { pathname } = useLocation()
	const navigationType = useNavigationType()
	useLayoutEffect(() => {
		if (navigationType === 'POP') return
		window.scrollTo(0, 0)
	}, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
	return null
}
