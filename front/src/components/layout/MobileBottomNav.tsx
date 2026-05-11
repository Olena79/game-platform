import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { Gamepad2, LogIn, LogOut, Play } from 'lucide-react'
import { Modal } from '../minicomponents/Modal'

type NavBtnProps = {
	icon: React.ReactNode
	label: string
	active?: boolean
	onClick?: () => void
}

const INACTIVE = 'rgba(175,190,240,0.75)'
const ACTIVE   = '#0fffc8'

const NavBtn = ({ icon, label, active, onClick }: NavBtnProps) => (
	<button
		onClick={onClick}
		className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] cursor-pointer transition-all'
		style={{
			color: active ? ACTIVE : INACTIVE,
			background: active ? 'rgba(15,255,200,0.1)' : 'transparent',
		}}
	>
		{icon}
		<span className='text-[12px] font-[500] uppercase tracking-[0.05em]'>{label}</span>
	</button>
)

export const MobileBottomNav = () => {
	const { t } = useTranslation()
	const { isLoggedIn, logout } = useAuth()
	const [logoutModal, setLogoutModal] = useState(false)

	return (
		<>
			<nav
				className='md:hidden fixed bottom-0 left-0 right-0 z-[100] flex'
				style={{
					background: '#0d1228',
					borderTop: '1px solid rgba(15,255,200,0.28)',
					backdropFilter: 'blur(16px)',
					WebkitBackdropFilter: 'blur(16px)',
					height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
					paddingBottom: 'env(safe-area-inset-bottom, 0px)',
					boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
				}}
			>
				{/* ігри */}
				<NavLink
					to='/games'
					className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
					style={({ isActive }) => ({
						color: isActive ? ACTIVE : INACTIVE,
						background: isActive ? 'rgba(15,255,200,0.1)' : 'transparent',
					})}
				>
					<Gamepad2 size={22} strokeWidth={1.6} />
					<span className='text-[12px] font-[500] uppercase tracking-[0.05em]'>{t('nav.games')}</span>
				</NavLink>

				{/* вхід / вихід */}
				{isLoggedIn ? (
					<NavBtn
						icon={<LogOut size={22} strokeWidth={1.6} />}
						label={t('auth.btn_logout')}
						onClick={() => setLogoutModal(true)}
					/>
				) : (
					<NavLink
						to='/auth'
						className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
						style={({ isActive }) => ({
							color: isActive ? ACTIVE : INACTIVE,
							background: isActive ? 'rgba(15,255,200,0.1)' : 'transparent',
						})}
					>
						<LogIn size={22} strokeWidth={1.6} />
						<span className='text-[12px] font-[500] uppercase tracking-[0.05em]'>{t('auth.tab_login')}</span>
					</NavLink>
				)}

				{/* увійти в гру */}
				<NavLink
					to='/game'
					className='flex flex-col items-center justify-center flex-1 h-full gap-[5px] transition-all'
					style={({ isActive }) => ({
						color: isActive ? ACTIVE : INACTIVE,
						background: isActive ? 'rgba(15,255,200,0.1)' : 'transparent',
					})}
				>
					<Play size={22} strokeWidth={1.6} />
					<span className='text-[12px] font-[500] uppercase tracking-[0.05em]'>{t('nav.enter')}</span>
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
