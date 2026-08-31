import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Lock, X } from 'lucide-react'
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { loginRequest, registerRequest, googleAuthRequest } from '../../actions/auth'
import { InputField } from '../minicomponents/InputField'
import { AuthButton } from '../minicomponents/AuthButton'
import { Modal } from '../minicomponents/Modal'

const GoogleIcon = () => (
	<svg width="17" height="17" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
		<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
		<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
		<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
		<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
	</svg>
)

interface GoogleSignInButtonProps {
	loading: boolean
	onSuccess: (idToken: string) => void
	onError: () => void
}

const GoogleSignInButton = ({ loading, onSuccess, onError }: GoogleSignInButtonProps) => {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	return (
		<div className='w-full flex justify-center'>
			<GoogleLogin
				onSuccess={credentialResponse => {
					if (credentialResponse.credential) {
						onSuccess(credentialResponse.credential)
					}
				}}
				onError={onError}
				text='signin_with'
			/>
		</div>
	)
}

interface FieldErrors {
	name?: string
	email?: string
	password?: string
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

const isStrongPassword = (v: string) =>
	v.length >= 8 &&
	/[A-Z]/.test(v) &&
	/[a-z]/.test(v) &&
	/\d/.test(v) &&
	/[^A-Za-z0-9]/.test(v)

export const AuthPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { login } = useAuth()
	const { isDark } = useTheme()

	const [isLogin, setIsLogin] = useState(true)
	const [name, setName]           = useState('')
	const [surname, setSurname]     = useState('')
	const [email, setEmail]         = useState('')
	const [password, setPassword]   = useState('')
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
	const [loading, setLoading]     = useState(false)

	const [modal, setModal] = useState<{
		open: boolean
		title: string
		message: string
		variant: 'success' | 'error'
		success: boolean
	}>({ open: false, title: '', message: '', variant: 'success', success: false })

	const closeModal = () => {
		if (modal.success) {
			setModal(m => ({ ...m, open: false }))
			navigate(-1)
		} else {
			setModal(m => ({ ...m, open: false }))
		}
	}

	const validate = (): boolean => {
		const errs: FieldErrors = {}

		if (!isLogin) {
			if (!name || name.trim().length < 2)
				errs.name = t('auth.err_name_short')
		}

		if (!email || !isValidEmail(email))
			errs.email = t('auth.err_email_invalid')

		if (!password || !isStrongPassword(password))
			errs.password = t('auth.err_password_weak')

		setFieldErrors(errs)
		return Object.keys(errs).length === 0
	}

	const resolveServerError = (msg: string): string => {
		switch (msg) {
			case 'EMAIL_EXISTS':        return t('auth.err_email_exists')
			case 'INVALID_CREDENTIALS': return t('auth.err_credentials')
			default: return msg
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!validate()) return

		setLoading(true)
		try {
			const res = isLogin
				? await loginRequest(email, password)
				: await registerRequest(name, surname, email, password)
			login(res.accessToken, res.refreshToken, res.user)

			setModal({
				open: true,
				title: isLogin ? t('auth.modal_success_login_title') : t('auth.modal_success_register_title'),
				message: isLogin ? t('auth.modal_success_login_msg') : t('auth.modal_success_register_msg'),
				variant: 'success',
				success: true,
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			setModal({
				open: true,
				title: t('auth.modal_error_title'),
				message: resolveServerError(msg),
				variant: 'error',
				success: false,
			})
		} finally {
			setLoading(false)
		}
	}

	const switchTab = (tab: 'login' | 'register') => {
		setIsLogin(tab === 'login')
		setFieldErrors({})
	}

	return (
		<div className='relative min-h-[88vh] flex justify-center items-center px-[20px] py-[40px] md:py-[60px] overflow-hidden'>
			<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
				<div
					className='w-[580px] h-[580px] rounded-full'
					style={{ background: isDark ? 'radial-gradient(circle, rgba(40,80,255,0.16) 0%, transparent 65%)' : 'radial-gradient(circle, rgba(192,83,58,0.05) 0%, transparent 65%)' }}
				/>
			</div>

			<div className='relative z-10 w-full max-w-[440px]'>
				<div className='flex justify-center mb-[28px]'>
					<span
						className='inline-flex items-center gap-[8px] text-[11px] px-[14px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-medium'
						style={isDark
							? { border: '1px solid rgba(68,170,255,0.35)', color: 'rgba(100,180,255,0.9)' }
							: { border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }
						}
					>
						<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						Games of Senses
					</span>
				</div>

				<div
					className='relative rounded-[24px] px-[28px] md:px-[36px] py-[36px] md:py-[44px]'
					style={isDark
						? { border: '1px solid rgba(68,170,255,0.18)', background: 'rgba(3,6,25,0.6)', backdropFilter: 'blur(14px)' }
						: { border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }
					}
				>
					<button
						onClick={() => navigate(-1)}
						aria-label={t('auth.close')}
						className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.06)]'
						style={isDark
							? { color: '#44aaff', border: '1px solid rgba(68,170,255,0.35)' }
							: { color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
						}
					>
						<X size={14} strokeWidth={2} />
					</button>

					{/* Tabs */}
					<div className='flex mb-[32px]'>
						{(['login', 'register'] as const).map(tab => {
							const isActive = (tab === 'login') === isLogin
							return (
								<button
									key={tab}
									onClick={() => switchTab(tab)}
									className='flex-1 pb-[12px] text-[14px] font-[600] transition-all border-b-2 cursor-pointer'
									style={isActive
										? isDark
											? { color: '#44aaff', borderColor: '#44aaff', textShadow: '0 0 12px rgba(68,170,255,0.5)' }
											: { color: 'var(--accent)', borderColor: 'var(--accent)' }
										: isDark
											? { color: 'rgba(180,200,255,0.62)', borderColor: 'rgba(255,255,255,0.1)' }
											: { color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }
									}
								>
									{t(tab === 'login' ? 'auth.tab_login' : 'auth.tab_register')}
								</button>
							)
						})}
					</div>

					<form onSubmit={handleSubmit} className='flex flex-col gap-[12px]' noValidate>
						{!isLogin && (
							<InputField
								icon={<User size={15} strokeWidth={1.8} />}
								type='text'
								placeholder={t('auth.name')}
								value={name}
								onChange={v => { setName(v); setFieldErrors(e => ({ ...e, name: undefined })) }}
								error={fieldErrors.name}
								autoComplete='name'
							/>
						)}

						{!isLogin && (
							<InputField
								icon={<User size={15} strokeWidth={1.8} />}
								type='text'
								placeholder={t('auth.surname_placeholder')}
								value={surname}
								onChange={v => setSurname(v)}
								autoComplete='family-name'
							/>
						)}

						<InputField
							icon={<Mail size={15} strokeWidth={1.8} />}
							type='email'
							placeholder={t('auth.email')}
							value={email}
							onChange={v => { setEmail(v); setFieldErrors(e => ({ ...e, email: undefined })) }}
							error={fieldErrors.email}
							autoComplete='email'
						/>

						<InputField
							icon={<Lock size={15} strokeWidth={1.8} />}
							type='password'
							placeholder={t('auth.password')}
							value={password}
							onChange={v => { setPassword(v); setFieldErrors(e => ({ ...e, password: undefined })) }}
							error={fieldErrors.password}
							autoComplete={isLogin ? 'current-password' : 'new-password'}
						/>

						<div className='mt-[10px]'>
							<AuthButton loading={loading}>
								{isLogin ? t('auth.btn_login') : t('auth.btn_register')}
							</AuthButton>
						</div>
					</form>

					{/* Google OAuth — only renders when VITE_GOOGLE_CLIENT_ID is set */}
					{import.meta.env.VITE_GOOGLE_CLIENT_ID && (
						<>
							<div className='flex items-center gap-[12px] my-[18px]'>
								<div className='flex-1 h-[1px]' style={{ background: isDark ? 'rgba(68,170,255,0.12)' : 'var(--border-subtle)' }} />
								<span className='text-[12px]' style={{ color: isDark ? 'rgba(180,200,255,0.6)' : 'var(--text-muted)' }}>{t('auth.or')}</span>
								<div className='flex-1 h-[1px]' style={{ background: isDark ? 'rgba(68,170,255,0.12)' : 'var(--border-subtle)' }} />
							</div>
							<GoogleSignInButton
								loading={loading}
								onSuccess={async (accessToken) => {
									setLoading(true)
									try {
										const res = await googleAuthRequest(accessToken)
										login(res.accessToken, res.refreshToken, res.user)
										setModal({ open: true, title: t('auth.modal_success_login_title'), message: t('auth.modal_success_login_msg'), variant: 'success', success: true })
									} catch (err) {
										const msg = err instanceof Error ? err.message : 'Google auth failed'
										setModal({ open: true, title: t('auth.modal_error_title'), message: msg, variant: 'error', success: false })
									} finally {
										setLoading(false)
									}
								}}
								onError={() => setModal({ open: true, title: t('auth.modal_error_title'), message: 'Google login failed', variant: 'error', success: false })}
							/>
						</>
					)}
				</div>
			</div>

			<Modal
				isOpen={modal.open}
				onClose={closeModal}
				title={modal.title}
				message={modal.message}
				variant={modal.variant}
				closeLabel={t('auth.modal_close')}
			/>
		</div>
	)
}
