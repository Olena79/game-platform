import React from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Smartphone } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'

const FooterLogo = ({ isDark }: { isDark: boolean }) => (
	<svg width="234" height="65" viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="33" cy="36" r="31" stroke={isDark ? '#cc44ff' : 'var(--accent)'} strokeWidth="1" fill="none" strokeDasharray="3.5 2.5"
			style={{ filter: isDark ? 'drop-shadow(0 0 3px rgba(204,68,255,0.35))' : undefined }} />
		<circle cx="33" cy="36" r="25" stroke={isDark ? '#00ffe1' : 'var(--text-primary)'} strokeWidth="1.6" fill="none"
			style={{ filter: isDark ? 'drop-shadow(0 0 4px rgba(0,255,225,0.4))' : undefined }} />
		<circle cx="33" cy="36" r="19" fill={isDark ? '#0a0d20' : '#fff'} />
		<text x="33" y="41" textAnchor="middle" fontFamily="Orbitron,sans-serif" fontSize="17" fontWeight="900" fill={isDark ? '#00ffe1' : 'var(--accent)'}
			style={{ filter: isDark ? 'drop-shadow(0 0 7px #00ffe1)' : undefined }}>G</text>
		<text x="74" y="20" fontFamily="Syncopate,sans-serif" fontSize="9" fontWeight="400" fill={isDark ? '#00ffe1' : 'var(--accent)'} letterSpacing="4"
			style={{ filter: isDark ? 'drop-shadow(0 0 4px rgba(0,255,225,0.4))' : undefined }}>КЛУБ</text>
		<text x="74" y="42" fontFamily="Orbitron,sans-serif" fontSize="18" fontWeight="700" fill={isDark ? '#ffffff' : 'var(--text-primary)'}
			style={{ filter: isDark ? 'drop-shadow(0 0 5px rgba(255,255,255,0.18))' : undefined }}>ІГРИ</text>
		<text x="74" y="62" fontFamily="Orbitron,sans-serif" fontSize="18" fontWeight="700" fill={isDark ? '#cc44ff' : 'var(--accent)'}
			style={{ filter: isDark ? 'drop-shadow(0 0 7px rgba(204,68,255,0.55))' : undefined }}>СЕНСІВ</text>
		<line x1="74" y1="67" x2="232" y2="67" stroke={isDark ? '#cc44ff' : 'var(--accent)'} strokeWidth="0.8"
			style={{ filter: isDark ? 'drop-shadow(0 0 2px #cc44ff)' : undefined }} />
	</svg>
)

export const Footer = () => {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	const { canInstall, needsManualSteps, isMobile, isStandalone, promptInstall } = useInstallPrompt()
	const [showSteps, setShowSteps] = useState(false)
	const navigate = useNavigate()

	return (
		<footer
			className='px-[20px] md:px-[32px] lg:px-[48px] py-[28px] md:py-[36px] mobile-footer-clear border-t flex flex-col md:flex-row justify-center md:justify-between items-center gap-[16px] md:gap-0 relative z-10 transition-colors duration-[250ms]'
			style={{ borderTopColor: 'var(--footer-border)' }}
		>
			<Link to='/' className='no-underline flex items-center'>
				<FooterLogo isDark={isDark} />
			</Link>
			<div className='flex flex-col md:flex-row items-center gap-[16px] md:gap-[24px]'>
				{/* Offered here rather than as a popup: the browser's own prompt
				    reaches only some Android users, and never an iPhone. */}
				{!isStandalone && isMobile && (canInstall || needsManualSteps) && (
					<div className='flex flex-col items-center gap-[6px]'>
						<button
							onClick={() => { if (canInstall) void promptInstall(); else setShowSteps(v => !v) }}
							className='flex items-center gap-[7px] rounded-[10px] px-[14px] py-[7px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-110'
							style={isDark
								? { background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }
								: { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
						>
							<Smartphone size={13} /> {t('footer.install_app')}
						</button>
						{showSteps && (
							<p className='text-[11px] leading-[1.45] text-center max-w-[260px]' style={{ color: 'var(--footer-text)' }}>
								{t('footer.install_ios_steps')}
							</p>
						)}
					</div>
				)}
				<p className='text-[12px] text-center md:text-left' style={{ color: 'var(--footer-text)' }}>
					{t('footer.copy')}
				</p>
				<div className='flex gap-[16px]'>
					<Link
						to='/privacy-policy'
						className='text-[12px] no-underline transition-colors hover:opacity-80'
						style={{ color: isDark ? 'rgba(180,200,255,0.7)' : 'var(--text-muted)' }}
					>
						{t('nav.privacy_policy')}
					</Link>
					<span style={{ color: isDark ? 'rgba(180,200,255,0.3)' : 'var(--border-subtle)' }}>•</span>
					<Link
						to='/terms-of-service'
						className='text-[12px] no-underline transition-colors hover:opacity-80'
						style={{ color: isDark ? 'rgba(180,200,255,0.7)' : 'var(--text-muted)' }}
					>
						{t('nav.terms_of_service')}
					</Link>
					{/* The administrator's door: invisible, right after the last
					    link. Hiding it protects nothing — the server asks for the
					    passphrase and a Telegram code — it only keeps it out of view. */}
					<button
						type='button'
						aria-hidden='true'
						tabIndex={-1}
						onClick={() => navigate('/admin')}
						className='w-[28px] h-[28px] md:h-[18px] opacity-0 cursor-default'
					/>
				</div>
			</div>
		</footer>
	)
}
