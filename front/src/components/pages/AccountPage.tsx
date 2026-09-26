import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Download, Trash2, ShieldAlert, Send, Pencil } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useTelegramLink } from '../../hooks/useTelegramLink'
import { exportAccountRequest, deleteAccountRequest, updateNameRequest } from '../../actions/auth'

/**
 * The account page: what we hold, and how to leave.
 *
 * Deleting is irreversible and takes the person's games with it, so the
 * consequences are listed before the button rather than after it.
 */
export const AccountPage = () => {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	const { user, token, logout, setUserData } = useAuth()
	const navigate = useNavigate()
	const telegramLink = useTelegramLink(Boolean(user) && !user?.telegramConnected)

	const [confirmOpen, setConfirmOpen] = useState(false)
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	// Editing one's name: the gamemaster's name on games, the name in rooms
	// and in the community all come from here
	const [editingName, setEditingName] = useState(false)
	const [nameInput, setNameInput] = useState('')
	const [surnameInput, setSurnameInput] = useState('')
	const [nameError, setNameError] = useState('')

	if (!user || !token) return null

	const card = isDark
		? { background: 'rgba(11,13,26,0.7)', border: '1px solid rgba(68,170,255,0.14)' }
		: { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }

	const startEditName = () => {
		setNameInput(user.name ?? '')
		setSurnameInput(user.surname ?? '')
		setNameError('')
		setEditingName(true)
	}
	const saveName = async () => {
		setBusy(true)
		setNameError('')
		try {
			setUserData(await updateNameRequest(token, nameInput.trim(), surnameInput.trim()))
			setEditingName(false)
		} catch {
			setNameError(t('account.name_save_failed'))
		} finally {
			setBusy(false)
		}
	}
	const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }

	const downloadData = async () => {
		setBusy(true)
		try {
			const data = await exportAccountRequest(token)
			const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
			const a = document.createElement('a')
			a.href = url
			a.download = 'games-of-senses-data.json'
			a.click()
			URL.revokeObjectURL(url)
		} catch {
			setError(t('account.export_failed'))
		} finally {
			setBusy(false)
		}
	}

	const confirmDelete = async () => {
		setBusy(true)
		setError('')
		try {
			await deleteAccountRequest(token, password || undefined)
			logout()
			navigate('/', { replace: true })
		} catch (err) {
			const message = err instanceof Error ? err.message : ''
			setError(message === 'INVALID_PASSWORD' ? t('account.wrong_password') : t('account.delete_failed'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className='w-full max-w-[640px] mx-auto px-[16px] py-[40px] flex flex-col gap-[18px]'>
			<h1 className='text-[22px] font-[700]'>{t('account.title')}</h1>

			{/* Who you are here */}
			<section className='rounded-[16px] p-[20px] flex flex-col gap-[10px]' style={card}>
				{!editingName ? (
					<div className='flex justify-between items-center gap-[12px] text-[14px]'>
						<span style={{ color: 'var(--text-muted)' }}>{t('account.name')}</span>
						<span className='flex items-center gap-[8px] min-w-0'>
							<span className='font-[600] text-right break-words min-w-0'>
								{[user.name, user.surname].filter(Boolean).join(' ') || <span style={{ color: 'var(--text-muted)' }}>{t('account.name_empty')}</span>}
							</span>
							<button onClick={startEditName} aria-label={t('account.name_edit')} title={t('account.name_edit')}
								className='flex-shrink-0 w-[30px] h-[30px] rounded-[8px] flex items-center justify-center cursor-pointer'
								style={{ border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}>
								<Pencil size={13} />
							</button>
						</span>
					</div>
				) : (
					<div className='flex flex-col gap-[8px]'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-[8px]'>
							<input value={nameInput} onChange={e => setNameInput(e.target.value.slice(0, 100))} placeholder={t('account.first_name')}
								className='w-full rounded-[10px] px-[12px] py-[9px] text-[14px] focus:outline-none' style={inputStyle} autoFocus />
							<input value={surnameInput} onChange={e => setSurnameInput(e.target.value.slice(0, 100))} placeholder={t('account.last_name')}
								className='w-full rounded-[10px] px-[12px] py-[9px] text-[14px] focus:outline-none' style={inputStyle} />
						</div>
						{nameError && <p className='text-[12px]' style={{ color: 'rgb(220,70,90)' }}>{nameError}</p>}
						<div className='flex gap-[8px] justify-end'>
							<button onClick={() => setEditingName(false)} className='px-[14px] py-[7px] rounded-[9px] text-[13px] cursor-pointer'
								style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{t('account.cancel')}</button>
							<button onClick={() => void saveName()} disabled={busy} className='px-[14px] py-[7px] rounded-[9px] text-[13px] font-[600] cursor-pointer disabled:opacity-50'
								style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>{t('account.name_save')}</button>
						</div>
					</div>
				)}
				<div className='flex justify-between gap-[12px] text-[14px]'>
					<span style={{ color: 'var(--text-muted)' }}>{t('account.email')}</span>
					<span className='font-[600] text-right break-all'>{user.email}</span>
				</div>
				<div className='flex justify-between items-center gap-[12px] text-[14px]'>
					<span style={{ color: 'var(--text-muted)' }}>Telegram</span>
					{user.telegramConnected ? (
						<span className='font-[600]' style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }}>
							{t('account.telegram_on')}
						</span>
					) : (
						<a href={telegramLink} target='_blank' rel='noreferrer'
							className='flex items-center gap-[6px] text-[13px] font-[600] underline'
							style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }}>
							<Send size={13} /> {t('account.telegram_connect')}
						</a>
					)}
				</div>
				<p className='text-[12px] leading-[1.5] mt-[4px]' style={{ color: 'var(--text-muted)' }}>
					{t('account.telegram_why')}
				</p>
			</section>

			{/* Take your data */}
			<section className='rounded-[16px] p-[20px] flex flex-col gap-[12px]' style={card}>
				<h2 className='text-[16px] font-[700]'>{t('account.export_title')}</h2>
				<p className='text-[13px] leading-[1.5]' style={{ color: 'var(--text-muted)' }}>
					{t('account.export_hint')}
				</p>
				<button onClick={downloadData} disabled={busy}
					className='self-start flex items-center gap-[8px] rounded-[10px] px-[16px] py-[9px] text-[13px] font-[600] cursor-pointer disabled:opacity-40'
					style={isDark
						? { background: 'rgba(68,170,255,0.1)', border: '1px solid rgba(68,170,255,0.3)', color: '#68b5ff' }
						: { background: 'var(--bg-base)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
					<Download size={14} /> {t('account.export_button')}
				</button>
			</section>

			{/* Leave */}
			<section className='rounded-[16px] p-[20px] flex flex-col gap-[12px]'
				style={isDark
					? { background: 'rgba(255,56,80,0.05)', border: '1px solid rgba(255,56,80,0.22)' }
					: { background: 'rgba(255,90,90,0.04)', border: '1px solid rgba(200,60,60,0.2)' }}>
				<h2 className='flex items-center gap-[8px] text-[16px] font-[700]' style={{ color: '#ff5f78' }}>
					<ShieldAlert size={16} /> {t('account.delete_title')}
				</h2>
				<ul className='text-[13px] leading-[1.7] pl-[18px]' style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
					<li>{t('account.delete_point_games')}</li>
					<li>{t('account.delete_point_recordings')}</li>
					<li>{t('account.delete_point_posts')}</li>
					<li>{t('account.delete_point_final')}</li>
				</ul>

				{!confirmOpen ? (
					<button onClick={() => { setConfirmOpen(true); setError('') }}
						className='self-start flex items-center gap-[8px] rounded-[10px] px-[16px] py-[9px] text-[13px] font-[600] cursor-pointer'
						style={{ background: 'rgba(255,56,80,0.1)', border: '1px solid rgba(255,56,80,0.35)', color: '#ff5f78' }}>
						<Trash2 size={14} /> {t('account.delete_button')}
					</button>
				) : (
					<div className='flex flex-col gap-[10px]'>
						<label className='text-[12px]' style={{ color: 'var(--text-muted)' }}>
							{t('account.delete_password_label')}
							<input
								type='password'
								value={password}
								onChange={e => setPassword(e.target.value)}
								autoComplete='current-password'
								className='w-full mt-[6px] rounded-[10px] px-[12px] py-[10px] text-[14px] focus:outline-none'
								style={isDark
									? { background: 'rgba(15,17,32,0.6)', border: '1px solid rgba(255,56,80,0.25)', color: '#dde1f0' }
									: { background: 'var(--bg-base)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
							/>
						</label>
						{error && <p className='text-[12px]' style={{ color: '#ff7890' }}>{error}</p>}
						<div className='flex gap-[8px]'>
							<button onClick={() => { setConfirmOpen(false); setPassword(''); setError('') }}
								className='rounded-[10px] px-[16px] py-[9px] text-[13px] cursor-pointer'
								style={{ border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
								{t('account.cancel')}
							</button>
							<button onClick={confirmDelete} disabled={busy}
								className='rounded-[10px] px-[16px] py-[9px] text-[13px] font-[700] cursor-pointer disabled:opacity-40'
								style={{ background: 'rgba(255,56,80,0.14)', border: '1px solid rgba(255,56,80,0.45)', color: '#ff5f78' }}>
								{busy ? t('account.deleting') : t('account.delete_confirm')}
							</button>
						</div>
					</div>
				)}
			</section>
		</div>
	)
}
