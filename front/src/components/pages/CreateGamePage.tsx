import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Scroll, Users, CircleDollarSign, Zap, CalendarDays, X, ImagePlus } from 'lucide-react'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useAuth } from '../../context/AuthContext'
import { InputField } from '../minicomponents/InputField'
import { AuthButton } from '../minicomponents/AuthButton'
import { Modal } from '../minicomponents/Modal'
import { createGame, updateGame, getGameForEdit } from '../../actions/games'

// ─── Local mini-components ───────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
	<span className='block text-[11px] uppercase tracking-[0.6px] text-[rgba(68,170,255,0.55)] font-[600] mb-[10px]'>
		{children}
	</span>
)

const Divider = () => (
	<div className='border-t border-[rgba(68,170,255,0.08)]' />
)

const NumInput = ({
	value, onChange, min = 1, max, error, className = '',
}: {
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	error?: string
	className?: string
}) => (
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
			className={`w-full bg-[#060e24] border rounded-[10px] py-[10px] px-[12px] text-[rgba(180,200,255,0.9)] text-[15px] text-center font-[600] focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
				error
					? 'border-[rgba(255,90,160,0.55)]'
					: 'border-[rgba(68,170,255,0.2)] focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_10px_rgba(68,170,255,0.1)]'
			}`}
		/>
		{error && (
			<span className='text-[11px] text-[rgba(255,90,160,0.85)] text-center leading-[1.3]'>
				{error}
			</span>
		)}
	</div>
)

const Toggle = ({
	checked, onChange, label, icon,
}: {
	checked: boolean
	onChange: (v: boolean) => void
	label: string
	icon?: React.ReactNode
}) => (
	<label className='flex items-center gap-[12px] cursor-pointer select-none'>
		<div
			className={`relative w-[42px] h-[24px] rounded-full transition-all duration-[220ms] flex-shrink-0 ${
				checked
					? 'bg-[rgba(68,170,255,0.2)] border border-[rgba(68,170,255,0.55)]'
					: 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)]'
			}`}
		>
			<div className={`absolute top-[4px] w-[16px] h-[16px] rounded-full transition-all duration-[220ms] ${
				checked
					? 'left-[22px] bg-[#44aaff] shadow-[0_0_8px_rgba(68,170,255,0.65)]'
					: 'left-[4px] bg-[rgba(180,200,255,0.2)]'
			}`} />
		</div>
		{icon && (
			<span className={`transition-colors ${checked ? 'text-[rgba(180,200,255,0.7)]' : 'text-[rgba(180,200,255,0.25)]'}`}>
				{icon}
			</span>
		)}
		<span className={`text-[14px] transition-colors ${checked ? 'text-[rgba(180,200,255,0.85)]' : 'text-[rgba(180,200,255,0.4)]'}`}>
			{label}
		</span>
		<input type='checkbox' checked={checked} onChange={e => onChange(e.target.checked)} className='hidden' />
	</label>
)

// ─── Main page ────────────────────────────────────────────────────────────────

export const CreateGamePage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { id } = useParams<{ id?: string }>()
	const [searchParams] = useSearchParams()
	const { token, isLoggedIn, isLoading } = useAuth()

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

	const DEFAULT_COVER = 'https://res.cloudinary.com/dsgqhwqr7/image/upload/v1776487495/none-399125188_ca4czg.webp'

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
				if (g.coverImage) setCoverImage(g.coverImage)
				setImages(g.images || [])
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
		setErrors(errs)
		return Object.keys(errs).length === 0
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!validate() || !token) return
		setLoading(true)
		try {
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
				scheduledAt: scheduledAt || undefined,
				coverImage,
				images,
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
		if (!file) return
		setCoverUploading(true)
		try {
			const url = await uploadToCloudinary(file)
			setCoverImage(url)
		} catch { /* silent */ } finally {
			setCoverUploading(false)
			e.target.value = ''
		}
	}

	const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || [])
		if (!files.length) return
		const remaining = 10 - images.length
		const toUpload  = files.slice(0, remaining)
		setImgUploading(true)
		try {
			const urls = await Promise.all(toUpload.map(uploadToCloudinary))
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
					style={{ background: 'radial-gradient(circle, rgba(40,80,255,0.13) 0%, transparent 65%)' }}
				/>
			</div>

			<div className='relative z-10 w-full max-w-[580px]'>
				{/* Badge */}
				<div className='flex justify-center mb-[28px]'>
					<span className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(100,180,255,0.9)] text-[11px] px-[14px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-medium'>
						<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						{isEdit ? t('create_game.badge_edit') : t('create_game.badge_new')}
					</span>
				</div>

				{/* Card */}
				<div className='relative border border-[rgba(68,170,255,0.18)] rounded-[24px] px-[28px] md:px-[40px] py-[36px] md:py-[44px] bg-[rgba(3,6,25,0.62)] backdrop-blur-[14px]'>
					{/* Close */}
					<button
						onClick={() => navigate('/games')}
						aria-label='Закрити'
						className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center text-[rgba(180,200,255,0.35)] border border-[rgba(255,255,255,0.08)] hover:text-white hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer'
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
									className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.2)] text-[rgba(180,200,255,0.85)] placeholder-[rgba(100,140,220,0.3)] rounded-[12px] py-[12px] px-[14px] text-[14px] leading-[1.65] focus:outline-none focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_14px_rgba(68,170,255,0.1)] transition-all resize-none'
								/>
								<span className={`text-[11px] text-right pr-[2px] transition-colors ${description.length >= 480 ? 'text-[rgba(255,183,40,0.7)]' : 'text-[rgba(100,140,220,0.3)]'}`}>
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
								<span className='text-[12px] text-[rgba(100,140,220,0.45)]'>{t('create_game.cover_label')}</span>
								<div className='relative w-full aspect-[16/7] rounded-[14px] overflow-hidden border border-[rgba(68,170,255,0.18)] bg-[#060e24]'>
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
								<span className='text-[12px] text-[rgba(100,140,220,0.45)]'>
									{t('create_game.images_label')} ({images.length}/10)
								</span>
								<div className='grid grid-cols-4 gap-[8px] sm:grid-cols-5'>
									{images.map((url, i) => (
										<div key={i} className='relative aspect-square rounded-[10px] overflow-hidden border border-[rgba(68,170,255,0.15)] bg-[#060e24]'>
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
										<label className='aspect-square rounded-[10px] border border-dashed border-[rgba(68,170,255,0.25)] bg-[rgba(68,170,255,0.03)] flex flex-col items-center justify-center gap-[4px] cursor-pointer hover:border-[rgba(68,170,255,0.5)] hover:bg-[rgba(68,170,255,0.07)] transition-all'>
											{imgUploading
												? <span className='w-[4px] h-[4px] rounded-full bg-[#44aaff] pulse-dot-anim' />
												: <>
													<ImagePlus size={18} strokeWidth={1.5} className='text-[rgba(68,170,255,0.35)]' />
													<span className='text-[10px] text-[rgba(68,170,255,0.35)]'>+</span>
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
									<span className='text-[11px] text-[rgba(100,140,220,0.4)] uppercase tracking-[0.4px]'>{t('create_game.min_label')}</span>
									<NumInput value={minPlayers} onChange={setMinPlayers} min={1} max={99} className='w-[72px]' />
								</div>
								<span className='text-[rgba(100,140,220,0.3)] text-[20px] pb-[10px]'>—</span>
								<div className='flex flex-col gap-[6px] items-center'>
									<span className='text-[11px] text-[rgba(100,140,220,0.4)] uppercase tracking-[0.4px]'>{t('create_game.max_label')}</span>
									<NumInput value={maxPlayers} onChange={setMaxPlayers} min={1} max={99} error={errors.maxPlayers} className='w-[72px]' />
								</div>
								<div className='flex items-center gap-[6px] pb-[10px]'>
									<Users size={14} strokeWidth={1.8} className='text-[rgba(68,170,255,0.4)]' />
									<span className='text-[13px] text-[rgba(100,140,220,0.4)] whitespace-nowrap'>{t('create_game.players_label')}</span>
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
								className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.2)] text-[rgba(180,200,255,0.85)] placeholder-[rgba(100,140,220,0.3)] rounded-[12px] py-[12px] px-[14px] text-[14px] leading-[1.7] focus:outline-none focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_14px_rgba(68,170,255,0.1)] transition-all resize-y min-h-[120px]'
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
											<span className='text-[13px] text-[rgba(180,200,255,0.4)] whitespace-nowrap'>{t('create_game.per_player')}</span>
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
											<span className='text-[13px] text-[rgba(180,200,255,0.4)] whitespace-nowrap'>{t('create_game.per_player')}</span>
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
								className='w-full bg-[#060e24] border border-[rgba(68,170,255,0.2)] text-[rgba(180,200,255,0.75)] rounded-[12px] py-[12px] px-[14px] text-[14px] focus:outline-none focus:border-[rgba(68,170,255,0.6)] focus:shadow-[0_0_14px_rgba(68,170,255,0.1)] transition-all [color-scheme:dark]'
							/>
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
