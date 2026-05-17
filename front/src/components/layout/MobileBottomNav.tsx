import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { Gamepad2, LogIn, LogOut, Play, Users } from 'lucide-react'
import { Modal } from '../minicomponents/Modal'
import { useTheme } from '../../context/ThemeContext'

type NavBtnProps = {
	icon: React.ReactNode
	label: string
	active?: boolean
	onClick?: () => void
}

const ACTIVE = '#0fffc8'

const NavBtn = ({ icon, label, active, onClick }: NavBtnProps) => (
	<button
		onClick={onClick}
		className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] cursor-pointer transition-all'
		style={{
			color: active ? ACTIVE : 'var(--text-secondary)',
			background: active ? 'rgba(15,255,200,0.1)' : 'transparent',
		}}
	>
		{icon}
		<span className='text-[11px] font-[500] uppercase tracking-[0.05em]'>{label}</span>
	</button>
)

export const MobileBottomNav = () => {
	const { t } = useTranslation()
	const { isLoggedIn, logout } = useAuth()
	const { isDark } = useTheme()
	const [logoutModal, setLogoutModal] = useState(false)
	const INACTIVE = isDark ? 'rgba(200,215,255,0.9)' : 'var(--text-secondary)'
	const NAV_ACTIVE = isDark ? '#0fffc8' : 'var(--accent)'
	const NAV_ACTIVE_BG = isDark ? 'rgba(15,255,200,0.1)' : 'rgba(192,83,58,0.08)'

	return (
		<>
			<nav
				className='md:hidden fixed bottom-0 left-0 right-0 z-[100] flex transition-colors duration-[250ms]'
				style={{
					background: 'var(--bg-elevated)',
					borderTop: '1px solid var(--border-subtle)',
					backdropFilter: 'blur(16px)',
					WebkitBackdropFilter: 'blur(16px)',
					height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
					paddingBottom: 'env(safe-area-inset-bottom, 0px)',
					boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
				}}
			>
				{/* ігри */}
				<NavLink
					to='/games'
					className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
					style={({ isActive }) => ({
						color: isActive ? NAV_ACTIVE : INACTIVE,
						background: isActive ? NAV_ACTIVE_BG : 'transparent',
					})}
				>
					<Gamepad2 size={20} strokeWidth={1.6} />
					<span className='text-[11px] font-[500] uppercase tracking-[0.05em]'>{t('nav.games')}</span>
				</NavLink>

				{/* спільноти */}
				<NavLink
					to='/community'
					className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
					style={({ isActive }) => ({
						color: isActive ? NAV_ACTIVE : INACTIVE,
						background: isActive ? NAV_ACTIVE_BG : 'transparent',
					})}
				>
					<Users size={20} strokeWidth={1.6} />
					<span className='text-[11px] font-[500] uppercase tracking-[0.05em]'>{t('nav.community')}</span>
				</NavLink>

				{/* вхід / вихід */}
				{isLoggedIn ? (
					<NavBtn
						icon={<LogOut size={20} strokeWidth={1.6} />}
						label={t('auth.btn_logout')}
						onClick={() => setLogoutModal(true)}
					/>
				) : (
					<NavLink
						to='/auth'
						className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
						style={({ isActive }) => ({
							color: isActive ? NAV_ACTIVE : INACTIVE,
							background: isActive ? NAV_ACTIVE_BG : 'transparent',
						})}
					>
						<LogIn size={20} strokeWidth={1.6} />
						<span className='text-[11px] font-[500] uppercase tracking-[0.05em]'>{t('auth.tab_login')}</span>
					</NavLink>
				)}

				{/* увійти в гру */}
				<NavLink
					to='/game'
					className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
					style={({ isActive }) => ({
						color: isActive ? NAV_ACTIVE : INACTIVE,
						background: isActive ? NAV_ACTIVE_BG : 'transparent',
					})}
				>
					<Play size={20} strokeWidth={1.6} />
					<span className='text-[11px] font-[500] uppercase tracking-[0.05em]'>{t('nav.enter')}</span>
				</NavLink>
			</nav>

			<Modal
				isOpen={logoutModal}
				onClose={() => setLogoutModal(false)}
				title={t('auth.logout_confirm_title')}
				message={t('auth.logout_confirm_msg')}
				variant='warn'
				onConfirm={() => { logout(); setLogoutModal(false) }}
				confirmLabel={t('auth.logout_confirm_yes')}
				cancelLabel={t('auth.logout_confirm_no')}
			/>
		</>
	)
}
