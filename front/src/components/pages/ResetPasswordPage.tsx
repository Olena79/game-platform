import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { resetPasswordRequest } from '../../actions/auth'

/**
 * Where the Telegram reset link lands. The token in the query is the only
 * proof of identity here, and it is spent the moment the password changes.
 */
export const ResetPasswordPage = () => {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	const navigate = useNavigate()
	const [params] = useSearchParams()
	const token = params.get('token') ?? ''

	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [show, setShow] = useState(false)
	const [error, setError] = useState('')
	const [done, setDone] = useState(false)
	const [busy, setBusy] = useState(false)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (password.length < 8) { setError(t('auth.reset_too_short')); return }
		if (password !== confirm) { setError(t('auth.reset_mismatch')); return }

		setBusy(true)
		setError('')
		try {
			await resetPasswordRequest(token, password)
			setDone(true)
			setTimeout(() => navigate('/auth', { replace: true }), 2500)
		} catch {
			setError(t('auth.reset_invalid_link'))
		} finally {
			setBusy(false)
		}
	}

	const fieldStyle = isDark
		? { background: 'rgba(15,17,32,0.6)', border: '1px solid rgba(68,170,255,0.18)', color: '#dde1f0' }
		: { background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }

	return (
		<div className='w-full flex items-center justify-center px-[16px] py-[60px]'>
			<div className='w-full max-w-[420px] flex flex-col gap-[18px] rounded-[18px] p-[26px]'
				style={isDark
					? { background: 'rgba(11,13,26,0.75)', border: '1px solid rgba(68,170,255,0.14)' }
					: { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>

				<div className='flex items-center gap-[10px]'>
					<KeyRound size={18} style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }} />
					<h1 className='text-[18px] font-[700]'>{t('auth.reset_title')}</h1>
				</div>

				{!token && <p className='text-[13px]' style={{ color: '#ff7890' }}>{t('auth.reset_no_token')}</p>}

				{done ? (
					<p className='text-[14px]' style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }}>
						{t('auth.reset_done')}
					</p>
				) : (
					<form onSubmit={submit} className='flex flex-col gap-[12px]'>
						<label className='flex flex-col gap-[6px] text-[12px]' style={{ color: 'var(--text-muted)' }}>
							{t('auth.reset_new_password')}
							<div className='relative'>
								<input
									type={show ? 'text' : 'password'}
									value={password}
									onChange={e => setPassword(e.target.value)}
									autoComplete='new-password'
									className='w-full rounded-[10px] px-[12px] py-[10px] pr-[40px] text-[14px] focus:outline-none'
									style={fieldStyle}
								/>
								<button type='button' onClick={() => setShow(v => !v)}
									className='absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer'
									style={{ color: 'var(--text-muted)' }}
									aria-label={t('auth.reset_toggle_visibility')}>
									{show ? <EyeOff size={15} /> : <Eye size={15} />}
								</button>
							</div>
						</label>

						<label className='flex flex-col gap-[6px] text-[12px]' style={{ color: 'var(--text-muted)' }}>
							{t('auth.reset_repeat_password')}
							<input
								type={show ? 'text' : 'password'}
								value={confirm}
								onChange={e => setConfirm(e.target.value)}
								autoComplete='new-password'
								className='w-full rounded-[10px] px-[12px] py-[10px] text-[14px] focus:outline-none'
								style={fieldStyle}
							/>
						</label>

						{error && <p className='text-[12px]' style={{ color: '#ff7890' }}>{error}</p>}

						<button type='submit' disabled={busy || !token}
							className='rounded-[10px] py-[11px] text-[14px] font-[700] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed'
							style={isDark
								? { background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.35)', color: '#0fffc8' }
								: { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff' }}>
							{busy ? t('auth.reset_saving') : t('auth.reset_submit')}
						</button>
					</form>
				)}
			</div>
		</div>
	)
}
