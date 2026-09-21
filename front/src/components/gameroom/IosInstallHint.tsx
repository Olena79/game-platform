import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Share, X } from 'lucide-react'

const SEEN_KEY = 'ios-install-hint-seen'

/**
 * iOS Safari has no Fullscreen API for elements, so the address bar can only
 * be dropped by installing the site to the home screen. This is the one place
 * a user would ever find that out — shown once, then never again.
 */
function shouldShow(): boolean {
	const ua = navigator.userAgent
	const isIOS = /iPhone|iPad|iPod/i.test(ua)
		// iPadOS 13+ reports itself as a Mac, touch support gives it away
		|| (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
	if (!isIOS) return false

	// Already installed — the address bar is gone, nothing to suggest
	const standalone = (navigator as any).standalone === true
		|| window.matchMedia('(display-mode: standalone)').matches
	if (standalone) return false

	try {
		return localStorage.getItem(SEEN_KEY) !== '1'
	} catch {
		return false // private mode: can't remember it, so don't nag
	}
}

export function IosInstallHint() {
	const { t } = useTranslation()
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		if (!shouldShow()) return
		// Let the room settle first — the hint isn't why they're here
		const show = setTimeout(() => {
			setVisible(true)
			// Marked as seen on display, not on dismissal: it fades out on its
			// own and shouldn't come back for people who simply ignored it.
			try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
		}, 4000)
		const hide = setTimeout(() => setVisible(false), 16000)
		return () => { clearTimeout(show); clearTimeout(hide) }
	}, [])

	if (!visible) return null

	return (
		<>
			<style>{'@keyframes iosHintIn{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}'}</style>
			<div
				className='fixed left-[12px] right-[12px] z-[53] flex items-center gap-[8px] rounded-[10px] px-[10px] py-[8px]'
				style={{
					bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
					background: 'rgba(13,18,40,0.92)',
					border: '1px solid rgba(15,255,200,0.18)',
					backdropFilter: 'blur(6px)',
					animation: 'iosHintIn 0.25s ease-out',
				}}
			>
				<Share size={14} style={{ color: 'rgba(15,255,200,0.75)', flexShrink: 0 }} />
				<span className='text-[11px] leading-[1.35] flex-1' style={{ color: 'rgba(200,218,255,0.75)' }}>
					{t('room.ios_hint')}
				</span>
				<button
					onClick={() => setVisible(false)}
					aria-label={t('room.close')}
					className='flex-shrink-0 flex items-center justify-center w-[22px] h-[22px] rounded-[6px] cursor-pointer'
					style={{ color: 'rgba(160,180,230,0.55)' }}
				>
					<X size={13} />
				</button>
			</div>
		</>
	)
}
