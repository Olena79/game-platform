import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Hash, Pencil, Lock, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

type Role = 'player' | 'spectator' | 'gamemaster'

export const GamePage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { isLoggedIn, isLoading } = useAuth()
	const [role, setRole] = useState<Role>('player')

	if (isLoading) {
		return (
			<div className='min-h-[88vh] flex items-center justify-center'>
				<div className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim' />
			</div>
		)
	}

	return (
		<div className='relative min-h-[88vh] flex justify-center items-center px-[20px] py-[40px] md:py-[60px] overflow-hidden'>
			<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
				<div
					className='w-[580px] h-[580px] rounded-full'
					style={{ background: 'radial-gradient(circle, rgba(40,80,255,0.16) 0%, transparent 65%)' }}
				/>
			</div>

			<div className='relative z-10 w-full max-w-[440px]'>
				<div className='flex justify-center mb-[28px]'>
					<span className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(100,180,255,0.9)] text-[11px] px-[14px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-medium'>
						<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						MindFlow
					</span>
				</div>

				<div className='relative border border-[rgba(68,170,255,0.18)] rounded-[24px] px-[28px] md:px-[36px] py-[36px] md:py-[44px] bg-[rgba(3,6,25,0.6)] backdrop-blur-[14px]'>
					<button
						onClick={() => navigate(-1)}
						aria-label='Назад'
						className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center text-[#44aaff] border border-[rgba(68,170,255,0.35)] md:text-[rgba(180,200,255,0.35)] md:border-[rgba(255,255,255,0.08)] hover:text-white hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer'
					>
						<X size={14} strokeWidth={2} />
					</button>

					{!isLoggedIn ? (
						<div className='text-center py-[8px]'>
							<div className='w-[56px] h-[56px] rounded-full bg-[rgba(68,170,255,0.08)] border border-[rgba(68,170,255,0.2)] flex items-center justify-center mx-auto mb-[20px]'>
								<Lock size={22} strokeWidth={1.5} className='text-[rgba(68,170,255,0.65)]' />
							</div>
							<h2 className='font-amatic text-[22px] md:text-[26px] font-[700] text-white mb-[10px]'>
								{t('game.not_auth_title')}
							</h2>
							<p className='text-[14px] text-[rgba(180,200,255,0.45)] leading-[1.65] mb-[28px] font-[300]'>
								{t('game.not_auth_desc')}
							</p>
							<Link to='/auth'>
								<button className='w-full bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white py-[13px] rounded-[12px] text-[14px] font-[600] hover:shadow-[0_0_30px_rgba(100,80,255,0.45)] hover:-translate-y-[1px] transition-all cursor-pointer'>
									{t('game.not_auth_btn')}
								</button>
							</Link>
						</div>
					) : (
						<>
							<h2 className='font-amatic text-[22px] md:text-[26px] font-[700] text-white mb-[28px] pr-[30px]'>
								{role === 'gamemaster' ? t('game.title_gamemaster') : t('game.title_player')}
							</h2>

							<form className='flex flex-col gap-[12px]'>
								<div className='relative'>
									<Users
										size={15}
										strokeWidth={1.8}
										className='absolute left-[14px] top-1/2 -translate-y-1/2 text-[rgba(68,170,255,0.5)] pointer-events-none'
									/>
									<select
										value={role}
										onChange={e => setRole(e.target.value as Role)}
										className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.2)] text-[rgba(180,200,255,0.75)] rounded-[12px] py-[12px] pl-[40px] pr-[36px] text-[14px] appearance-none focus:outline-none focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_14px_rgba(68,170,255,0.12)] transition-all cursor-pointer'
									>
										<option value='player'     className='bg-[#060e24]'>{t('game.role_player')}</option>
										<option value='spectator'  className='bg-[#060e24]'>{t('game.role_spectator')}</option>
										<option value='gamemaster' className='bg-[#060e24]'>{t('game.role_gamemaster')}</option>
									</select>
									<div className='absolute right-[14px] top-1/2 -translate-y-1/2 pointer-events-none text-[rgba(100,150,255,0.4)]'>
										<svg width="11" height="11" viewBox="0 0 12 12" fill="none">
											<path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									</div>
								</div>

								{role !== 'gamemaster' ? (
									<GameInputField
										icon={<Hash size={15} strokeWidth={1.8} />}
										type='text'
										placeholder={t('game.game_code')}
									/>
								) : (
									<GameInputField
										icon={<Pencil size={15} strokeWidth={1.8} />}
										type='text'
										placeholder={t('game.game_name')}
									/>
								)}

								<button
									type='submit'
									className='mt-[10px] w-full bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white py-[13px] rounded-[12px] text-[14px] font-[600] hover:shadow-[0_0_30px_rgba(100,80,255,0.45)] hover:-translate-y-[1px] transition-all cursor-pointer'
								>
									{role === 'gamemaster' ? t('game.btn_create') : t('game.btn_join')}
								</button>
							</form>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

const GameInputField = ({ icon, type, placeholder }: { icon: React.ReactNode; type: string; placeholder: string }) => (
	<div className='relative'>
		<span className='absolute left-[14px] top-1/2 -translate-y-1/2 text-[rgba(68,170,255,0.5)] pointer-events-none'>
			{icon}
		</span>
		<input
			type={type}
			placeholder={placeholder}
			className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.2)] text-[rgba(180,200,255,0.85)] placeholder-[rgba(100,140,220,0.35)] rounded-[12px] py-[12px] pl-[40px] pr-[14px] text-[14px] focus:outline-none focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_14px_rgba(68,170,255,0.12)] transition-all'
		/>
	</div>
)
