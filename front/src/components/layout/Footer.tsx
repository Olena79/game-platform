import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const Footer = () => {
	const { t } = useTranslation()

	return (
		<footer className='px-[20px] md:px-[32px] lg:px-[48px] py-[28px] md:py-[36px] border-t border-[rgba(255,255,255,0.06)] flex flex-col md:flex-row justify-center md:justify-between items-center gap-[10px] md:gap-0 relative z-10'>
			<Link
				to='/'
				className="font-amatic text-[15px] font-[800] text-white no-underline"
			>
				Mind
				<span className='text-[#44aaff] [text-shadow:0_0_20px_rgba(68,170,255,0.7)]'>
					Flow
				</span>
			</Link>
			<p className='text-[12px] text-[rgba(180,200,255,0.25)] text-center md:text-left'>
				{t('footer.copy')}
			</p>
		</footer>
	)
}
