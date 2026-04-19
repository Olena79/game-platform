import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Phone, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { loginRequest, registerRequest } from '../../actions/auth'
import { InputField } from '../minicomponents/InputField'
import { AuthButton } from '../minicomponents/AuthButton'
import { Modal } from '../minicomponents/Modal'

interface FieldErrors {
	name?: string
	email?: string
	phone?: string
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

	const [isLogin, setIsLogin] = useState(true)
	const [name, setName]           = useState('')
	const [surname, setSurname]     = useState('')
	const [email, setEmail]         = useState('')
	const [phone, setPhone]         = useState('')
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

		if (!isLogin) {
			if (!phone || phone.length < 10 || phone.length > 12)
				errs.phone = t('auth.err_phone_invalid')
		}

		if (!password || !isStrongPassword(password))
			errs.password = t('auth.err_password_weak')

		setFieldErrors(errs)
		return Object.keys(errs).length === 0
	}

	const resolveServerError = (msg: string): string => {
		switch (msg) {
			case 'EMAIL_EXISTS':        return t('auth.err_email_exists')
			case 'PHONE_EXISTS':        return t('auth.err_phone_exists')
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
				: await registerRequest(name, surname, email, phone, password)
			login(res.token, res.user)

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

					{/* Tabs */}
					<div className='flex mb-[32px]'>
						{(['login', 'register'] as const).map(tab => (
							<button
								key={tab}
								onClick={() => switchTab(tab)}
								className={`flex-1 pb-[12px] text-[14px] font-[600] transition-all border-b-2 cursor-pointer ${
									(tab === 'login') === isLogin
										? 'text-[#44aaff] border-[#44aaff] [text-shadow:0_0_12px_rgba(68,170,255,0.5)]'
										: 'text-[rgba(180,200,255,0.35)] border-[rgba(255,255,255,0.06)] hover:text-[rgba(180,200,255,0.65)]'
								}`}
							>
								{t(tab === 'login' ? 'auth.tab_login' : 'auth.tab_register')}
							</button>
						))}
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

						{!isLogin && (
							<InputField
								icon={<Phone size={15} strokeWidth={1.8} />}
								type='text'
								placeholder={t('auth.phone_placeholder')}
								value={phone}
								onChange={v => { setPhone(v); setFieldErrors(e => ({ ...e, phone: undefined })) }}
								error={fieldErrors.phone}
								maxLength={12}
								onlyDigits
								autoComplete='tel'
							/>
						)}

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
