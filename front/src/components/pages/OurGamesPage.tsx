import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gamepad2, Users, CircleDollarSign, Zap, CalendarDays, Pencil, Trash2, UserCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../minicomponents/Modal'
import { getGames, getGameForEdit, registerForGame, unregisterFromGame, registerAsSpectator, unregisterAsSpectator, deleteGame, GameData } from '../../actions/games'

export const OurGamesPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { user, token, isLoggedIn } = useAuth()

	const [games, setGames]               = useState<GameData[]>([])
	const [pageLoading, setPageLoading]   = useState(true)
	const [editLoading, setEditLoading]   = useState<string | null>(null)
	const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
	const [registerLoading, setRegisterLoading]         = useState<string | null>(null)
	const [unregisterLoading, setUnregisterLoading]     = useState<string | null>(null)
	const [spectatorLoading, setSpectatorLoading]       = useState<string | null>(null)
	const [unspectatorLoading, setUnspectatorLoading]   = useState<string | null>(null)

	const [modal, setModal] = useState<{
		open: boolean; title: string; message: string; variant: 'success' | 'error'
		gameCode?: string
	}>({ open: false, title: '', message: '', variant: 'error' })

	const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; gameId: string | null }>({
		open: false, gameId: null,
	})

	const [playersModal, setPlayersModal] = useState<{ open: boolean; game: GameData | null }>({
		open: false, game: null,
	})

	useEffect(() => {
		getGames()
			.then(setGames)
			.catch(() => setGames([]))
			.finally(() => setPageLoading(false))
	}, [])

	const handleEdit = async (gameId: string) => {
		if (!token) { navigate('/auth'); return }
		setEditLoading(gameId)
		try {
			await getGameForEdit(token, gameId)
			navigate(`/create-game/${gameId}`)
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			setModal({
				open: true,
				title: t('our_games.err_forbidden_title'),
				message: msg === 'FORBIDDEN' ? t('our_games.err_forbidden_msg') : msg,
				variant: 'error',
			})
		} finally {
			setEditLoading(null)
		}
	}

	const handleDeleteConfirm = async () => {
		const gameId = deleteConfirm.gameId
		if (!gameId || !token) return
		setDeleteConfirm({ open: false, gameId: null })
		setDeleteLoading(gameId)
		try {
			await deleteGame(token, gameId)
			setGames(prev => prev.filter(g => g._id !== gameId))
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			setModal({
				open: true,
				title: t('our_games.err_forbidden_title'),
				message: msg === 'FORBIDDEN' ? t('our_games.err_forbidden_msg') : msg,
				variant: 'error',
			})
		} finally {
			setDeleteLoading(null)
		}
	}

	const handleRegister = async (gameId: string) => {
		if (!token) { navigate('/auth'); return }
		setRegisterLoading(gameId)
		try {
			const res = await registerForGame(token, gameId)
			setGames(prev => prev.map(g =>
				g._id === gameId ? { ...g, registeredPlayers: res.registeredPlayers } : g
			))
			setModal({
				open: true,
				title: t('our_games.success_register_title'),
				message: t('our_games.success_register_msg'),
				variant: 'success',
				gameCode: res.gameCode,
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			const text =
				msg === 'ALREADY_REGISTERED'     ? t('our_games.err_already_registered') :
				msg === 'MAX_PLAYERS_REACHED'     ? t('our_games.err_max_players') :
				msg === 'CREATOR_CANNOT_REGISTER' ? t('our_games.err_creator_register') :
				msg
			setModal({ open: true, title: t('our_games.err_register_title'), message: text, variant: 'error' })
		} finally {
			setRegisterLoading(null)
		}
	}

	const handleUnregister = async (gameId: string) => {
		if (!token) return
		setUnregisterLoading(gameId)
		try {
			const res = await unregisterFromGame(token, gameId)
			setGames(prev => prev.map(g =>
				g._id === gameId ? { ...g, registeredPlayers: res.registeredPlayers } : g
			))
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			setModal({ open: true, title: t('our_games.err_register_title'), message: msg, variant: 'error' })
		} finally {
			setUnregisterLoading(null)
		}
	}

	const handleRegisterSpectator = async (gameId: string) => {
		if (!token) { navigate('/auth'); return }
		setSpectatorLoading(gameId)
		try {
			const res = await registerAsSpectator(token, gameId)
			setGames(prev => prev.map(g =>
				g._id === gameId ? { ...g, spectators: res.spectators, spectatorCode: res.spectatorCode } : g
			))
			setModal({
				open: true,
				title: t('our_games.success_spectator_title'),
				message: t('our_games.success_spectator_msg'),
				variant: 'success',
				gameCode: res.spectatorCode,
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			const text =
				msg === 'ALREADY_REGISTERED'           ? 'Ви вже зареєстровані.' :
				msg === 'ALREADY_REGISTERED_AS_PLAYER' ? 'Ви вже зареєстровані як гравець.' :
				msg === 'CREATOR_CANNOT_REGISTER'      ? t('our_games.err_creator_register') :
				msg
			setModal({ open: true, title: t('our_games.err_register_title'), message: text, variant: 'error' })
		} finally {
			setSpectatorLoading(null)
		}
	}

	const handleUnregisterSpectator = async (gameId: string) => {
		if (!token) return
		setUnspectatorLoading(gameId)
		try {
			const res = await unregisterAsSpectator(token, gameId)
			setGames(prev => prev.map(g =>
				g._id === gameId ? { ...g, spectators: res.spectators } : g
			))
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Error'
			setModal({ open: true, title: t('our_games.err_register_title'), message: msg, variant: 'error' })
		} finally {
			setUnspectatorLoading(null)
		}
	}

	if (pageLoading) {
		return (
			<div className='min-h-[88vh] flex items-center justify-center'>
				<div className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim' />
			</div>
		)
	}

	return (
		<div className='relative min-h-[88vh] px-[20px] md:px-[40px] lg:px-[64px] py-[40px] md:py-[60px] overflow-hidden'>
			<div className='absolute inset-0 flex items-start justify-center pointer-events-none z-0 pt-[80px]'>
				<div
					className='w-[600px] h-[600px] rounded-full'
					style={{ background: 'radial-gradient(circle, rgba(40,80,255,0.10) 0%, transparent 65%)' }}
				/>
			</div>

			<div className='relative z-10 max-w-[1200px] mx-auto'>
				<div className='flex flex-col md:flex-row md:items-end md:justify-between gap-[20px] mb-[40px]'>
					<div>
						<span className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(100,180,255,0.9)] text-[11px] px-[14px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-medium mb-[14px]'>
							<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
							Games of Senses
						</span>
						<h1 className='font-amatic text-[34px] md:text-[44px] font-[700] text-white leading-[1.1]'>
							{t('our_games.title')}
						</h1>
					</div>

					{isLoggedIn && (
						<button
							onClick={() => navigate('/create-game')}
							className='self-start md:self-auto flex items-center gap-[8px] bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white px-[20px] py-[11px] rounded-[12px] text-[14px] font-[600] hover:shadow-[0_0_24px_rgba(100,80,255,0.4)] hover:-translate-y-[1px] transition-all cursor-pointer whitespace-nowrap'
						>
							+ {t('our_games.btn_create')}
						</button>
					)}
				</div>

				{games.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-[100px] text-center'>
						<div className='w-[60px] h-[60px] rounded-full bg-[rgba(68,170,255,0.07)] border border-[rgba(68,170,255,0.14)] flex items-center justify-center mb-[20px]'>
							<Gamepad2 size={26} strokeWidth={1.4} className='text-[rgba(68,170,255,0.45)]' />
						</div>
						<p className='text-[rgba(180,200,255,0.3)] text-[15px]'>{t('our_games.empty')}</p>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]'>
						{games.map(game => (
							<GameCard
								key={game._id}
								game={game}
								currentUserId={user?.id}
								isLoggedIn={isLoggedIn}
								editLoading={editLoading === game._id}
								deleteLoading={deleteLoading === game._id}
								registerLoading={registerLoading === game._id}
								unregisterLoading={unregisterLoading === game._id}
								spectatorLoading={spectatorLoading === game._id}
								unspectatorLoading={unspectatorLoading === game._id}
								onEdit={() => handleEdit(game._id)}
								onDelete={() => setDeleteConfirm({ open: true, gameId: game._id })}
								onRegister={() => handleRegister(game._id)}
								onUnregister={() => handleUnregister(game._id)}
								onRegisterSpectator={() => handleRegisterSpectator(game._id)}
								onUnregisterSpectator={() => handleUnregisterSpectator(game._id)}
								onShowPlayers={() => setPlayersModal({ open: true, game })}
								onEnterGame={() => navigate(`/game?code=${game.gameCode}`)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Register result modal */}
			<Modal
				isOpen={modal.open}
				onClose={() => setModal(m => ({ ...m, open: false }))}
				title={modal.title}
				message={modal.message}
				variant={modal.variant}
			>
				{modal.variant === 'success' && modal.gameCode && (
					<div className='flex items-center gap-[10px] mt-[4px]'>
						<span className='text-[12px] text-[rgba(180,200,255,0.5)]'>{t('our_games.game_code_label')}</span>
						<span
							className='text-[22px] font-[800] tracking-[4px] font-mono'
							style={{ color: '#0fffc8', textShadow: '0 0 16px rgba(15,255,200,0.4)' }}
						>
							{modal.gameCode}
						</span>
					</div>
				)}
			</Modal>

			{/* Delete confirmation modal */}
			<Modal
				isOpen={deleteConfirm.open}
				onClose={() => setDeleteConfirm({ open: false, gameId: null })}
				title={t('our_games.delete_confirm_title')}
				message={t('our_games.delete_confirm_msg')}
				variant='warn'
				onConfirm={handleDeleteConfirm}
				confirmLabel={t('our_games.delete_confirm_yes')}
				cancelLabel={t('our_games.delete_confirm_no')}
			/>

			{/* Players list modal */}
			<Modal
				isOpen={playersModal.open}
				onClose={() => setPlayersModal({ open: false, game: null })}
				title={t('our_games.players_modal_title')}
				variant='default'
			>
				<PlayersListContent game={playersModal.game} />
			</Modal>
		</div>
	)
}

// ─── Players list ─────────────────────────────────────────────────────────────

const PlayersListContent = ({ game }: { game: GameData | null }) => {
	const { t } = useTranslation()
	if (!game) return null
	if (game.registeredPlayers.length === 0) {
		return <p className='text-[13px] text-[rgba(180,200,255,0.4)]'>{t('our_games.players_empty')}</p>
	}
	return (
		<div className='flex flex-col gap-[8px]'>
			{game.registeredPlayers.map((p, i) => (
				<div key={i} className='flex items-center gap-[8px] text-[13px] text-[rgba(180,200,255,0.75)]'>
					<span className='w-[20px] h-[20px] rounded-full bg-[rgba(68,170,255,0.12)] border border-[rgba(68,170,255,0.2)] flex items-center justify-center text-[10px] text-[rgba(68,170,255,0.7)] flex-shrink-0'>
						{i + 1}
					</span>
					<span>{[p.name, p.surname].filter(Boolean).join(' ')}</span>
				</div>
			))}
		</div>
	)
}

// ─── Game card ────────────────────────────────────────────────────────────────

const GameCard = ({
	game, currentUserId, isLoggedIn,
	editLoading, deleteLoading, registerLoading, unregisterLoading,
	spectatorLoading, unspectatorLoading,
	onEdit, onDelete, onRegister, onUnregister,
	onRegisterSpectator, onUnregisterSpectator,
	onShowPlayers, onEnterGame,
}: {
	game: GameData
	currentUserId?: string
	isLoggedIn: boolean
	editLoading: boolean
	deleteLoading: boolean
	registerLoading: boolean
	unregisterLoading: boolean
	spectatorLoading: boolean
	unspectatorLoading: boolean
	onEdit: () => void
	onDelete: () => void
	onRegister: () => void
	onUnregister: () => void
	onRegisterSpectator: () => void
	onUnregisterSpectator: () => void
	onShowPlayers: () => void
	onEnterGame: () => void
}) => {
	const { t, i18n } = useTranslation()

	const spectators   = game.spectators ?? []
	const isCreator    = !!currentUserId && String(game.creatorId) === String(currentUserId)
	const isRegistered = !!currentUserId && game.registeredPlayers.some(p => String(p.userId) === String(currentUserId))
	const isSpectator  = !!currentUserId && spectators.some(p => String(p.userId) === String(currentUserId))
	const isFull       = game.registeredPlayers.length >= game.maxPlayers
	const regCount     = game.registeredPlayers.length

	const formatDate = (iso: string) => {
		try {
			const d = new Date(iso)
			const locale = i18n.language === 'ua' ? 'uk-UA' : 'en-US'
			return (
				d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) +
				' · ' +
				d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
			)
		} catch { return '' }
	}

	let registerBtn: React.ReactNode = null
	if (isCreator) {
		registerBtn = (
			<button
				onClick={onEnterGame}
				className='px-[12px] py-[7px] rounded-[10px] text-[12px] font-[600] bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white hover:shadow-[0_0_16px_rgba(100,80,255,0.35)] hover:-translate-y-[0.5px] transition-all cursor-pointer whitespace-nowrap'
			>
				{t('our_games.btn_enter_game')}
			</button>
		)
	} else if (isRegistered) {
		registerBtn = (
			<button
				onClick={onUnregister}
				disabled={unregisterLoading}
				className='px-[12px] py-[7px] rounded-[10px] text-[12px] font-[600] transition-all cursor-pointer disabled:opacity-50'
				style={{ color: '#ff5fa0', background: 'rgba(255,95,160,0.07)', border: '1px solid rgba(255,95,160,0.25)' }}
			>
				{unregisterLoading
					? <span className='w-[4px] h-[4px] rounded-full bg-[#ff5fa0] pulse-dot-anim inline-block' />
					: t('our_games.btn_unregister')
				}
			</button>
		)
	} else if (!isSpectator) {
		if (isFull) {
			registerBtn = (
				<button
					disabled
					className='px-[12px] py-[7px] rounded-[10px] text-[12px] font-[600] text-[rgba(180,200,255,0.25)] border border-[rgba(180,200,255,0.08)] cursor-not-allowed'
				>
					{t('our_games.full')}
				</button>
			)
		} else {
			registerBtn = (
				<button
					onClick={onRegister}
					disabled={registerLoading}
					className='px-[12px] py-[7px] rounded-[10px] text-[12px] font-[600] bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white hover:shadow-[0_0_16px_rgba(100,80,255,0.35)] hover:-translate-y-[0.5px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default whitespace-nowrap'
				>
					{registerLoading
						? <span className='w-[4px] h-[4px] rounded-full bg-white pulse-dot-anim inline-block' />
						: t('game.role_player')
					}
				</button>
			)
		}
	}

	return (
		<div className='group relative border border-[rgba(68,170,255,0.13)] rounded-[20px] p-[24px] bg-[rgba(3,6,25,0.52)] backdrop-blur-[10px] hover:border-[rgba(68,170,255,0.28)] hover:bg-[rgba(3,6,25,0.65)] transition-all duration-[200ms] flex flex-col gap-[14px]'>

			{/* Cover image */}
			<div className='w-full aspect-[16/7] rounded-[12px] overflow-hidden mb-[6px] -mx-0 bg-[#060e24]'>
				<img
					src={game.coverImage || 'https://res.cloudinary.com/dsgqhwqr7/image/upload/v1777038005/fon_of_game_uwvu0o.png'}
					alt={game.title}
					className='w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-[200ms]'
				/>
			</div>

			{/* Edit + Delete buttons */}
			{isLoggedIn && (
				<div className='absolute top-[14px] right-[14px] flex gap-[6px]'>
					<button
						onClick={onEdit}
						disabled={editLoading}
						title={t('our_games.edit')}
						className='w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 hover:scale-110'
						style={{ background: 'rgba(8,12,30,0.82)', border: '1px solid rgba(68,170,255,0.28)', color: 'rgba(68,170,255,0.7)', backdropFilter: 'blur(4px)' }}
					>
						{editLoading
							? <span className='w-[4px] h-[4px] rounded-full bg-[#44aaff] pulse-dot-anim' />
							: <Pencil size={11} strokeWidth={2} />
						}
					</button>
					<button
						onClick={onDelete}
						disabled={deleteLoading}
						title={t('our_games.delete')}
						className='w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 hover:scale-110'
						style={{ background: 'rgba(8,12,30,0.82)', border: '1px solid rgba(255,95,160,0.28)', color: 'rgba(255,95,160,0.7)', backdropFilter: 'blur(4px)' }}
					>
						{deleteLoading
							? <span className='w-[4px] h-[4px] rounded-full bg-[#ff5fa0] pulse-dot-anim' />
							: <Trash2 size={11} strokeWidth={2} />
						}
					</button>
				</div>
			)}

			{/* Title + creator */}
			<div className='pr-[70px]'>
				<h3 className='text-[17px] font-[700] text-white leading-[1.3] mb-[4px]'>
					<span className='text-[rgba(180,200,255,0.65)] text-[13px] font-[400]'>
						{t('our_games.title_prefix')} —{' '}
					</span>
					{game.title}
				</h3>
				<p className='text-[12px] text-[rgba(140,170,230,0.7)]'>
					{t('our_games.gamemaster_prefix')} — {game.creatorName}
				</p>
			</div>

			{/* Short description */}
			{game.description && (
				<p className='text-[13px] text-[rgba(180,200,255,0.75)] leading-[1.6] line-clamp-3'>
					{game.description}
				</p>
			)}

			{/* Stats */}
			<div className='flex flex-col gap-[7px]'>
				<StatRow icon={<Users size={13} strokeWidth={1.8} />} color='rgba(68,170,255,0.6)'>
					{game.minPlayers}–{game.maxPlayers} {t('our_games.players')}
				</StatRow>

				{game.useCoins && (
					<StatRow icon={<CircleDollarSign size={13} strokeWidth={1.8} />} color='rgba(255,183,40,0.75)'>
						{game.coinsPerPlayer} {t('our_games.coins_per_player')}
					</StatRow>
				)}

				{game.useInfluence && (
					<StatRow icon={<Zap size={13} strokeWidth={1.8} />} color='rgba(192,127,255,0.75)'>
						{game.influencePerPlayer} {t('our_games.influence_per_player')}
					</StatRow>
				)}

				{game.scheduledAt && (
					<StatRow icon={<CalendarDays size={13} strokeWidth={1.8} />} color='rgba(15,255,200,0.65)'>
						{formatDate(game.scheduledAt)}
					</StatRow>
				)}
			</div>

			{/* GM codes block */}
			{isCreator && game.spectatorCode && (
				<div className='flex gap-[8px] items-center rounded-[10px] px-[10px] py-[7px]'
					style={{ background: 'rgba(180,130,255,0.05)', border: '1px solid rgba(180,130,255,0.15)' }}>
					<span className='text-[10px]' style={{ color: 'rgba(180,130,255,0.45)' }}>👁 Код глядача:</span>
					<span className='text-[13px] font-[700] font-mono tracking-[2px]' style={{ color: '#c07fff' }}>{game.spectatorCode}</span>
				</div>
			)}

			{/* Bottom row: players count + register/unregister buttons */}
			<div className='mt-auto flex flex-col gap-[8px]'>
				{!isCreator && isLoggedIn && !isRegistered && !isSpectator && !isFull && (
					<span className='text-[12px] font-[500] text-right text-[rgba(180,200,255,0.75)]'>
						{t('our_games.register_as_label')}
					</span>
				)}
				<div className='flex items-center justify-between pt-[2px]'>
					<button
						onClick={onShowPlayers}
						className='flex items-center gap-[5px] text-[11px] text-[rgba(68,170,255,0.4)] hover:text-[rgba(68,170,255,0.85)] cursor-pointer transition-colors'
					>
						<UserCheck size={12} strokeWidth={1.8} />
						{regCount} / {game.maxPlayers} {t('our_games.btn_players')}
						{spectators.length > 0 && (
							<span className='ml-[4px]' style={{ color: 'rgba(180,130,255,0.5)' }}>
								· {spectators.length} 👁
							</span>
						)}
					</button>

					<div className='flex gap-[6px] items-center'>
						{/* Spectator button (non-creator, non-registered-player, logged-in) */}
						{!isCreator && isLoggedIn && !isRegistered && (
							isSpectator ? (
								<button
									onClick={onUnregisterSpectator}
									disabled={unspectatorLoading}
									className='px-[10px] py-[6px] rounded-[10px] text-[11px] font-[600] transition-all cursor-pointer disabled:opacity-50'
									style={{ color: 'rgba(180,130,255,0.7)', background: 'rgba(180,130,255,0.07)', border: '1px solid rgba(180,130,255,0.2)' }}
								>
									{unspectatorLoading
										? <span className='w-[4px] h-[4px] rounded-full pulse-dot-anim inline-block' style={{ background: 'rgba(180,130,255,0.7)' }} />
										: t('our_games.btn_unregister')
									}
								</button>
							) : (
								<button
									onClick={onRegisterSpectator}
									disabled={spectatorLoading}
									className='px-[10px] py-[6px] rounded-[10px] text-[11px] font-[600] transition-all cursor-pointer disabled:opacity-50'
									style={{ color: 'rgba(180,130,255,0.8)', background: 'rgba(180,130,255,0.06)', border: '1px solid rgba(180,130,255,0.18)' }}
								>
									{spectatorLoading
										? <span className='w-[4px] h-[4px] rounded-full pulse-dot-anim inline-block' style={{ background: 'rgba(180,130,255,0.8)' }} />
										: `👁 ${t('game.role_spectator')}`
									}
								</button>
							)
						)}

						{registerBtn}
					</div>
				</div>
			</div>
		</div>
	)
}

const StatRow = ({
	icon, color, children,
}: {
	icon: React.ReactNode
	color: string
	children: React.ReactNode
}) => (
	<div className='flex items-center gap-[7px] text-[13px]' style={{ color }}>
		<span className='flex-shrink-0'>{icon}</span>
		<span>{children}</span>
	</div>
)
