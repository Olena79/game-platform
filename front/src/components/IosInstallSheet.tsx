import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

/** Safari's share icon: a square with an arrow up */
const ShareIcon = () => (
	<svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
		<path d='M12 3v12' /><path d='M8 7l4-4 4 4' /><path d='M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1' />
	</svg>
)

/** "Add to Home Screen": a rounded square with a plus */
const AddIcon = () => (
	<svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' aria-hidden='true'>
		<rect x='4' y='4' width='16' height='16' rx='4' /><path d='M12 8v8M8 12h8' />
	</svg>
)

/**
 * How to install the site on an iPhone or iPad. A website cannot install
 * itself there — Safari offers no dialog — so this shows the three taps,
 * with the icons to look for. Newer iOS hides Share behind "⋯"; a site opened
 * inside Telegram or Instagram has to be opened in Safari first.
 */
export const IosInstallSheet = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation()
	const step = (n: number, icon: React.ReactNode, text: string) => (
		<li className='flex items-start gap-[12px]'>
			<span className='flex-shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] font-[700]'
				style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{n}</span>
			<span className='flex-1 text-[14px] leading-[1.45]' style={{ color: 'var(--text-primary)' }}>{text}</span>
			<span className='flex-shrink-0 min-w-[38px] h-[38px] px-[7px] rounded-[10px] flex items-center justify-center'
				style={{ background: 'var(--bg-input)', color: '#0a84ff', border: '1px solid var(--border-subtle)' }}>{icon}</span>
		</li>
	)
	// Rendered at the top of the page: inside the footer it sat under the
	// fixed bottom nav, which covered its last button
	return createPortal(
		<div className='fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-[12px]'
			style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} role='dialog' aria-modal='true'>
			<div className='w-full max-w-[420px] rounded-[18px] p-[20px] flex flex-col gap-[16px]'
				style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
				onClick={e => e.stopPropagation()}>
				<div className='flex items-start justify-between gap-[10px]'>
					<h3 className='text-[17px] font-[700]' style={{ color: 'var(--text-primary)' }}>{t('footer.ios_title')}</h3>
					<button onClick={onClose} aria-label={t('footer.ios_close')} className='cursor-pointer p-[2px]' style={{ color: 'var(--text-muted)' }}>
						<X size={20} />
					</button>
				</div>
				<ol className='flex flex-col gap-[14px]'>
					{step(1, <ShareIcon />, t('footer.ios_step1'))}
					{step(2, <AddIcon />, t('footer.ios_step2'))}
					{step(3, <span className='text-[13px] font-[700]'>{t('footer.ios_add')}</span>, t('footer.ios_step3'))}
				</ol>
				<p className='text-[13px] leading-[1.5]' style={{ color: 'var(--text-secondary)' }}>{t('footer.ios_result')}</p>
				<p className='text-[12px] leading-[1.5] rounded-[10px] px-[12px] py-[9px]'
					style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}>{t('footer.ios_in_app')}</p>
				<button onClick={onClose}
					className='w-full py-[11px] rounded-[11px] text-[14px] font-[600] cursor-pointer'
					style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
					{t('footer.ios_ok')}
				</button>
			</div>
		</div>,
		document.body,
	)
}
