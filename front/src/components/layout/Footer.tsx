import React from 'react'
import { Link } from 'react-router-dom'
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

	return (
		<footer
			className='px-[20px] md:px-[32px] lg:px-[48px] py-[28px] md:py-[36px] border-t flex flex-col md:flex-row justify-center md:justify-between items-center gap-[10px] md:gap-0 relative z-10 transition-colors duration-[250ms]'
			style={{ borderTopColor: 'var(--footer-border)' }}
		>
			<Link to='/' className='no-underline flex items-center'>
				<FooterLogo isDark={isDark} />
			</Link>
			<p className='text-[12px] text-center md:text-left' style={{ color: 'var(--footer-text)' }}>
				{t('footer.copy')}
			</p>
		</footer>
	)
}
