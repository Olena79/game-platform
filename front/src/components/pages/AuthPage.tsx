import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Lock, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { loginRequest, registerRequest } from '../../actions/auth'

export const AuthPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { login } = useAuth()

	const [isLogin, setIsLogin] = useState(true)
	const [name, setName]       = useState('')
	const [email, setEmail]     = useState('')
	const [password, setPassword] = useState('')
	const [error, setError]     = useState('')
	const [loading, setLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const res = isLogin
				? await loginRequest(email, password)
				: await registerRequest(name, email, password)
			login(res.token, res.user)
			navigate(-1)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error')
		} finally {
			setLoading(false)
		}
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
						aria-label='Закрити'
						className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center text-[#44aaff] border border-[rgba(68,170,255,0.35)] md:text-[rgba(180,200,255,0.35)] md:border-[rgba(255,255,255,0.08)] hover:text-white hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer'
					>
						<X size={14} strokeWidth={2} />
					</button>

					{/* Таби */}
					<div className='flex mb-[32px]'>
						{(['login', 'register'] as const).map(tab => (
							<button
								key={tab}
								onClick={() => { setIsLogin(tab === 'login'); setError('') }}
								className={`flex-1 pb-[12px] text-[14px] font-[600] transition-all border-b-2 ${
									(tab === 'login') === isLogin
										? 'text-[#44aaff] border-[#44aaff] [text-shadow:0_0_12px_rgba(68,170,255,0.5)]'
										: 'text-[rgba(180,200,255,0.35)] border-[rgba(255,255,255,0.06)] hover:text-[rgba(180,200,255,0.65)]'
								}`}
							>
								{t(tab === 'login' ? 'auth.tab_login' : 'auth.tab_register')}
							</button>
						))}
					</div>

					<form onSubmit={handleSubmit} className='flex flex-col gap-[12px]'>
						{!isLogin && (
							<InputField
								icon={<User size={15} strokeWidth={1.8} />}
								type='text'
								placeholder={t('auth.name')}
								value={name}
								onChange={setName}
							/>
						)}

						<InputField
							icon={<Mail size={15} strokeWidth={1.8} />}
							type='email'
							placeholder={t('auth.email')}
							value={email}
							onChange={setEmail}
						/>

						<InputField
							icon={<Lock size={15} strokeWidth={1.8} />}
							type='password'
							placeholder={t('auth.password')}
							value={password}
							onChange={setPassword}
						/>

						{error && (
							<p className='text-[13px] text-[rgba(255,90,160,0.85)] text-center py-[2px]'>
								{error}
							</p>
						)}

						<button
							type='submit'
							disabled={loading}
							className='mt-[10px] w-full bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white py-[13px] rounded-[12px] text-[14px] font-[600] hover:shadow-[0_0_30px_rgba(100,80,255,0.45)] hover:-translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'
						>
							{loading ? '...' : isLogin ? t('auth.btn_login') : t('auth.btn_register')}
						</button>
					</form>
				</div>
			</div>
		</div>
	)
}

const InputField = ({
	icon, type, placeholder, value, onChange,
}: {
	icon: React.ReactNode
	type: string
	placeholder: string
	value: string
	onChange: (v: string) => void
}) => (
	<div className='relative'>
		<span className='absolute left-[14px] top-1/2 -translate-y-1/2 text-[rgba(68,170,255,0.5)] pointer-events-none'>
			{icon}
		</span>
		<input
			type={type}
			placeholder={placeholder}
			value={value}
			onChange={e => onChange(e.target.value)}
			className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.2)] text-[rgba(180,200,255,0.85)] placeholder-[rgba(100,140,220,0.35)] rounded-[12px] py-[12px] pl-[40px] pr-[14px] text-[14px] focus:outline-none focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_14px_rgba(68,170,255,0.12)] transition-all'
		/>
	</div>
)
