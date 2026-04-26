import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FooterLogo = () => (
	<svg width="234" height="65" viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="33" cy="36" r="31" stroke="#cc44ff" strokeWidth="1" fill="none" strokeDasharray="3.5 2.5"
			style={{ filter: 'drop-shadow(0 0 3px rgba(204,68,255,0.35))' }} />
		<circle cx="33" cy="36" r="25" stroke="#00ffe1" strokeWidth="1.6" fill="none"
			style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,225,0.4))' }} />
		<circle cx="33" cy="36" r="19" fill="#0a0d20" />
		<text x="33" y="41" textAnchor="middle" fontFamily="Orbitron,sans-serif" fontSize="17" fontWeight="900" fill="#00ffe1"
			style={{ filter: 'drop-shadow(0 0 7px #00ffe1)' }}>G</text>
		<text x="74" y="20" fontFamily="Syncopate,sans-serif" fontSize="9" fontWeight="400" fill="#00ffe1" letterSpacing="4"
			style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,225,0.4))' }}>КЛУБ</text>
		<text x="74" y="42" fontFamily="Orbitron,sans-serif" fontSize="18" fontWeight="700" fill="#ffffff"
			style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.18))' }}>ІГРИ</text>
		<text x="74" y="62" fontFamily="Orbitron,sans-serif" fontSize="18" fontWeight="700" fill="#cc44ff"
			style={{ filter: 'drop-shadow(0 0 7px rgba(204,68,255,0.55))' }}>СЕНСІВ</text>
		<line x1="74" y1="67" x2="232" y2="67" stroke="#cc44ff" strokeWidth="0.8"
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
