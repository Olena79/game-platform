import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Scroll, Users, CircleDollarSign, Zap, CalendarDays, X, ImagePlus, CreditCard, Banknote } from 'lucide-react'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { InputField } from '../minicomponents/InputField'
import { AuthButton } from '../minicomponents/AuthButton'
import { Modal } from '../minicomponents/Modal'
import { createGame, updateGame, getGameForEdit } from '../../actions/games'

// ─── Local mini-components ───────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => {
	const { isDark } = useTheme()
	return (
		<span
			className='block text-[13px] uppercase tracking-[0.6px] font-[600] mb-[10px]'
			style={{ color: isDark ? 'rgba(68,170,255,0.85)' : 'var(--text-muted)' }}
		>
			{children}
		</span>
	)
}

const Divider = () => {
	const { isDark } = useTheme()
	return (
		<div style={{ borderTop: `1px solid ${isDark ? 'rgba(68,170,255,0.08)' : 'var(--border-subtle)'}` }} />
	)
}

const NumInput = ({
	value, onChange, min = 1, max, error, className = '',
}: {
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	error?: string
	className?: string
}) => {
	const { isDark } = useTheme()
	return (
		<div className={`flex flex-col gap-[4px] ${className}`}>
			<input
				type='number'
				min={min}
				max={max}
				value={value}
				onChange={e => {
					const n = Number(e.target.value)
					onChange(isNaN(n) ? min : Math.max(min, n))
				}}
				className='w-full rounded-[10px] py-[10px] px-[12px] text-[15px] text-center font-[600] focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
				style={error
					? {
						background: isDark ? '#060e24' : 'var(--bg-input)',
						border: '1px solid rgba(255,90,160,0.55)',
						color: isDark ? 'rgba(180,200,255,0.9)' : 'var(--text-primary)',
					}
					: {
						background: isDark ? '#060e24' : 'var(--bg-input)',
						border: `1px solid ${isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'}`,
						color: isDark ? 'rgba(180,200,255,0.9)' : 'var(--text-primary)',
					}
				}
				onFocus={e => {
					if (!error) {
						e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.6)' : 'var(--accent)'
						if (isDark) e.currentTarget.style.boxShadow = '0 0 10px rgba(68,170,255,0.1)'
					}
				}}
				onBlur={e => {
					if (!error) {
						e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'
						e.currentTarget.style.boxShadow = ''
					}
				}}
			/>
			{error && (
				<span className='text-[11px] text-[rgba(255,90,160,0.85)] text-center leading-[1.3]'>
					{error}
				</span>
			)}
		</div>
	)
}

const Toggle = ({
	checked, onChange, label, icon,
}: {
	checked: boolean
	onChange: (v: boolean) => void
	label: string
	icon?: React.ReactNode
}) => {
	const { isDark } = useTheme()
	return (
		<label className='flex items-center gap-[12px] cursor-pointer select-none'>
			<div
				className='relative w-[42px] h-[24px] rounded-full transition-all duration-[220ms] flex-shrink-0'
				style={checked
					? isDark
						? { background: 'rgba(68,170,255,0.2)', border: '1px solid rgba(68,170,255,0.55)' }
						: { background: 'rgba(192,83,58,0.15)', border: '1px solid rgba(192,83,58,0.45)' }
					: isDark
						? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }
						: { background: 'rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)' }
				}
			>
				<div
					className='absolute top-[4px] w-[16px] h-[16px] rounded-full transition-all duration-[220ms]'
					style={checked
						? isDark
							? { left: '22px', background: '#44aaff', boxShadow: '0 0 8px rgba(68,170,255,0.65)' }
							: { left: '22px', background: 'var(--accent)' }
						: isDark
							? { left: '4px', background: 'rgba(180,200,255,0.35)' }
							: { left: '4px', background: 'rgba(100,80,60,0.3)' }
					}
				/>
			</div>
			{icon && (
				<span style={{ color: checked ? (isDark ? 'rgba(180,200,255,0.7)' : 'var(--accent)') : (isDark ? 'rgba(180,200,255,0.5)' : 'var(--text-muted)') }}>
					{icon}
				</span>
			)}
			<span className='text-[14px]' style={{ color: checked ? (isDark ? 'rgba(180,200,255,0.85)' : 'var(--text-primary)') : (isDark ? 'rgba(180,200,255,0.72)' : 'var(--text-secondary)') }}>
				{label}
			</span>
			<input type='checkbox' checked={checked} onChange={e => onChange(e.target.checked)} className='hidden' />
		</label>
	)
}

// formats stored digits "1234567890123456" → "1234 5678 9012 3456"
function formatCard(digits: string) {
	return digits.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const CreateGamePage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { id } = useParams<{ id?: string }>()
	const [searchParams] = useSearchParams()
	const { token, isLoggedIn, isLoading } = useAuth()
	const { isDark } = useTheme()

	const isEdit = !!id

	// Form state
	const [title, setTitle]                       = useState(searchParams.get('name') || '')
	const [description, setDescription]           = useState('')
	const [minPlayers, setMinPlayers]             = useState(2)
	const [maxPlayers, setMaxPlayers]             = useState(6)
	const [scenario, setScenario]                 = useState('')
	const [useCoins, setUseCoins]                 = useState(false)
	const [coinsPerPlayer, setCoinsPerPlayer]     = useState(100)
	const [useInfluence, setUseInfluence]         = useState(false)
	const [influencePerPlayer, setInfluencePerPlayer] = useState(10)
	const [scheduledAt, setScheduledAt]           = useState('')
	const [useDefaultTimer, setUseDefaultTimer]   = useState(false)
	const [defaultTimerMins, setDefaultTimerMins] = useState(5)
	const [defaultTimerSecs, setDefaultTimerSecs] = useState(0)
	const [participationCost, setParticipationCost] = useState(0)
	const [gmCardNumber, setGmCardNumber]           = useState('')

	const DEFAULT_COVER = 'https://res.cloudinary.com/dsgqhwqr7/image/upload/v1777038005/fon_of_game_uwvu0o.png'

	const [coverImage, setCoverImage]         = useState('')
	const [images, setImages]                 = useState<string[]>([])
	const [coverUploading, setCoverUploading] = useState(false)
	const [imgUploading, setImgUploading]     = useState(false)

	const [errors, setErrors]       = useState<Record<string, string>>({})
	const [loading, setLoading]     = useState(false)
	const [initLoading, setInitLoading] = useState(isEdit)
	const [modal, setModal] = useState<{
		open: boolean; title: string; message: string
		variant: 'success' | 'error'; goGames: boolean
	}>({ open: false, title: '', message: '', variant: 'success', goGames: false })

	// Load game data for edit mode
	useEffect(() => {
		if (!isEdit || !token) { if (isEdit) setInitLoading(false); return }
		getGameForEdit(token, id!)
			.then(g => {
				setTitle(g.title)
				setDescription(g.description || '')
				setMinPlayers(g.minPlayers)
				setMaxPlayers(g.maxPlayers)
				setScenario(g.scenario)
				setUseCoins(g.useCoins)
				setCoinsPerPlayer(g.coinsPerPlayer || 100)
				setUseInfluence(g.useInfluence)
				setInfluencePerPlayer(g.influencePerPlayer || 10)
				if (g.scheduledAt) setScheduledAt(new Date(g.scheduledAt).toISOString().slice(0, 16))
				if (g.defaultTimerSeconds) {
					setUseDefaultTimer(true)
					setDefaultTimerMins(Math.floor(g.defaultTimerSeconds / 60))
					setDefaultTimerSecs(g.defaultTimerSeconds % 60)
				}
				if (g.coverImage) setCoverImage(g.coverImage)
				setImages(g.images || [])
				setParticipationCost(g.participationCost || 0)
				if (g.gmCardNumber) setGmCardNumber(formatCard(g.gmCardNumber))
			})
			.catch(err => {
				const msg = err instanceof Error ? err.message : ''
				if (msg === 'FORBIDDEN') {
					setModal({
						open: true,
						title: t('create_game.err_forbidden_title'),
						message: t('create_game.err_forbidden_msg'),
						variant: 'error',
						goGames: true,
					})
				} else {
					navigate('/games')
				}
			})
			.finally(() => setInitLoading(false))
	}, [isEdit, id, token])

	const validate = (): boolean => {
		const errs: Record<string, string> = {}
		if (!title.trim())                    errs.title = t('create_game.err_no_title')
		if (maxPlayers < minPlayers)          errs.maxPlayers = t('create_game.err_players')
		if (useCoins && coinsPerPlayer < 1)   errs.coinsPerPlayer = '≥ 1'
		if (useInfluence && influencePerPlayer < 1) errs.influencePerPlayer = '≥ 1'
		const rawCard = gmCardNumber.replace(/\D/g, '')
		if (rawCard.length > 0 && rawCard.length !== 16) errs.gmCardNumber = 'Потрібно 16 цифр'
		setErrors(errs)
		return Object.keys(errs).length === 0
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!validate() || !token) return
		setLoading(true)
		try {
			const rawCard = gmCardNumber.replace(/\D/g, '')
			const body = {
				title: title.trim(),
				description,
				minPlayers,
				maxPlayers,
				scenario,
				useCoins,
				coinsPerPlayer: useCoins ? coinsPerPlayer : 0,
				useInfluence,
				influencePerPlayer: useInfluence ? influencePerPlayer : 0,
				participationCost,
				gmCardNumber: rawCard.length === 16 ? rawCard : '',
				scheduledAt: scheduledAt || undefined,
				coverImage,
				images,
				defaultTimerSeconds: useDefaultTimer ? (defaultTimerMins * 60 + defaultTimerSecs) : null,
			}
			isEdit ? await updateGame(token, id!, body) : await createGame(token, body)
			setModal({
				open: true,
				title: isEdit ? t('create_game.success_update_title') : t('create_game.success_create_title'),
				message: isEdit ? t('create_game.success_update_msg') : t('create_game.success_create_msg'),
				variant: 'success',
				goGames: true,
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			setModal({
				open: true,
				title: t('create_game.modal_error_title'),
				message: msg === 'FORBIDDEN' ? t('create_game.err_forbidden_msg') : msg,
				variant: 'error',
				goGames: false,
			})
		} finally {
			setLoading(false)
		}
	}

	const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file || !token) return
		setCoverUploading(true)
		try {
			const url = await uploadToCloudinary(file, token)
			setCoverImage(url)
		} catch { /* silent */ } finally {
			setCoverUploading(false)
			e.target.value = ''
		}
	}

	const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || [])
		if (!files.length || !token) return
		const remaining = 10 - images.length
		const toUpload  = files.slice(0, remaining)
		setImgUploading(true)
		try {
			const urls = await Promise.all(toUpload.map(f => uploadToCloudinary(f, token)))
			setImages(prev => [...prev, ...urls].slice(0, 10))
		} catch { /* silent */ } finally {
			setImgUploading(false)
			e.target.value = ''
		}
	}

	const closeModal = () => {
		const go = modal.goGames
		setModal(m => ({ ...m, open: false }))
		if (go) navigate('/games')
	}

	// Redirects
	if (!isLoading && !isLoggedIn) { navigate('/auth'); return null }
	if (isLoading || initLoading) {
		return (
			<div className='min-h-[88vh] flex items-center justify-center'>
				<div className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim' />
			</div>
		)
	}

	return (
		<div className='relative min-h-[88vh] flex justify-center items-start px-[20px] py-[40px] md:py-[60px] overflow-hidden'>
			{/* Background glow */}
			<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
				<div
					className='w-[640px] h-[640px] rounded-full'
					style={{ background: isDark ? 'radial-gradient(circle, rgba(40,80,255,0.13) 0%, transparent 65%)' : 'radial-gradient(circle, rgba(192,83,58,0.04) 0%, transparent 65%)' }}
				/>
			</div>

			<div className='relative z-10 w-full max-w-[580px]'>
				{/* Badge */}
				<div className='flex justify-center mb-[28px]'>
					<span
						className='inline-flex items-center gap-[8px] text-[11px] px-[14px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-medium'
						style={isDark
							? { border: '1px solid rgba(68,170,255,0.35)', color: 'rgba(100,180,255,0.9)' }
							: { border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }
						}
					>
						<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						{isEdit ? t('create_game.badge_edit') : t('create_game.badge_new')}
					</span>
				</div>

				{/* Card */}
				<div
					className='relative rounded-[24px] px-[28px] md:px-[40px] py-[36px] md:py-[44px]'
					style={isDark
						? { border: '1px solid rgba(68,170,255,0.18)', background: 'rgba(3,6,25,0.62)', backdropFilter: 'blur(14px)' }
						: { border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }
					}
				>
					{/* Close */}
					<button
						onClick={() => navigate('/games')}
						aria-label='Закрити'
						className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.06)]'
						style={isDark
							? { color: 'rgba(180,200,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }
							: { color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
						}
					>
						<X size={14} strokeWidth={2} />
					</button>

					{/* Heading */}
					<h1 className='font-amatic text-[30px] md:text-[36px] font-[700] text-white mb-[32px] pr-[36px]'>
						{isEdit ? t('create_game.title_edit') : t('create_game.title_new')}
					</h1>

					<form onSubmit={handleSubmit} noValidate className='flex flex-col gap-[24px]'>

						{/* ── Назва + короткий опис ── */}
						<section className='flex flex-col gap-[12px]'>
							<SectionLabel>{t('create_game.section_info')}</SectionLabel>
							<InputField
								icon={<Scroll size={15} strokeWidth={1.8} />}
								placeholder={t('create_game.name_placeholder')}
								value={title}
								onChange={v => { setTitle(v); setErrors(e => ({ ...e, title: undefined! })) }}
								error={errors.title}
							/>
							<div className='flex flex-col gap-[4px]'>
								<textarea
									placeholder={t('create_game.description_placeholder')}
									value={description}
									onChange={e => setDescription(e.target.value.slice(0, 500))}
									rows={3}
									className='w-full rounded-[12px] py-[12px] px-[14px] text-[14px] leading-[1.65] focus:outline-none transition-all resize-none'
									style={{
										background: isDark ? '#060e24' : 'var(--bg-input)',
										border: `1px solid ${isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'}`,
										color: isDark ? 'rgba(180,200,255,0.85)' : 'var(--text-primary)',
									}}
									onFocus={e => {
										e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.6)' : 'var(--accent)'
										if (isDark) e.currentTarget.style.boxShadow = '0 0 14px rgba(68,170,255,0.1)'
									}}
									onBlur={e => {
										e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'
										e.currentTarget.style.boxShadow = ''
									}}
								/>
								<span className={`text-[11px] text-right pr-[2px] transition-colors ${description.length >= 480 ? 'text-[rgba(255,183,40,0.7)]' : 'text-[rgba(100,140,220,0.55)]'}`}>
									{description.length} / 500
								</span>
							</div>
						</section>

						<Divider />

						{/* ── Зображення ── */}
						<section className='flex flex-col gap-[16px]'>
							<SectionLabel>{t('create_game.section_images')}</SectionLabel>

							{/* Cover image */}
							<div className='flex flex-col gap-[8px]'>
								<span className='text-[13px]' style={{ color: isDark ? 'rgba(140,170,255,0.75)' : 'var(--text-secondary)' }}>{t('create_game.cover_label')}</span>
								<div
									className='relative w-full aspect-[16/7] rounded-[14px] overflow-hidden'
									style={{
										border: `1px solid ${isDark ? 'rgba(68,170,255,0.18)' : 'var(--border-subtle)'}`,
										background: isDark ? '#060e24' : 'var(--bg-input)',
									}}
								>
									<img
										src={coverImage || DEFAULT_COVER}
										alt='cover'
										className='w-full h-full object-cover'
									/>
									<div className='absolute inset-0 flex items-center justify-center gap-[10px] bg-[rgba(3,6,25,0.45)] opacity-0 hover:opacity-100 transition-opacity'>
										<label className='flex items-center gap-[6px] px-[14px] py-[8px] rounded-[10px] bg-[rgba(68,170,255,0.15)] border border-[rgba(68,170,255,0.35)] text-[#44aaff] text-[13px] font-[600] cursor-pointer hover:bg-[rgba(68,170,255,0.25)] transition-all'>
											{coverUploading
												? <span className='w-[4px] h-[4px] rounded-full bg-[#44aaff] pulse-dot-anim' />
												: <><ImagePlus size={14} strokeWidth={2} />{t('create_game.upload_cover')}</>
											}
											<input type='file' accept='image/*' className='hidden' onChange={handleCoverUpload} disabled={coverUploading} />
										</label>
										{coverImage && (
											<button
												type='button'
												onClick={() => setCoverImage('')}
												className='flex items-center gap-[6px] px-[14px] py-[8px] rounded-[10px] bg-[rgba(255,90,160,0.1)] border border-[rgba(255,90,160,0.3)] text-[rgba(255,90,160,0.8)] text-[13px] font-[600] cursor-pointer hover:bg-[rgba(255,90,160,0.2)] transition-all'
											>
												<X size={13} strokeWidth={2} />{t('create_game.remove_cover')}
											</button>
										)}
									</div>
								</div>
							</div>

							{/* Additional images */}
							<div className='flex flex-col gap-[8px]'>
								<span className='text-[13px]' style={{ color: isDark ? 'rgba(140,170,255,0.75)' : 'var(--text-secondary)' }}>
									{t('create_game.images_label')} ({images.length}/10)
								</span>
								<div className='grid grid-cols-4 gap-[8px] sm:grid-cols-5'>
									{images.map((url, i) => (
										<div
											key={i}
											className='relative aspect-square rounded-[10px] overflow-hidden'
											style={{
												border: `1px solid ${isDark ? 'rgba(68,170,255,0.15)' : 'var(--border-subtle)'}`,
												background: isDark ? '#060e24' : 'var(--bg-input)',
											}}
										>
											<img src={url} alt='' className='w-full h-full object-cover' />
											<button
												type='button'
												onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
												className='absolute top-[4px] right-[4px] w-[18px] h-[18px] rounded-full bg-[rgba(0,0,0,0.65)] flex items-center justify-center text-white hover:bg-[rgba(255,90,160,0.8)] transition-all cursor-pointer'
											>
												<X size={10} strokeWidth={2.5} />
											</button>
										</div>
									))}
									{images.length < 10 && (
										<label
											className='aspect-square rounded-[10px] border border-dashed flex flex-col items-center justify-center gap-[4px] cursor-pointer transition-all'
											style={{
												borderColor: isDark ? 'rgba(68,170,255,0.25)' : 'var(--border-medium)',
												background: isDark ? 'rgba(68,170,255,0.03)' : 'transparent',
											}}
										>
											{imgUploading
												? <span className='w-[4px] h-[4px] rounded-full bg-[#44aaff] pulse-dot-anim' />
												: <>
													<ImagePlus size={18} strokeWidth={1.5} style={{ color: isDark ? 'rgba(68,170,255,0.35)' : 'var(--text-muted)' }} />
													<span className='text-[10px]' style={{ color: isDark ? 'rgba(68,170,255,0.35)' : 'var(--text-muted)' }}>+</span>
												  </>
											}
											<input type='file' accept='image/*' multiple className='hidden' onChange={handleImagesUpload} disabled={imgUploading || images.length >= 10} />
										</label>
									)}
								</div>
							</div>
						</section>

						<Divider />

						{/* ── Гравці ── */}
						<section>
							<SectionLabel>{t('create_game.section_players')}</SectionLabel>
							<div className='flex items-end gap-[12px]'>
								<div className='flex flex-col gap-[6px] items-center'>
									<span className='text-[12px] uppercase tracking-[0.4px]' style={{ color: isDark ? 'rgba(140,170,255,0.72)' : 'var(--text-muted)' }}>{t('create_game.min_label')}</span>
									<NumInput value={minPlayers} onChange={setMinPlayers} min={1} max={99} className='w-[72px]' />
								</div>
								<span className='text-[20px] pb-[10px]' style={{ color: isDark ? 'rgba(140,170,255,0.55)' : 'var(--text-muted)' }}>—</span>
								<div className='flex flex-col gap-[6px] items-center'>
									<span className='text-[12px] uppercase tracking-[0.4px]' style={{ color: isDark ? 'rgba(140,170,255,0.72)' : 'var(--text-muted)' }}>{t('create_game.max_label')}</span>
									<NumInput value={maxPlayers} onChange={setMaxPlayers} min={1} max={99} error={errors.maxPlayers} className='w-[72px]' />
								</div>
								<div className='flex items-center gap-[6px] pb-[10px]'>
									<Users size={14} strokeWidth={1.8} style={{ color: isDark ? 'rgba(68,170,255,0.4)' : 'var(--text-muted)' }} />
									<span className='text-[14px] whitespace-nowrap' style={{ color: isDark ? 'rgba(140,165,255,0.75)' : 'var(--text-secondary)' }}>{t('create_game.players_label')}</span>
								</div>
							</div>
							{errors.maxPlayers && (
								<span className='text-[12px] text-[rgba(255,90,160,0.85)] mt-[4px] block'>{errors.maxPlayers}</span>
							)}
						</section>

						<Divider />

						{/* ── Сценарій ── */}
						<section>
							<SectionLabel>{t('create_game.section_scenario')}</SectionLabel>
							<textarea
								placeholder={t('create_game.scenario_placeholder')}
								value={scenario}
								onChange={e => setScenario(e.target.value)}
								rows={5}
								className='w-full rounded-[12px] py-[12px] px-[14px] text-[14px] leading-[1.7] focus:outline-none transition-all resize-y min-h-[120px]'
								style={{
									background: isDark ? '#060e24' : 'var(--bg-input)',
									border: `1px solid ${isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'}`,
									color: isDark ? 'rgba(180,200,255,0.85)' : 'var(--text-primary)',
								}}
								onFocus={e => {
									e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.6)' : 'var(--accent)'
									if (isDark) e.currentTarget.style.boxShadow = '0 0 14px rgba(68,170,255,0.1)'
								}}
								onBlur={e => {
									e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'
									e.currentTarget.style.boxShadow = ''
								}}
							/>
						</section>

						<Divider />

						{/* ── Ресурси ── */}
						<section>
							<SectionLabel>{t('create_game.section_resources')}</SectionLabel>
							<div className='flex flex-col gap-[16px]'>

								{/* Монети */}
								<div className='flex flex-col gap-[10px]'>
									<Toggle
										checked={useCoins}
										onChange={setUseCoins}
										label={t('create_game.use_coins')}
										icon={<CircleDollarSign size={15} strokeWidth={1.8} />}
									/>
									{useCoins && (
										<div className='flex items-center gap-[10px] pl-[54px]'>
											<span className='text-[13px] whitespace-nowrap' style={{ color: isDark ? 'rgba(180,200,255,0.72)' : 'var(--text-secondary)' }}>{t('create_game.per_player')}</span>
											<NumInput
												value={coinsPerPlayer}
												onChange={setCoinsPerPlayer}
												min={1}
												error={errors.coinsPerPlayer}
												className='w-[80px]'
											/>
										</div>
									)}
								</div>

								{/* Бали впливу */}
								<div className='flex flex-col gap-[10px]'>
									<Toggle
										checked={useInfluence}
										onChange={setUseInfluence}
										label={t('create_game.use_influence')}
										icon={<Zap size={15} strokeWidth={1.8} />}
									/>
									{useInfluence && (
										<div className='flex items-center gap-[10px] pl-[54px]'>
											<span className='text-[13px] whitespace-nowrap' style={{ color: isDark ? 'rgba(180,200,255,0.72)' : 'var(--text-secondary)' }}>{t('create_game.per_player')}</span>
											<NumInput
												value={influencePerPlayer}
												onChange={setInfluencePerPlayer}
												min={1}
												error={errors.influencePerPlayer}
												className='w-[80px]'
											/>
										</div>
									)}
								</div>
							</div>
						</section>

						<Divider />

						{/* ── Дата і час ── */}
						<section>
							<SectionLabel>
								<span className='flex items-center gap-[6px]'>
									<CalendarDays size={12} strokeWidth={2} />
									{t('create_game.section_schedule')}
								</span>
							</SectionLabel>
							<input
								type='datetime-local'
								value={scheduledAt}
								onChange={e => setScheduledAt(e.target.value)}
								className='w-full rounded-[12px] py-[12px] px-[14px] text-[14px] focus:outline-none transition-all [color-scheme:dark]'
								style={{
									background: isDark ? '#060e24' : 'var(--bg-input)',
									border: `1px solid ${isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'}`,
									color: isDark ? 'rgba(180,200,255,0.88)' : 'var(--text-primary)',
								}}
								onFocus={e => {
									e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.6)' : 'var(--accent)'
									if (isDark) e.currentTarget.style.boxShadow = '0 0 14px rgba(68,170,255,0.1)'
								}}
								onBlur={e => {
									e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'
									e.currentTarget.style.boxShadow = ''
								}}
							/>
						</section>

						<Divider />

						{/* ── Таймер за замовчуванням ── */}
						<section className='flex flex-col gap-[12px]'>
							<SectionLabel>⏱ Таймер за замовчуванням</SectionLabel>
							<Toggle
								checked={useDefaultTimer}
								onChange={setUseDefaultTimer}
								label='Встановити таймер для гри'
							/>
							{useDefaultTimer && (
								<div className='flex items-center gap-[10px] pl-[54px]'>
									<div className='flex flex-col items-center gap-[4px]'>
										<span className='text-[10px] uppercase tracking-[0.5px]' style={{ color: isDark ? 'rgba(100,140,220,0.45)' : 'var(--text-muted)' }}>Хв</span>
										<NumInput
											value={defaultTimerMins}
											onChange={v => setDefaultTimerMins(Math.max(0, Math.min(99, v)))}
											min={0}
											max={99}
											className='w-[72px]'
										/>
									</div>
									<span className='text-[22px] font-[300] pt-[14px]' style={{ color: isDark ? 'rgba(100,140,220,0.4)' : 'var(--text-muted)' }}>:</span>
									<div className='flex flex-col items-center gap-[4px]'>
										<span className='text-[10px] uppercase tracking-[0.5px]' style={{ color: isDark ? 'rgba(100,140,220,0.45)' : 'var(--text-muted)' }}>Сек</span>
										<NumInput
											value={defaultTimerSecs}
											onChange={v => setDefaultTimerSecs(Math.max(0, Math.min(59, v)))}
											min={0}
											max={59}
											className='w-[72px]'
										/>
									</div>
									<span className='text-[12px] pt-[14px]' style={{ color: isDark ? 'rgba(140,170,255,0.6)' : 'var(--text-secondary)' }}>
										Таймер буде показано при вході в кімнату (не запущений)
									</span>
								</div>
							)}
						</section>

						<Divider />

						{/* ── Оплата / Донат ── */}
						<section className='flex flex-col gap-[16px]'>
							<SectionLabel>
								<span className='flex items-center gap-[6px]'>
									<Banknote size={12} strokeWidth={2} />
									Оплата та донат
								</span>
							</SectionLabel>

							{/* Participation cost */}
							<div className='flex flex-col gap-[8px]'>
								<span className='text-[13px]' style={{ color: isDark ? 'rgba(140,170,255,0.82)' : 'var(--text-secondary)' }}>Вартість участі (грн)</span>
								<div className='flex items-center gap-[10px]'>
									<NumInput
										value={participationCost}
										onChange={setParticipationCost}
										min={0}
										className='w-[100px]'
									/>
									<span className='text-[13px]' style={{ color: isDark ? 'rgba(140,170,255,0.65)' : 'var(--text-muted)' }}>грн · 0 = безкоштовно</span>
								</div>
							</div>

							{/* GM card number */}
							<div className='flex flex-col gap-[8px]'>
								<span className='text-[13px]' style={{ color: isDark ? 'rgba(140,170,255,0.82)' : 'var(--text-secondary)' }}>
									Картка ігромайстра (для донатів)
								</span>
								<div className='relative'>
									<CreditCard size={14} strokeWidth={1.8}
										className='absolute left-[12px] top-1/2 -translate-y-1/2 pointer-events-none'
										style={{ color: errors.gmCardNumber ? 'rgba(255,90,160,0.6)' : (isDark ? 'rgba(68,170,255,0.45)' : 'var(--text-muted)') }}
									/>
									<input
										type='text'
										inputMode='numeric'
										placeholder='1234 5678 9012 3456'
										value={gmCardNumber}
										onChange={e => {
											const formatted = formatCard(e.target.value)
											setGmCardNumber(formatted)
											setErrors(prev => ({ ...prev, gmCardNumber: undefined! }))
										}}
										maxLength={19}
										className='w-full rounded-[12px] py-[10px] pl-[38px] pr-[14px] text-[15px] font-[600] tracking-[3px] focus:outline-none transition-all'
										style={errors.gmCardNumber
											? {
												background: isDark ? '#060e24' : 'var(--bg-input)',
												border: '1px solid rgba(255,90,160,0.55)',
												color: isDark ? 'rgba(180,200,255,0.9)' : 'var(--text-primary)',
											}
											: {
												background: isDark ? '#060e24' : 'var(--bg-input)',
												border: `1px solid ${isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'}`,
												color: isDark ? 'rgba(180,200,255,0.9)' : 'var(--text-primary)',
											}
										}
										onFocus={e => {
											if (!errors.gmCardNumber) {
												e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.6)' : 'var(--accent)'
												if (isDark) e.currentTarget.style.boxShadow = '0 0 10px rgba(68,170,255,0.1)'
											}
										}}
										onBlur={e => {
											if (!errors.gmCardNumber) {
												e.currentTarget.style.borderColor = isDark ? 'rgba(68,170,255,0.2)' : 'var(--border-subtle)'
												e.currentTarget.style.boxShadow = ''
											}
										}}
									/>
								</div>
								{errors.gmCardNumber && (
									<span className='text-[11px] text-[rgba(255,90,160,0.85)]'>{errors.gmCardNumber}</span>
								)}
								<span className='text-[12px]' style={{ color: isDark ? 'rgba(100,140,220,0.65)' : 'var(--text-muted)' }}>
									Номер буде показано гравцям лише після натискання кнопки «Донат»
								</span>
							</div>
						</section>

						{/* ── Submit ── */}
						<div className='pt-[4px]'>
							<AuthButton loading={loading} type='submit'>
								{isEdit ? t('create_game.btn_update') : t('create_game.btn_create')}
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
				closeLabel={t('create_game.modal_close')}
			/>
		</div>
	)
}
