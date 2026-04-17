// src/components/layout/Header.tsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Menu, X } from 'lucide-react'

const UserIcon3D = () => (
	<svg width='34' height='34' viewBox='0 0 34 34' fill='none' xmlns='http://www.w3.org/2000/svg'>
		<defs>
			<radialGradient id='hdr-user-orb' cx='36%' cy='30%' r='65%'>
				<stop offset='0%' stopColor='#2255cc' />
				<stop offset='60%' stopColor='#1133aa' />
				<stop offset='100%' stopColor='#060d2a' />
			</radialGradient>
			<filter id='hdr-user-shd' x='-30%' y='-30%' width='160%' height='160%'>
				<feDropShadow dx='0' dy='2' stdDeviation='3' floodColor='#4477ff' floodOpacity='0.6' />
			</filter>
		</defs>
		<circle cx='17' cy='17' r='15.5' fill='url(#hdr-user-orb)' filter='url(#hdr-user-shd)' />
		<ellipse cx='12' cy='10.5' rx='5' ry='3' fill='white' fillOpacity='0.18' transform='rotate(-20 12 10.5)' />
		<circle cx='17' cy='13' r='5' fill='white' fillOpacity='0.95' />
		<path d='M5.5 29C5.5 22.5 10.5 19 17 19C23.5 19 28.5 22.5 28.5 29Z' fill='white' fillOpacity='0.92' />
	</svg>
)

export const Header = () => {
	const { t, i18n } = useTranslation()
	const [menuOpen, setMenuOpen] = useState(false)

	const toggleLang = () =>
		i18n.changeLanguage(i18n.language === 'ua' ? 'en' : 'ua')
	const currentLang = (i18n.language ?? 'ua').toUpperCase().slice(0, 2)

	return (
		<header className='border-b border-[rgba(100,160,255,0.12)] bg-[rgba(3,4,15,0.85)] backdrop-blur-[12px] sticky top-0 z-[100] relative'>
			{/* ── Main bar ── */}
			<div className='flex items-center justify-between px-[20px] md:px-[32px] lg:px-[48px] py-[14px] md:py-[18px]'>
				<Link
					to='/'
					className='font-amatic text-[20px] md:text-[22px] font-[800] text-white no-underline'
				>
					Mind
					<span className='text-[#44aaff] [text-shadow:0_0_20px_rgba(68,170,255,0.7)]'>
						Flow
					</span>
				</Link>

				{/* Desktop nav — tablet+ */}
				<div className='hidden md:flex items-center gap-[24px] lg:gap-[32px] text-[13px] lg:text-[14px] text-[rgba(180,200,255,0.55)]'>
					<a className='hover:text-white transition-colors cursor-pointer'>
						{t('nav.games')}
					</a>
					<a className='hover:text-white transition-colors cursor-pointer'>
						{t('nav.about')}
					</a>
					<button
						onClick={toggleLang}
						className='flex items-center gap-[5px] hover:text-white transition-colors cursor-pointer'
					>
						<Globe size={13} strokeWidth={1.8} />
						<span className='text-[12px] font-[500]'>{currentLang}</span>
					</button>
				</div>

				{/* Desktop enter button + user icon */}
				<div className='hidden md:flex items-center gap-[10px]'>
					<Link
						to='/auth'
						aria-label='Профіль'
						className='flex items-center transition-all duration-[250ms] hover:scale-[1.08] hover:drop-shadow-[0_0_8px_rgba(68,170,255,0.6)] cursor-pointer'
					>
						<UserIcon3D />
					</Link>
					<Link to='/game'>
						<button className='bg-transparent text-white border border-[rgba(68,170,255,0.5)] px-[14px] md:px-[22px] py-[8px] md:py-[10px] rounded-[10px] text-[13px] md:text-[14px] font-[500] transition-all hover:border-[rgba(192,127,255,0.7)] hover:shadow-[0_0_20px_rgba(192,127,255,0.2)] cursor-pointer whitespace-nowrap'>
							{t('nav.enter')}
						</button>
					</Link>
				</div>

				{/* Mobile burger */}
				<button
					className='md:hidden flex items-center justify-center w-[36px] h-[36px] text-[rgba(180,200,255,0.7)] hover:text-white transition-colors cursor-pointer'
					onClick={() => setMenuOpen(p => !p)}
					aria-label='Меню'
				>
					{menuOpen ? (
						<X size={22} strokeWidth={1.8} />
					) : (
						<Menu size={22} strokeWidth={1.8} />
					)}
				</button>
			</div>

			{/* ── Mobile dropdown ── */}
			<div
				className={`absolute top-full left-0 right-0 bg-[rgba(3,4,15,0.97)] backdrop-blur-[20px] border-b border-[rgba(100,160,255,0.12)] flex flex-col md:hidden overflow-hidden transition-all duration-[250ms] ${
					menuOpen
						? 'opacity-100 max-h-[420px]'
						: 'opacity-0 max-h-0 pointer-events-none'
				}`}
			>
				<div className='px-[24px] py-[8px] flex flex-col'>
					<a
						className='text-[16px] text-[rgba(180,200,255,0.7)] hover:text-white transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)]'
						onClick={() => setMenuOpen(false)}
					>
						{t('nav.games')}
					</a>
					<a
						className='text-[16px] text-[rgba(180,200,255,0.7)] hover:text-white transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)]'
						onClick={() => setMenuOpen(false)}
					>
						{t('nav.about')}
					</a>

					<Link
						to='/auth'
						className='text-[16px] text-[#44aaff] [text-shadow:0_0_12px_rgba(68,170,255,0.4)] hover:text-white transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)] flex items-center gap-[10px]'
						onClick={() => setMenuOpen(false)}
					>
						{t('auth.tab_login')}
					</Link>

					<div className='flex items-center justify-between py-[14px] border-b border-[rgba(255,255,255,0.06)]'>
						<span className='text-[13px] text-[rgba(180,200,255,0.35)] font-[300]'>
							{t('nav.lang_label')}
						</span>
						<button
							onClick={toggleLang}
							className='flex items-center gap-[6px] text-[rgba(180,200,255,0.6)] hover:text-[#44aaff] transition-colors cursor-pointer'
						>
							<Globe size={14} strokeWidth={1.8} />
							<span className='text-[12px] font-[500]'>{currentLang}</span>
						</button>
					</div>

					<div className='py-[16px]'>
						<Link to='/game' onClick={() => setMenuOpen(false)}>
							<button className='w-full bg-transparent text-white border border-[rgba(68,170,255,0.5)] py-[12px] rounded-[10px] text-[14px] font-[500] transition-all hover:border-[rgba(192,127,255,0.7)] hover:shadow-[0_0_20px_rgba(192,127,255,0.2)] cursor-pointer'>
								{t('nav.enter')}
							</button>
						</Link>
					</div>
				</div>
			</div>
		</header>
	)
}
