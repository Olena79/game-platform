import React, { useState, useRef } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { User, Mail, Lock, X } from 'lucide-react'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { loginRequest, registerRequest, googleAuthRequest, forgotPasswordRequest } from '../../actions/auth'
import { InputField } from '../minicomponents/InputField'
import { AuthButton } from '../minicomponents/AuthButton'
import { Modal } from '../minicomponents/Modal'
import { RegistrationSuccessModal } from '../modals/RegistrationSuccessModal'

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
	const googleLoginRef = useRef<HTMLDivElement>(null)

	const handleGoogleSuccess = (credentialResponse: CredentialResponse) => {
		if (credentialResponse.credential) {
			onSuccess(credentialResponse.credential)
		}
	}

	const triggerGoogleLogin = () => {
		const button = googleLoginRef.current?.querySelector('div[role="button"]') as HTMLDivElement
		if (button) button.click()
	}

	return (
		<>
			<button
				onClick={triggerGoogleLogin}
				disabled={loading}
				className='w-full h-[44px] rounded-[8px] flex items-center justify-center gap-[8px] font-[500] text-[14px] transition-all cursor-pointer'
				style={isDark
					? {
						background: 'rgba(68,170,255,0.12)',
						border: '1px solid #c35436',
						color: 'rgba(100,180,255,0.9)',
					}
					: {
						background: 'rgba(0,0,0,0.02)',
						border: '1px solid #c35436',
						color: 'var(--text)',
					}
				}
			>
				<GoogleIcon />
				{loading ? t('auth.loading') : t('auth.google_signin')}
			</button>
			<div ref={googleLoginRef} style={{ display: 'none' }}>
				<GoogleLogin
					onSuccess={handleGoogleSuccess}
					onError={onError}
				/>
			</div>
		</>
	)
}

interface FieldErrors {
	name?: string
	email?: string
	password?: string
	consent?: string
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
	const location = useLocation()
	const { login } = useAuth()
	const { isDark } = useTheme()

	const [isLogin, setIsLogin] = useState(true)
	// Consent is a registration requirement, not decoration: this is where
	// an email address is collected.
	const [consent, setConsent] = useState(false)
	const [forgotOpen, setForgotOpen] = useState(false)
	const [forgotEmail, setForgotEmail] = useState('')
	const [forgotSent, setForgotSent] = useState(false)
	const [forgotBusy, setForgotBusy] = useState(false)
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

	const [registrationModal, setRegistrationModal] = useState<{
		open: boolean
		userId: string
	}>({ open: false, userId: '' })

	// A visitor sent here from a protected page (or a game link) carries
	// ?next=, so signing in returns them to where they were going.
	const nextPath = new URLSearchParams(location.search).get('next')
	const goBackAfterAuth = () => {
		if (nextPath) navigate(decodeURIComponent(nextPath), { replace: true })
		else navigate(-1)
	}

	const closeModal = () => {
		if (modal.success) {
			setModal(m => ({ ...m, open: false }))
			goBackAfterAuth()
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

		if (!isLogin && !consent)
			errs.consent = t('auth.err_consent_required')

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

			if (isLogin) {
				setModal({
					open: true,
					title: t('auth.modal_success_login_title'),
					message: t('auth.modal_success_login_msg'),
					variant: 'success',
					success: true,
				})
			} else {
				// Show registration modal with Telegram option
				setRegistrationModal({
					open: true,
					userId: res.user.id,
				})
			}
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

						{!isLogin && (
							<label className='flex items-start gap-[8px] mt-[12px] cursor-pointer'>
								<input
									type='checkbox'
									checked={consent}
									onChange={e => { setConsent(e.target.checked); setFieldErrors(er => ({ ...er, consent: undefined })) }}
									className='mt-[2px] cursor-pointer'
								/>
								<span className='text-[12px] leading-[1.45]' style={{ color: isDark ? 'rgba(180,200,255,0.75)' : 'var(--text-muted)' }}>
									<Trans
										i18nKey='auth.consent_label'
										components={{
											terms: <Link to='/terms-of-service' target='_blank' style={{ color: isDark ? '#0fffc8' : 'var(--accent)', textDecoration: 'underline' }} />,
											privacy: <Link to='/privacy-policy' target='_blank' style={{ color: isDark ? '#0fffc8' : 'var(--accent)', textDecoration: 'underline' }} />,
										}}
									/>
								</span>
							</label>
						)}
						{fieldErrors.consent && (
							<p className='text-[11px] mt-[4px]' style={{ color: '#ff7890' }}>{fieldErrors.consent}</p>
						)}

						<div className='mt-[10px]'>
							<AuthButton loading={loading}>
								{isLogin ? t('auth.btn_login') : t('auth.btn_register')}
							</AuthButton>
						</div>

						{isLogin && (
							<button
								type='button'
								onClick={() => { setForgotOpen(true); setForgotEmail(email); setForgotSent(false) }}
								className='mt-[10px] text-[12px] cursor-pointer self-center'
								style={{ color: isDark ? 'rgba(140,180,255,0.75)' : 'var(--text-muted)', textDecoration: 'underline' }}
							>
								{t('auth.forgot_link')}
							</button>
						)}
					</form>

					{/* Recovery runs over Telegram — there is no mail service */}
					{forgotOpen && (
						<div className='fixed inset-0 z-[70] flex items-center justify-center px-[16px]'
							style={{ background: 'rgba(0,0,0,0.55)' }}
							onClick={() => setForgotOpen(false)}>
							<div className='w-full max-w-[380px] rounded-[16px] p-[22px] flex flex-col gap-[14px]'
								onClick={e => e.stopPropagation()}
								style={isDark
									? { background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }
									: { background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)' }}>
								<h3 className='text-[15px] font-[700]'>{t('auth.forgot_title')}</h3>

								{forgotSent ? (
									<p className='text-[13px] leading-[1.5]' style={{ color: isDark ? 'rgba(180,200,255,0.8)' : 'var(--text-secondary)' }}>
										{t('auth.forgot_sent')}
									</p>
								) : (
									<>
										<p className='text-[12px] leading-[1.5]' style={{ color: isDark ? 'rgba(180,200,255,0.65)' : 'var(--text-muted)' }}>
											{t('auth.forgot_hint')}
										</p>
										<input
											type='email'
											value={forgotEmail}
											onChange={e => setForgotEmail(e.target.value)}
											placeholder={t('auth.email')}
											className='w-full rounded-[10px] px-[12px] py-[10px] text-[14px] focus:outline-none'
											style={isDark
												? { background: 'rgba(15,17,32,0.6)', border: '1px solid rgba(68,170,255,0.18)', color: '#dde1f0' }
												: { background: 'var(--bg-base)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
										/>
									</>
								)}

								<div className='flex gap-[8px]'>
									<button type='button' onClick={() => setForgotOpen(false)}
										className='flex-1 py-[9px] rounded-[10px] text-[13px] cursor-pointer'
										style={{ border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
										{t('auth.forgot_close')}
									</button>
									{!forgotSent && (
										<button
											type='button'
											disabled={forgotBusy || !isValidEmail(forgotEmail)}
											onClick={async () => {
												setForgotBusy(true)
												try { await forgotPasswordRequest(forgotEmail) } catch { /* the answer never varies */ }
												setForgotBusy(false)
												setForgotSent(true)
											}}
											className='flex-1 py-[9px] rounded-[10px] text-[13px] font-[600] cursor-pointer disabled:opacity-40'
											style={isDark
												? { background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }
												: { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}>
											{t('auth.forgot_submit')}
										</button>
									)}
								</div>
							</div>
						</div>
					)}

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

										// Check if this is a new registration
										const isNewUser = res.user.telegramConnected === false
										if (isNewUser) {
											setRegistrationModal({
												open: true,
												userId: res.user.id,
											})
										} else {
											setModal({ open: true, title: t('auth.modal_success_login_title'), message: t('auth.modal_success_login_msg'), variant: 'success', success: true })
										}
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

			<RegistrationSuccessModal
				isOpen={registrationModal.open}
				onClose={() => {
					setRegistrationModal({ open: false, userId: '' })
					navigate('/')
				}}
			/>
		</div>
	)
}
