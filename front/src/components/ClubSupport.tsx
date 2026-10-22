import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Heart, Copy, Check, ExternalLink } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/**
 * «Я хочу допомогти клубу» — a donation to the club itself (not to a game's
 * gamemaster, which is «Дяка» on a game card). The club's Monobank jar:
 * its link and its card number. Deliberately not the account holder's IBAN
 * or tax number — those would be public on every page (2026-10-22).
 */
export const CLUB_JAR_URL = 'https://send.monobank.ua/jar/6bBvmj8uKT'
const CLUB_JAR_CARD = '4874100034895410'
const cardFormatted = CLUB_JAR_CARD.replace(/(\d{4})(?=\d)/g, '$1 ')

export function ClubSupportButton({ className = '' }: { className?: string }) {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	const [open, setOpen] = useState(false)
	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className={`inline-flex items-center justify-center gap-[8px] px-[18px] py-[11px] rounded-[12px] text-[14px] font-[600] cursor-pointer transition-all hover:-translate-y-[1px] whitespace-nowrap ${className}`}
				style={isDark
					? { color: '#ffcf6b', background: 'rgba(255,190,80,0.07)', border: '1px solid rgba(255,190,80,0.4)' }
					: { color: 'var(--accent)', background: 'rgba(192,83,58,0.06)', border: '1px solid var(--accent)' }}
			>
				<Heart size={15} strokeWidth={2} />
				{t('club_support.btn')}
			</button>
			{open && <ClubSupportModal onClose={() => setOpen(false)} />}
		</>
	)
}

function ClubSupportModal({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(CLUB_JAR_CARD)
			setCopied(true)
			setTimeout(() => setCopied(false), 2500)
		} catch { /* no clipboard: the number can be selected by hand */ }
	}

	const muted = isDark ? 'rgba(160,180,230,0.65)' : 'var(--text-muted)'
	const accent = isDark ? '#ffcf6b' : 'var(--accent)'

	// Above the header and the phone menu, centred in what is visible
	return createPortal(
		<div className='fixed inset-0 z-[200] flex items-center justify-center p-[16px] overflow-y-auto'
			style={isDark
				? { background: 'rgba(3,4,15,0.72)', backdropFilter: 'blur(4px)' }
				: { background: 'rgba(240,235,228,0.8)', backdropFilter: 'blur(4px)' }}
			onClick={onClose}>
			<div role='dialog' aria-modal='true' aria-label={t('club_support.title')}
				className='w-full max-w-[360px] max-h-[85dvh] overflow-y-auto rounded-[20px] p-[24px] flex flex-col gap-[16px]'
				style={isDark
					? { background: '#0b0d1a', border: '1px solid rgba(255,190,80,0.25)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }
					: { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}
				onClick={e => e.stopPropagation()}>
				<div className='flex items-center justify-between gap-[10px]'>
					<div className='flex items-center gap-[8px]'>
						<Heart size={16} style={{ color: accent }} />
						<span className='text-[15px] font-[700]' style={{ color: isDark ? 'rgba(230,236,255,0.95)' : 'var(--text-primary)' }}>
							{t('club_support.title')}
						</span>
					</div>
					<button onClick={onClose} aria-label={t('club_support.close')}
						className='w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-all flex-shrink-0'
						style={isDark
							? { color: 'rgba(180,200,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }
							: { color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
						<span className='text-[14px]'>✕</span>
					</button>
				</div>

				<p className='text-[14px] leading-[1.6]' style={{ color: isDark ? 'rgba(210,222,255,0.88)' : 'var(--text-secondary)' }}>
					{t('club_support.text')}
				</p>

				<a href={CLUB_JAR_URL} target='_blank' rel='noopener noreferrer'
					className='flex items-center justify-center gap-[8px] py-[12px] rounded-[12px] text-[14px] font-[700] no-underline transition-all hover:-translate-y-[1px]'
					style={isDark
						? { color: '#1a1205', background: 'linear-gradient(135deg, #ffd27a, #ffb347)' }
						: { color: '#fff', background: 'var(--accent)' }}>
					{t('club_support.jar_btn')}
					<ExternalLink size={14} strokeWidth={2.2} />
				</a>

				<div className='flex flex-col gap-[8px]'>
					<span className='text-[11px] uppercase tracking-[0.5px]' style={{ color: muted }}>
						{t('club_support.card_label')}
					</span>
					<div className='flex items-center justify-between gap-[8px] rounded-[10px] px-[12px] py-[10px]'
						style={isDark
							? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
							: { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
						<span className='font-mono text-[14px] sm:text-[15px] font-[700] tracking-[0.5px] whitespace-nowrap select-all' style={{ color: isDark ? 'rgba(230,236,255,0.95)' : 'var(--text-primary)' }}>
							{cardFormatted}
						</span>
						<button onClick={copy} aria-label={t('club_support.copy')}
							className='flex items-center gap-[5px] text-[12px] font-[600] px-[8px] py-[5px] rounded-[8px] cursor-pointer flex-shrink-0 whitespace-nowrap'
							style={{ color: accent, border: `1px solid ${isDark ? 'rgba(255,190,80,0.35)' : 'var(--accent)'}` }}>
							{copied ? <Check size={13} /> : <Copy size={13} />}
							{/* Very narrow phones: the icon alone */}
							<span className='hidden min-[360px]:inline'>{copied ? t('club_support.copied') : t('club_support.copy')}</span>
						</button>
					</div>
				</div>

				<p className='text-[12px] text-center' style={{ color: muted }}>{t('club_support.thanks')}</p>
			</div>
		</div>,
		document.body,
	)
}
