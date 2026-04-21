import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LOGO_URL } from '../../config/logo'
import { useTranslation } from 'react-i18next'
import { Globe, Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../minicomponents/Modal'

// Not logged in — crimson / pink / red neon
const UserIconDefault = () => (
	<svg width='38' height='38' viewBox='0 0 38 38' fill='none' xmlns='http://www.w3.org/2000/svg'>
		<defs>
			<linearGradient id='ni-d-g' x1='7' y1='5' x2='31' y2='38' gradientUnits='userSpaceOnUse'>
				<stop offset='0%'   stopColor='#ff79c6' />
				<stop offset='48%'  stopColor='#cc1155' />
				<stop offset='100%' stopColor='#ff1744' />
			</linearGradient>
			<filter id='ni-d-f' x='-70%' y='-70%' width='240%' height='240%'>
				<feGaussianBlur in='SourceGraphic' stdDeviation='3' result='g1' />
				<feGaussianBlur in='SourceGraphic' stdDeviation='1.2' result='g2' />
				<feMerge>
					<feMergeNode in='g1' />
					<feMergeNode in='g1' />
					<feMergeNode in='g2' />
					<feMergeNode in='SourceGraphic' />
				</feMerge>
			</filter>
		</defs>
		<g filter='url(#ni-d-f)'>
			<circle cx='19' cy='13.5' r='5.8' stroke='url(#ni-d-g)' strokeWidth='1.9' />
			<path d='M5.5 37 C5.5 27.5 11 22.5 19 22.5 C27 22.5 32.5 27.5 32.5 37'
				stroke='url(#ni-d-g)' strokeWidth='1.9' strokeLinecap='round' />
		</g>
	</svg>
)

// Logged in — cyan → green neon
const UserIconLoggedIn = () => (
	<svg width='38' height='38' viewBox='0 0 38 38' fill='none' xmlns='http://www.w3.org/2000/svg'>
		<defs>
			<linearGradient id='ni-li-g' x1='7' y1='5' x2='31' y2='38' gradientUnits='userSpaceOnUse'>
				<stop offset='0%'   stopColor='#00e5ff' />
				<stop offset='100%' stopColor='#39ff6a' />
			</linearGradient>
			<filter id='ni-li-f' x='-70%' y='-70%' width='240%' height='240%'>
				<feGaussianBlur in='SourceGraphic' stdDeviation='3' result='g1' />
				<feGaussianBlur in='SourceGraphic' stdDeviation='1.2' result='g2' />
				<feMerge>
					<feMergeNode in='g1' />
					<feMergeNode in='g1' />
					<feMergeNode in='g2' />
					<feMergeNode in='SourceGraphic' />
				</feMerge>
			</filter>
		</defs>
		<g filter='url(#ni-li-f)'>
			<circle cx='19' cy='13.5' r='5.8' stroke='url(#ni-li-g)' strokeWidth='1.9' />
			<path d='M5.5 37 C5.5 27.5 11 22.5 19 22.5 C27 22.5 32.5 27.5 32.5 37'
				stroke='url(#ni-li-g)' strokeWidth='1.9' strokeLinecap='round' />
		</g>
	</svg>
)

export const Header = () => {
	const { t, i18n } = useTranslation()
	const { isLoggedIn, logout } = useAuth()
	const [menuOpen, setMenuOpen]       = useState(false)
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [logoutModal, setLogoutModal] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const toggleLang = () =>
		i18n.changeLanguage(i18n.language === 'ua' ? 'en' : 'ua')
	const currentLang = (i18n.language ?? 'ua').toUpperCase().slice(0, 2)

	const handleLogoutConfirm = () => {
		logout()
		setLogoutModal(false)
		setMenuOpen(false)
	}

	// Close dropdown on outside click
	useEffect(() => {
		if (!dropdownOpen) return
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setDropdownOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [dropdownOpen])

	return (
		<header className='border-b border-[rgba(100,160,255,0.12)] bg-[rgba(3,4,15,0.85)] backdrop-blur-[12px] sticky top-0 z-[100] relative'>
			{/* ── Main bar ── */}
			<div className='flex items-center justify-between px-[20px] md:px-[32px] lg:px-[48px] py-[14px] md:py-[18px]'>
				<Link to='/' className='no-underline flex items-center'>
					{LOGO_URL
						? <img src={LOGO_URL} alt='MindFlow' style={{ height: '34px', objectFit: 'contain' }} />
						: <span className='font-amatic text-[20px] md:text-[22px] font-[800] text-white'>
							Mind<span className='text-[#44aaff] [text-shadow:0_0_20px_rgba(68,170,255,0.7)]'>Flow</span>
						</span>
					}
				</Link>

				{/* Desktop nav */}
				<div className='hidden md:flex items-center gap-[24px] lg:gap-[32px] text-[13px] lg:text-[14px] text-[rgba(180,200,255,0.55)]'>
					<NavLink
						to='/games'
						className={({ isActive }) =>
							`hover:text-white transition-colors cursor-pointer ${isActive ? 'text-[rgba(180,200,255,0.9)]' : ''}`
						}
					>
						{t('nav.games')}
					</NavLink>
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

				{/* Desktop right */}
				<div className='hidden md:flex items-center gap-[10px]'>
					{isLoggedIn ? (
						<div ref={dropdownRef} className='relative'>
							<button
								onClick={() => setDropdownOpen(p => !p)}
								aria-label='Профіль'
								className='flex items-center transition-all duration-[250ms] hover:scale-[1.08] hover:drop-shadow-[0_0_10px_rgba(57,255,106,0.55)] cursor-pointer'
							>
								<UserIconLoggedIn />
							</button>

							{dropdownOpen && (
								<div className='absolute top-[calc(100%+10px)] right-0 bg-[rgba(3,6,25,0.97)] border border-[rgba(68,170,255,0.18)] rounded-[12px] py-[6px] min-w-[130px] backdrop-blur-[14px] shadow-[0_8px_28px_rgba(0,0,0,0.5)] z-[200]'>
									<button
										onClick={() => { setDropdownOpen(false); setLogoutModal(true) }}
										className='w-full px-[16px] py-[10px] text-[13px] text-[rgba(255,90,160,0.8)] hover:text-[#ff5fa0] hover:bg-[rgba(255,90,160,0.06)] transition-all cursor-pointer text-left rounded-[8px]'
									>
										{t('auth.btn_logout')}
									</button>
								</div>
							)}
						</div>
					) : (
						<Link
							to='/auth'
							aria-label='Профіль'
							className='flex items-center transition-all duration-[250ms] hover:scale-[1.08] hover:drop-shadow-[0_0_10px_rgba(255,23,68,0.5)] cursor-pointer'
						>
							<UserIconDefault />
						</Link>
					)}

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
					<NavLink
						to='/games'
						className='text-[16px] text-[rgba(180,200,255,0.7)] hover:text-white transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)]'
						onClick={() => setMenuOpen(false)}
					>
						{t('nav.games')}
					</NavLink>
					<a
						className='text-[16px] text-[rgba(180,200,255,0.7)] hover:text-white transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)]'
						onClick={() => setMenuOpen(false)}
					>
						{t('nav.about')}
					</a>

					{isLoggedIn ? (
						<button
							onClick={() => { setMenuOpen(false); setLogoutModal(true) }}
							className='text-[16px] text-[rgba(255,90,160,0.8)] hover:text-[#ff5fa0] transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)] flex items-center gap-[10px] text-left'
						>
							{t('auth.btn_logout')}
						</button>
					) : (
						<Link
							to='/auth'
							className='text-[16px] text-[#44aaff] [text-shadow:0_0_12px_rgba(68,170,255,0.4)] hover:text-white transition-colors cursor-pointer py-[14px] border-b border-[rgba(255,255,255,0.06)] flex items-center gap-[10px]'
							onClick={() => setMenuOpen(false)}
						>
							{t('auth.tab_login')}
						</Link>
					)}

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

			<Modal
				isOpen={logoutModal}
				onClose={() => setLogoutModal(false)}
				title={t('auth.logout_confirm_title')}
				message={t('auth.logout_confirm_msg')}
				variant='warn'
				onConfirm={handleLogoutConfirm}
				confirmLabel={t('auth.logout_confirm_yes')}
				cancelLabel={t('auth.logout_confirm_no')}
			/>
		</header>
	)
}
