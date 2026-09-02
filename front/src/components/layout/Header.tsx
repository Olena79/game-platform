import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'

const LogoSvg = ({ isDark }: { isDark: boolean }) => (
	<svg width="210" height="58" viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="33" cy="36" r="31" stroke={isDark ? '#cc44ff' : 'var(--accent)'} strokeWidth="1" fill="none" strokeDasharray="3.5 2.5"
			style={{ filter: isDark ? 'drop-shadow(0 0 3px rgba(204,68,255,0.4))' : undefined }} />
		<circle cx="33" cy="36" r="25" stroke={isDark ? '#00ffe1' : 'var(--text-primary)'} strokeWidth="1.6" fill="none"
			style={{ filter: isDark ? 'drop-shadow(0 0 5px rgba(0,255,225,0.5))' : undefined }} />
		<circle cx="33" cy="36" r="19" fill={isDark ? '#0a0d20' : '#fff'} />
		<text x="33" y="41" textAnchor="middle" fontFamily="Orbitron,sans-serif" fontSize="17" fontWeight="900" fill={isDark ? '#00ffe1' : 'var(--accent)'}
			style={{ filter: isDark ? 'drop-shadow(0 0 8px #00ffe1)' : undefined }}>G</text>
		<text x="74" y="20" fontFamily="Syncopate,sans-serif" fontSize="9" fontWeight="400" fill={isDark ? '#00ffe1' : 'var(--accent)'} letterSpacing="4"
			style={{ filter: isDark ? 'drop-shadow(0 0 5px rgba(0,255,225,0.5))' : undefined }}>КЛУБ</text>
		<text x="74" y="42" fontFamily="Orbitron,sans-serif" fontSize="18" fontWeight="700" fill={isDark ? '#ffffff' : 'var(--text-primary)'}
			style={{ filter: isDark ? 'drop-shadow(0 0 6px rgba(255,255,255,0.2))' : undefined }}>ІГРИ</text>
		<text x="74" y="62" fontFamily="Orbitron,sans-serif" fontSize="18" fontWeight="700" fill={isDark ? '#cc44ff' : 'var(--accent)'}
			style={{ filter: isDark ? 'drop-shadow(0 0 8px rgba(204,68,255,0.6))' : undefined }}>СЕНСІВ</text>
		<line x1="74" y1="67" x2="232" y2="67" stroke={isDark ? '#cc44ff' : 'var(--accent)'} strokeWidth="0.9"
			style={{ filter: isDark ? 'drop-shadow(0 0 3px #cc44ff)' : undefined }} />
	</svg>
)
import { Globe, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../minicomponents/Modal'
import { TelegramStatusIcon } from './TelegramStatusIcon'

// Not logged in — crimson/pink neon (dark) or terracotta (light)
const UserIconDefault = ({ isDark }: { isDark: boolean }) => (
	<svg width='38' height='38' viewBox='0 0 38 38' fill='none' xmlns='http://www.w3.org/2000/svg'>
		<defs>
			<linearGradient id='ni-d-g' x1='7' y1='5' x2='31' y2='38' gradientUnits='userSpaceOnUse'>
				<stop offset='0%'   stopColor={isDark ? '#ff79c6' : '#c0533a'} />
				<stop offset='48%'  stopColor={isDark ? '#cc1155' : '#9b3a25'} />
				<stop offset='100%' stopColor={isDark ? '#ff1744' : '#7a2a15'} />
			</linearGradient>
			{isDark && (
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
			)}
		</defs>
		<g filter={isDark ? 'url(#ni-d-f)' : undefined}>
			<circle cx='19' cy='13.5' r='5.8' stroke='url(#ni-d-g)' strokeWidth='1.9' />
			<path d='M5.5 37 C5.5 27.5 11 22.5 19 22.5 C27 22.5 32.5 27.5 32.5 37'
				stroke='url(#ni-d-g)' strokeWidth='1.9' strokeLinecap='round' />
		</g>
	</svg>
)

// Logged in — cyan/green neon (dark) or terracotta (light)
const UserIconLoggedIn = ({ isDark }: { isDark: boolean }) => (
	<svg width='38' height='38' viewBox='0 0 38 38' fill='none' xmlns='http://www.w3.org/2000/svg'>
		<defs>
			<linearGradient id='ni-li-g' x1='7' y1='5' x2='31' y2='38' gradientUnits='userSpaceOnUse'>
				<stop offset='0%'   stopColor={isDark ? '#00e5ff' : '#c0533a'} />
				<stop offset='100%' stopColor={isDark ? '#39ff6a' : '#7a2a15'} />
			</linearGradient>
			{isDark && (
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
			)}
		</defs>
		<g filter={isDark ? 'url(#ni-li-f)' : undefined}>
			<circle cx='19' cy='13.5' r='5.8' stroke='url(#ni-li-g)' strokeWidth='1.9' />
			<path d='M5.5 37 C5.5 27.5 11 22.5 19 22.5 C27 22.5 32.5 27.5 32.5 37'
				stroke='url(#ni-li-g)' strokeWidth='1.9' strokeLinecap='round' />
		</g>
	</svg>
)

export const Header = () => {
	const { t, i18n } = useTranslation()
	const { isLoggedIn, logout } = useAuth()
	const { isDark, toggleTheme } = useTheme()
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [logoutModal, setLogoutModal] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const toggleLang = () =>
		i18n.changeLanguage(i18n.language === 'ua' ? 'en' : 'ua')
	const currentLang = (i18n.language ?? 'ua').toUpperCase().slice(0, 2)

	const handleLogoutConfirm = () => {
		logout()
		setLogoutModal(false)
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
		<header
			className='border-b backdrop-blur-[12px] sticky top-0 z-[100] transition-colors duration-[250ms]'
			style={{
				borderBottomColor: 'var(--border-subtle)',
				background: 'var(--header-bg)',
				paddingTop: 'env(safe-area-inset-top, 0px)',
			}}
		>
			{/* ── Main bar ── */}
			<div className='flex items-center justify-between px-[20px] md:px-[32px] lg:px-[48px] py-[14px] md:py-[18px]'>
				<Link to='/' className='no-underline flex items-center'>
					<LogoSvg isDark={isDark} />
				</Link>

				{/* Desktop nav */}
				<div
					className='hidden md:flex items-center gap-[24px] lg:gap-[32px] text-[13px] lg:text-[14px]'
					style={{ color: 'var(--text-secondary)' }}
				>
					<NavLink
						to='/games'
						className='hover:opacity-100 transition-all cursor-pointer'
						style={({ isActive }) => ({
							color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
						})}
					>
						{t('nav.games')}
					</NavLink>
					<NavLink
						to='/community'
						className='hover:opacity-100 transition-all cursor-pointer'
						style={({ isActive }) => ({
							color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
						})}
					>
						{t('nav.community')}
					</NavLink>
					<button
						onClick={toggleLang}
						className='flex items-center gap-[5px] transition-all cursor-pointer'
						style={{ color: 'var(--text-secondary)' }}
					>
						<Globe size={13} strokeWidth={1.8} />
						<span className='text-[12px] font-[500]'>{currentLang}</span>
					</button>
					{/* Theme toggle */}
					<button
						onClick={toggleTheme}
						title={isDark ? 'Світла тема' : 'Темна тема'}
						className='theme-toggle flex items-center justify-center w-[28px] h-[28px] rounded-full transition-all cursor-pointer hover:scale-[1.12]'
						style={{
							background: isDark ? 'rgba(255,220,100,0.08)' : 'rgba(192,83,58,0.10)',
							border: isDark ? '1px solid rgba(255,220,100,0.22)' : '1px solid rgba(192,83,58,0.25)',
							color: isDark ? 'rgba(255,220,100,0.85)' : 'rgba(192,83,58,0.85)',
						}}
					>
						{isDark ? <Sun size={13} strokeWidth={2} /> : <Moon size={13} strokeWidth={2} />}
					</button>
				</div>

				{/* Desktop right */}
				<div className='hidden md:flex items-center gap-[10px]'>
					{isLoggedIn && <TelegramStatusIcon size={38} />}
					{isLoggedIn ? (
						<div ref={dropdownRef} className='relative'>
							<button
								onClick={() => setDropdownOpen(p => !p)}
								aria-label='Профіль'
								className='flex items-center transition-all duration-[250ms] hover:scale-[1.08] hover:drop-shadow-[0_0_10px_rgba(57,255,106,0.55)] cursor-pointer'
							>
								<UserIconLoggedIn isDark={isDark} />
							</button>

							{dropdownOpen && (
								<div
									className='absolute top-[calc(100%+10px)] right-0 rounded-[12px] py-[6px] min-w-[130px] backdrop-blur-[14px] shadow-[0_8px_28px_rgba(0,0,0,0.2)] z-[200]'
									style={{
										background: 'var(--bg-elevated)',
										border: '1px solid var(--border-subtle)',
									}}
								>
									<button
										onClick={() => { setDropdownOpen(false); setLogoutModal(true) }}
										className='w-full px-[16px] py-[10px] text-[13px] text-[rgba(255,105,175,0.95)] hover:text-[#ff5fa0] hover:bg-[rgba(255,90,160,0.08)] transition-all cursor-pointer text-left rounded-[8px]'
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
							<UserIconDefault isDark={isDark} />
						</Link>
					)}

					<Link to='/game'>
						<button
							className='cta-btn bg-transparent px-[14px] md:px-[22px] py-[8px] md:py-[10px] rounded-[10px] text-[13px] md:text-[14px] font-[500] transition-all cursor-pointer whitespace-nowrap'
							style={{
								color: 'var(--text-primary)',
								border: '1px solid var(--border-medium)',
							}}
						>
							{t('nav.enter')}
						</button>
					</Link>
				</div>

				{/* Mobile: language + theme toggles */}
				<div className='md:hidden flex items-center gap-[12px]'>
					<button
						className='flex items-center gap-[6px] transition-colors cursor-pointer'
						style={{ color: 'var(--text-secondary)' }}
						onClick={toggleLang}
						aria-label='Мова'
					>
						<Globe size={16} strokeWidth={1.8} />
						<span className='text-[13px] font-[500]'>{currentLang}</span>
					</button>
					<button
						onClick={toggleTheme}
						title={isDark ? 'Світла тема' : 'Темна тема'}
						className='theme-toggle flex items-center justify-center w-[26px] h-[26px] rounded-full transition-all cursor-pointer'
						style={{
							background: isDark ? 'rgba(255,220,100,0.08)' : 'rgba(192,83,58,0.10)',
							border: isDark ? '1px solid rgba(255,220,100,0.22)' : '1px solid rgba(192,83,58,0.25)',
							color: isDark ? 'rgba(255,220,100,0.85)' : 'rgba(192,83,58,0.85)',
						}}
					>
						{isDark ? <Sun size={12} strokeWidth={2} /> : <Moon size={12} strokeWidth={2} />}
					</button>
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
