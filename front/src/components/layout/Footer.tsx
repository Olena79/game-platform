import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FooterLogo = () => (
	<svg width="320" height="76" viewBox="0 0 160 38" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="19" cy="19" r="16" stroke="#cc44ff" strokeWidth="0.8" fill="none" strokeDasharray="3 2"
			style={{ filter: 'drop-shadow(0 0 2px rgba(204,68,255,0.35))' }} />
		<circle cx="19" cy="19" r="13" stroke="#00ffe1" strokeWidth="1.1" fill="none"
			style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,225,0.4))' }} />
		<circle cx="19" cy="19" r="10" fill="#0a0d20" />
		<text x="19" y="23" textAnchor="middle" fontFamily="Orbitron,sans-serif" fontSize="9" fontWeight="900" fill="#00ffe1"
			style={{ filter: 'drop-shadow(0 0 4px #00ffe1)' }}>G</text>
		<text x="42" y="11" fontFamily="Syncopate,sans-serif" fontSize="5.5" fontWeight="400" fill="#00ffe1" letterSpacing="2.5"
			style={{ filter: 'drop-shadow(0 0 3px rgba(0,255,225,0.4))' }}>CLUB</text>
		<text x="42" y="21" fontFamily="Orbitron,sans-serif" fontSize="9" fontWeight="700" fill="#ffffff"
			style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.2))' }}>GAMES OF</text>
		<text x="42" y="31" fontFamily="Orbitron,sans-serif" fontSize="9" fontWeight="700" fill="#cc44ff"
			style={{ filter: 'drop-shadow(0 0 5px rgba(204,68,255,0.5))' }}>SENSES</text>
		<line x1="42" y1="35" x2="154" y2="35" stroke="#cc44ff" strokeWidth="0.6"
			style={{ filter: 'drop-shadow(0 0 2px #cc44ff)' }} />
	</svg>
)

export const Footer = () => {
	const { t } = useTranslation()

	return (
		<footer className='px-[20px] md:px-[32px] lg:px-[48px] py-[28px] md:py-[36px] border-t border-[rgba(255,255,255,0.06)] flex flex-col md:flex-row justify-center md:justify-between items-center gap-[10px] md:gap-0 relative z-10'>
			<Link to='/' className='no-underline flex items-center'>
				<FooterLogo />
			</Link>
			<p className='text-[12px] text-[rgba(180,200,255,0.25)] text-center md:text-left'>
				{t('footer.copy')}
			</p>
		</footer>
	)
}
