import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gamepad2, Users, CircleDollarSign, Zap, CalendarDays, Pencil, Trash2, UserCheck, Heart, Search, CreditCard, Copy, Check, Banknote } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Modal } from '../minicomponents/Modal'
import { getGames, getGameForEdit, registerForGame, unregisterFromGame, registerAsSpectator, unregisterAsSpectator, deleteGame, likeGame, unlikeGame, fetchGameCard, GameData } from '../../actions/games'

// ─── Donate modal ─────────────────────────────────────────────────────────────

function DonateModal({ gameId, cost, token, onClose }: {
	gameId: string
	cost: number
	token: string | null
	onClose: () => void
}) {
	const { isDark } = useTheme()
	const [cardNumber, setCardNumber] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		if (!token) { setLoading(false); return }
		fetchGameCard(token, gameId)
			.then(d => setCardNumber(d.gmCardNumber || ''))
			.catch(() => setCardNumber(''))
			.finally(() => setLoading(false))
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const formatted = cardNumber
		? cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ')
		: ''

	const handleCopy = async () => {
		if (!cardNumber) return
		try {
			await navigator.clipboard.writeText(cardNumber)
			setCopied(true)
			setTimeout(() => setCopied(false), 2500)
		} catch {
			// fallback: select text manually
		}
	}

	return (
		<div className='fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-[16px]'
			style={isDark
				? { background: 'rgba(3,4,15,0.72)', backdropFilter: 'blur(4px)' }
				: { background: 'rgba(240,235,228,0.8)', backdropFilter: 'blur(4px)' }
			}
			onClick={onClose}>
			<div
				className='w-full max-w-[340px] rounded-[20px] p-[24px] flex flex-col gap-[16px]'
				style={isDark
					? { background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.2)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }
					: { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }
				}
				onClick={e => e.stopPropagation()}
			>
				{/* Header */}
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-[8px]'>
						<CreditCard size={16} style={{ color: isDark ? '#44aaff' : 'var(--accent)' }} />
						<span className='text-[15px] font-[700]' style={{ color: isDark ? 'rgba(220,230,255,0.95)' : 'var(--text-primary)' }}>Донат ігромайстру</span>
					</div>
					<button onClick={onClose} className='w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.08)]'
						style={isDark
							? { color: 'rgba(180,200,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }
							: { color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
						}>
						<span className='text-[14px]'>✕</span>
					</button>
				</div>

				{/* Cost */}
				{cost > 0 && (
					<div className='flex items-center gap-[8px] px-[14px] py-[10px] rounded-[10px]'
						style={isDark
							? { background: 'rgba(15,255,200,0.05)', border: '1px solid rgba(15,255,200,0.15)' }
							: { background: 'rgba(192,83,58,0.08)', border: '1px solid rgba(192,83,58,0.15)' }
						}>
						<Banknote size={14} style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }} />
						<span className='text-[13px]' style={{ color: isDark ? 'rgba(200,230,220,0.85)' : 'var(--text-secondary)' }}>Вартість участі:</span>
						<span className='text-[15px] font-[700]' style={{ color: isDark ? '#0fffc8' : 'var(--accent)' }}>{cost} грн</span>
					</div>
				)}

				{/* Card number */}
				<div className='flex flex-col gap-[10px]'>
					{loading ? (
						<div className='flex items-center justify-center py-[20px]'>
							<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim' />
						</div>
					) : cardNumber ? (
						<>
							<span className='text-[11px] uppercase tracking-[0.5px]' style={{ color: isDark ? 'rgba(100,140,220,0.5)' : 'var(--text-muted)' }}>
								Номер картки
							</span>
							<button
								onClick={handleCopy}
								className='relative flex items-center justify-between gap-[8px] rounded-[12px] px-[16px] py-[14px] cursor-pointer transition-all hover:brightness-110 group'
								style={isDark
									? {
										background: copied ? 'rgba(15,255,200,0.08)' : 'rgba(68,170,255,0.06)',
										border: copied ? '1px solid rgba(15,255,200,0.3)' : '1px solid rgba(68,170,255,0.2)',
									}
									: {
										background: 'rgba(192,83,58,0.06)',
										border: '1px solid rgba(192,83,58,0.15)',
									}
								}
							>
								<span className='text-[20px] font-[700] tracking-[3px] font-mono'
									style={{ color: isDark ? (copied ? '#0fffc8' : 'rgba(200,218,255,0.95)') : 'var(--text-primary)' }}>
									{formatted}
								</span>
								<span className='flex items-center gap-[5px] flex-shrink-0 text-[12px] font-[600]'
									style={{ color: isDark ? (copied ? '#0fffc8' : 'rgba(68,170,255,0.75)') : 'var(--accent)' }}>
									{copied ? <><Check size={13} /> Скопійовано</> : <><Copy size={13} /> Копіювати</>}
								</span>
							</button>
							<span className='text-[11px]' style={{ color: isDark ? 'rgba(100,140,220,0.4)' : 'var(--text-muted)' }}>
								Натисніть щоб скопіювати номер картки
							</span>
						</>
					) : (
						<div className='flex flex-col items-center gap-[8px] py-[16px]'>
							<span className='text-[28px]'>🤷</span>
							<span className='text-[13px] text-center' style={{ color: isDark ? 'rgba(160,185,240,0.7)' : 'var(--text-secondary)' }}>
								Упс! Ігромайстер не залишив даних картки
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

type SortKey = 'date' | 'players_asc' | 'players_desc' | 'likes'
type FilterKey = 'next7days' | 'next30days' | 'upTo10' | 'moreThan10'

export const OurGamesPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { user, token, isLoggedIn } = useAuth()
	const { isDark } = useTheme()

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

	const [authModal, setAuthModal] = useState(false)

	const [playersModal, setPlayersModal] = useState<{ open: boolean; game: GameData | null }>({
		open: false, game: null,
	})
	const [donateModal, setDonateModal] = useState<{ open: boolean; gameId: string; cost: number } | null>(null)

	// ── Search / Sort / Filter ──────────────────────────────────────────────────
	const [searchQuery, setSearchQuery]     = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')
	const [sortKey, setSortKey]             = useState<SortKey>('date')
	const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set())

	// 300ms debounce on search input
	useEffect(() => {
		const id = setTimeout(() => setDebouncedSearch(searchQuery), 300)
		return () => clearTimeout(id)
	}, [searchQuery])

	const toggleFilter = useCallback((f: FilterKey) => {
		setActiveFilters(prev => {
			const next = new Set(prev)
			next.has(f) ? next.delete(f) : next.add(f)
			return next
		})
	}, [])

	// ── Likes (API, optimistic update with rollback) ───────────────────────────
	const toggleLike = useCallback(async (gameId: string) => {
		if (!isLoggedIn || !token) return
		const game = games.find(g => g._id === gameId)
		if (!game) return

		const wasLiked = game.isLiked
		// Optimistic update
		setGames(prev => prev.map(g => g._id === gameId
			? { ...g, isLiked: !wasLiked, likesCount: Math.max(0, g.likesCount + (wasLiked ? -1 : 1)) }
			: g
		))
		try {
			const res = wasLiked ? await unlikeGame(token, gameId) : await likeGame(token, gameId)
			// Sync actual counts from server
			setGames(prev => prev.map(g => g._id === gameId
				? { ...g, isLiked: res.isLiked, likesCount: res.likesCount }
				: g
			))
		} catch {
			// Rollback on error
			setGames(prev => prev.map(g => g._id === gameId
				? { ...g, isLiked: wasLiked, likesCount: game.likesCount }
				: g
			))
		}
	}, [isLoggedIn, token, games])

	// ── Computed visible list (single pass: search → filter → sort) ────────────
	const visibleGames = useMemo(() => {
		const now = Date.now()
		const in7  = now + 7  * 86_400_000
		const in30 = now + 30 * 86_400_000

		const filtered = games.filter(g => {
			// Search by title or gamemaster name
			if (debouncedSearch) {
				const q = debouncedSearch.toLowerCase()
				if (!g.title.toLowerCase().includes(q) && !g.creatorName.toLowerCase().includes(q)) return false
			}
			// Date filters (both can be active, AND logic)
			if (activeFilters.has('next7days')) {
				const ts = g.scheduledAt ? new Date(g.scheduledAt).getTime() : null
				if (!ts || ts < now || ts > in7) return false
			}
			if (activeFilters.has('next30days')) {
				const ts = g.scheduledAt ? new Date(g.scheduledAt).getTime() : null
				if (!ts || ts < now || ts > in30) return false
			}
			// Player-count filters by maxPlayers capacity
			if (activeFilters.has('upTo10')    && g.maxPlayers > 10) return false
			if (activeFilters.has('moreThan10') && g.maxPlayers <= 10) return false
			return true
		})

		return [...filtered].sort((a, b) => {
			if (sortKey === 'date') {
				const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity
				const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity
				return at - bt
			}
			if (sortKey === 'players_asc')  return a.registeredPlayers.length - b.registeredPlayers.length
			if (sortKey === 'players_desc') return b.registeredPlayers.length - a.registeredPlayers.length
			if (sortKey === 'likes')        return b.likesCount - a.likesCount
			return 0
		})
	}, [games, debouncedSearch, activeFilters, sortKey])

	// ── Data fetch ──────────────────────────────────────────────────────────────
	useEffect(() => {
		getGames()
			.then(setGames)
			.catch(() => setGames([]))
			.finally(() => setPageLoading(false))
	}, [])

	// ── Handlers (unchanged) ────────────────────────────────────────────────────
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

	const SORT_OPTIONS: { key: SortKey; label: string; purple?: boolean }[] = [
		{ key: 'date',         label: '↗ Найближча дата' },
		{ key: 'players_asc',  label: '↑ Гравці' },
		{ key: 'players_desc', label: '↓ Гравці' },
		{ key: 'likes',        label: '♥ Популярні', purple: true },
	]

	const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
		{ key: 'next7days',   label: '7 днів' },
		{ key: 'next30days',  label: '30 днів' },
		{ key: 'upTo10',      label: '≤ 10 гравців' },
		{ key: 'moreThan10',  label: '> 10 гравців' },
	]

	return (
		<div className='relative min-h-[88vh] px-[20px] md:px-[40px] lg:px-[64px] py-[40px] md:py-[60px] overflow-hidden'>
			<div className='absolute inset-0 flex items-start justify-center pointer-events-none z-0 pt-[80px]'>
				<div
					className='w-[600px] h-[600px] rounded-full'
					style={{ background: isDark ? 'radial-gradient(circle, rgba(40,80,255,0.10) 0%, transparent 65%)' : 'radial-gradient(circle, rgba(192,83,58,0.04) 0%, transparent 65%)' }}
				/>
			</div>

			<div className='relative z-10 max-w-[1200px] mx-auto'>
				{/* Header */}
				<div className='flex flex-col md:flex-row md:items-end md:justify-between gap-[20px] mb-[32px]'>
					<div>
						<span
							className='inline-flex items-center gap-[8px] text-[11px] px-[14px] py-[6px] rounded-[30px] tracking-[0.5px] uppercase font-medium mb-[14px]'
							style={isDark
								? { border: '1px solid rgba(68,170,255,0.35)', color: 'rgba(100,180,255,0.9)' }
								: { border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }
							}
						>
							<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
							Games of Senses
						</span>
						<h1 className='font-amatic text-[34px] md:text-[44px] font-[700] text-white leading-[1.1]'>
							{t('our_games.title')}
						</h1>
					</div>

					<button
						onClick={() => isLoggedIn ? navigate('/create-game') : setAuthModal(true)}
						className='self-start md:self-auto flex items-center gap-[8px] bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white px-[20px] py-[11px] rounded-[12px] text-[14px] font-[600] hover:shadow-[0_0_24px_rgba(100,80,255,0.4)] hover:-translate-y-[1px] transition-all cursor-pointer whitespace-nowrap'
					>
						+ {t('our_games.btn_create')}
					</button>
				</div>

				{/* ── Search / Sort / Filter bar ─────────────────────────────────── */}
				<div className='flex flex-col gap-[12px] mb-[28px]'>
					{/* Search */}
					<div className='relative'>
						<Search
							size={14}
							className='absolute left-[12px] top-1/2 -translate-y-1/2 pointer-events-none'
							style={{ color: isDark ? '#3a4060' : 'var(--text-muted)' }}
						/>
						<input
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							placeholder='Пошук за назвою або ігромайстером...'
							className='w-full pl-[38px] pr-[14px] py-[10px] rounded-[8px] text-[13px] focus:outline-none transition-all'
							style={isDark
								? { background: 'transparent', border: '1px solid #1e2235', color: '#c0cce8' }
								: { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }
							}
							onFocus={e => {
								if (isDark) {
									e.currentTarget.style.borderColor = '#2e3250'
									e.currentTarget.style.color = '#e0e8ff'
								} else {
									e.currentTarget.style.borderColor = 'var(--accent)'
								}
							}}
							onBlur={e => {
								if (isDark) {
									e.currentTarget.style.borderColor = '#1e2235'
									e.currentTarget.style.color = searchQuery ? '#e0e8ff' : '#c0cce8'
								} else {
									e.currentTarget.style.borderColor = 'var(--border-subtle)'
								}
							}}
						/>
					</div>

					{/* Sort row */}
					<div className='flex md:flex-row flex-col md:items-center items-start gap-[7px]'>
						<span className='text-[13px] font-[500] flex-shrink-0 md:min-w-[52px]' style={{ color: isDark ? '#c0cce8' : 'var(--text-secondary)' }}>Сорт:</span>
						<div className='flex flex-wrap gap-[6px]'>
							{SORT_OPTIONS.map(({ key, label, purple }) => {
								const isActive = sortKey === key
								return (
									<button
										key={key}
										onClick={() => setSortKey(key)}
										className='px-[14px] py-[5px] rounded-[20px] text-[13px] font-[500] transition-all cursor-pointer whitespace-nowrap'
										style={isActive
											? isDark
												? purple
													? { background: 'rgba(204,68,255,0.05)', border: '1px solid rgba(204,68,255,0.22)', color: '#cc44ff' }
													: { background: 'rgba(0,255,225,0.05)', border: '1px solid rgba(0,255,225,0.22)', color: '#00ffe1' }
												: { background: 'rgba(192,83,58,0.1)', border: '1px solid rgba(192,83,58,0.4)', color: 'var(--accent)' }
											: isDark
												? { background: 'transparent', border: '1px solid #1e2235', color: '#c0cce8' }
												: { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
										}
									>
										{label}
									</button>
								)
							})}
						</div>
					</div>

					{/* Filter row */}
					<div className='flex md:flex-row flex-col md:items-center items-start gap-[7px] md:pt-0 pt-[10px] md:border-t-0 border-t border-[#111320]'>
						<span className='text-[13px] font-[500] flex-shrink-0 md:min-w-[52px]' style={{ color: isDark ? '#c0cce8' : 'var(--text-secondary)' }}>Фільтр:</span>
						<div className='flex flex-wrap gap-[6px]'>
							{FILTER_OPTIONS.map(({ key, label }) => {
								const on = activeFilters.has(key)
								return (
									<button
										key={key}
										onClick={() => toggleFilter(key)}
										className='px-[14px] py-[5px] rounded-[20px] text-[13px] font-[500] transition-all cursor-pointer whitespace-nowrap'
										style={on
											? isDark
												? { background: 'rgba(0,255,225,0.05)', border: '1px solid rgba(0,255,225,0.22)', color: '#00ffe1' }
												: { background: 'rgba(192,83,58,0.1)', border: '1px solid rgba(192,83,58,0.4)', color: 'var(--accent)' }
											: isDark
												? { background: 'transparent', border: '1px solid #1e2235', color: '#c0cce8' }
												: { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
										}
									>
										{label}
									</button>
								)
							})}
							{activeFilters.size > 0 && (
								<button
									onClick={() => setActiveFilters(new Set())}
									className='px-[12px] py-[5px] rounded-[20px] text-[12px] transition-all cursor-pointer'
									style={{ color: 'rgba(255,95,160,0.88)', border: '1px solid rgba(255,95,160,0.28)', background: 'transparent' }}
								>
									✕ Скинути
								</button>
							)}
						</div>
					</div>
				</div>

				{/* ── Games grid ─────────────────────────────────────────────────── */}
				{visibleGames.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-[100px] text-center'>
						<div
							className='w-[60px] h-[60px] rounded-full flex items-center justify-center mb-[20px]'
							style={isDark
								? { background: 'rgba(68,170,255,0.07)', border: '1px solid rgba(68,170,255,0.14)' }
								: { background: 'rgba(192,83,58,0.06)', border: '1px solid var(--border-subtle)' }
							}
						>
							<Gamepad2 size={26} strokeWidth={1.4} style={{ color: isDark ? 'rgba(68,170,255,0.45)' : 'var(--text-muted)' }} />
						</div>
						<p style={{ color: isDark ? 'rgba(180,200,255,0.7)' : 'var(--text-secondary)', fontSize: '15px' }}>
							{debouncedSearch || activeFilters.size > 0 ? 'Нічого не знайдено' : t('our_games.empty')}
						</p>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]'>
						{visibleGames.map(game => (
							<GameCard
								key={game._id}
								game={game}
								currentUserId={user?.id}
								isLoggedIn={isLoggedIn}
								likeCount={game.likesCount}
								isLikedByMe={game.isLiked}
								onToggleLike={() => toggleLike(game._id)}
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
								onDonate={() => setDonateModal({ open: true, gameId: game._id, cost: game.participationCost || 0 })}
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
						<span className='text-[13px]' style={{ color: isDark ? 'rgba(200,215,255,0.8)' : 'var(--text-muted)' }}>
							{t('our_games.game_code_label')}
						</span>
						<span
							className='text-[22px] font-[800] tracking-[4px] font-mono'
							style={isDark
								? { color: '#0fffc8', textShadow: '0 0 16px rgba(15,255,200,0.4)' }
								: { color: 'var(--accent)' }
							}
						>
							{modal.gameCode}
						</span>
					</div>
				)}
			</Modal>

			{/* Auth required modal */}
			<Modal
				isOpen={authModal}
				onClose={() => setAuthModal(false)}
				title={t('home.auth_required_title')}
				message={t('home.auth_required_msg')}
				variant='warn'
				onConfirm={() => { setAuthModal(false); navigate('/auth') }}
				confirmLabel={t('home.auth_required_confirm')}
				cancelLabel={t('home.auth_required_cancel')}
			/>

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

			{/* Donate modal */}
			{donateModal?.open && (
				<DonateModal
					gameId={donateModal.gameId}
					cost={donateModal.cost}
					token={token}
					onClose={() => setDonateModal(null)}
				/>
			)}
		</div>
	)
}

// ─── Players list ─────────────────────────────────────────────────────────────

const PlayersListContent = ({ game }: { game: GameData | null }) => {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	if (!game) return null
	if (game.registeredPlayers.length === 0) {
		return <p className='text-[14px]' style={{ color: isDark ? 'rgba(200,215,255,0.75)' : 'var(--text-muted)' }}>{t('our_games.players_empty')}</p>
	}
	return (
		<div className='flex flex-col gap-[8px]'>
			{game.registeredPlayers.map((p, i) => (
				<div key={i} className='flex items-center gap-[8px] text-[13px]' style={{ color: isDark ? 'rgba(180,200,255,0.75)' : 'var(--text-secondary)' }}>
					<span
						className='w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] flex-shrink-0'
						style={isDark
							? { background: 'rgba(68,170,255,0.12)', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(68,170,255,0.7)' }
							: { background: 'rgba(192,83,58,0.08)', border: '1px solid rgba(192,83,58,0.2)', color: 'var(--accent)' }
						}
					>
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
	likeCount, isLikedByMe, onToggleLike,
	editLoading, deleteLoading, registerLoading, unregisterLoading,
	spectatorLoading, unspectatorLoading,
	onEdit, onDelete, onRegister, onUnregister,
	onRegisterSpectator, onUnregisterSpectator,
	onShowPlayers, onEnterGame, onDonate,
}: {
	game: GameData
	currentUserId?: string
	isLoggedIn: boolean
	likeCount: number
	isLikedByMe: boolean
	onToggleLike: () => void
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
	onDonate: () => void
}) => {
	const { t, i18n } = useTranslation()
	const { isDark } = useTheme()

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
				style={isDark
					? { color: '#ff5fa0', background: 'rgba(255,95,160,0.07)', border: '1px solid rgba(255,95,160,0.25)' }
					: { color: 'var(--accent)', background: 'rgba(192,83,58,0.1)', border: '1px solid rgba(192,83,58,0.25)' }
				}
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
		<div
			className='group relative rounded-[20px] p-[24px] backdrop-blur-[10px] transition-all duration-[200ms] flex flex-col gap-[14px]'
			style={isDark
				? { border: '1px solid rgba(68,170,255,0.13)', background: 'rgba(3,6,25,0.52)' }
				: { border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }
			}
		>

			{/* Cover image + like overlay */}
			<div
				className='relative w-full aspect-[16/7] rounded-[12px] overflow-hidden mb-[6px]'
				style={{ background: isDark ? '#060e24' : 'var(--border-subtle)' }}
			>
				<img
					src={game.coverImage || 'https://res.cloudinary.com/dsgqhwqr7/image/upload/v1777038005/fon_of_game_uwvu0o.png'}
					alt={game.title}
					className='w-full h-full object-cover transition-opacity duration-[200ms]'
					style={{ opacity: isDark ? 0.7 : 1 }}
				/>

				{/* Heart like button — top-right over image */}
				<button
					onClick={isLoggedIn ? onToggleLike : undefined}
					title={isLoggedIn ? (isLikedByMe ? 'Прибрати лайк' : 'Лайкнути') : 'Увійдіть щоб лайкнути'}
					className='absolute top-[10px] right-[10px] z-10 flex items-center justify-center transition-transform hover:scale-110'
					style={{ cursor: isLoggedIn ? 'pointer' : 'default' }}
				>
					<div className='relative flex items-center justify-center w-[54px] h-[54px]'>
						<Heart
							size={54}
							strokeWidth={1.4}
							fill={isLikedByMe ? '#ff5fa0' : 'none'}
							style={{
								color: isLikedByMe ? '#ff5fa0' : 'rgba(255,255,255,0.8)',
								filter: isLikedByMe
									? 'drop-shadow(0 0 10px rgba(255,95,160,0.65))'
									: 'drop-shadow(0 1px 6px rgba(0,0,0,0.7))',
								transition: 'fill 0.15s ease, color 0.15s ease, filter 0.2s ease',
							}}
						/>
						{likeCount > 0 && (
							<span
								className='absolute text-[13px] font-[800] leading-none pointer-events-none select-none'
								style={{
									color: isLikedByMe ? '#fff' : 'rgba(255,255,255,0.9)',
									top: '54%',
									left: '50%',
									transform: 'translate(-50%, -30%)',
									textShadow: '0 1px 4px rgba(0,0,0,0.9)',
								}}
							>
								{likeCount}
							</span>
						)}
					</div>
				</button>
			</div>

			{/* Edit + Delete buttons — top-left so they don't overlap the heart (top-right) */}
			{isCreator && (
				<div className='absolute top-[12px] left-[12px] flex gap-[7px]'>
					<button
						onClick={onEdit}
						disabled={editLoading}
						title={t('our_games.edit')}
						className='flex items-center gap-[5px] px-[10px] h-[32px] rounded-[10px] text-[12px] font-[600] transition-all cursor-pointer disabled:opacity-40 hover:brightness-125'
						style={isDark
							? { background: 'var(--bg-base)', border: '1px solid rgba(68,170,255,0.55)', color: 'rgba(100,190,255,0.95)' }
							: { background: 'var(--bg-base)', border: '1px solid rgba(192,83,58,0.3)', color: 'var(--accent)' }
						}
					>
						{editLoading
							? <span className='w-[4px] h-[4px] rounded-full bg-[#44aaff] pulse-dot-anim' />
							: <><Pencil size={12} strokeWidth={2} />{t('our_games.edit')}</>
						}
					</button>
					<button
						onClick={onDelete}
						disabled={deleteLoading}
						title={t('our_games.delete')}
						className='flex items-center gap-[5px] px-[10px] h-[32px] rounded-[10px] text-[12px] font-[600] transition-all cursor-pointer disabled:opacity-40 hover:brightness-125'
						style={isDark
							? { background: 'var(--bg-base)', border: '1px solid rgba(255,95,160,0.5)', color: 'rgba(255,120,170,0.95)' }
							: { background: 'var(--bg-base)', border: '1px solid rgba(200,60,60,0.25)', color: 'rgba(180,50,50,0.9)' }
						}
					>
						{deleteLoading
							? <span className='w-[4px] h-[4px] rounded-full bg-[#ff5fa0] pulse-dot-anim' />
							: <><Trash2 size={12} strokeWidth={2} />{t('our_games.delete')}</>
						}
					</button>
				</div>
			)}

			{/* Title + creator */}
			<div>
				<h3 className='text-[17px] font-[700] leading-[1.3] mb-[4px]' style={{ color: isDark ? 'white' : 'var(--text-primary)' }}>
					<span style={{ color: isDark ? 'rgba(200,215,255,0.82)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 400 }}>
						{t('our_games.title_prefix')} —{' '}
					</span>
					{game.title}
				</h3>
				<p className='text-[13px]' style={{ color: isDark ? 'rgba(160,185,240,0.88)' : 'var(--text-secondary)' }}>
					{t('our_games.gamemaster_prefix')} — {game.creatorName}
				</p>
			</div>

			{/* Short description */}
			{game.description && (
				<p className='text-[13px] leading-[1.6] line-clamp-3' style={{ color: isDark ? 'rgba(180,200,255,0.75)' : 'var(--text-muted)' }}>
					{game.description}
				</p>
			)}

			{/* Stats */}
			<div className='flex flex-col gap-[7px]'>
				<StatRow icon={<Users size={13} strokeWidth={1.8} />} darkColor='rgba(68,170,255,0.6)'>
					{game.minPlayers}–{game.maxPlayers} {t('our_games.players')}
				</StatRow>

				{game.useCoins && (
					<StatRow icon={<CircleDollarSign size={13} strokeWidth={1.8} />} darkColor='rgba(255,183,40,0.75)'>
						{game.coinsPerPlayer} {t('our_games.coins_per_player')}
					</StatRow>
				)}

				{game.useInfluence && (
					<StatRow icon={<Zap size={13} strokeWidth={1.8} />} darkColor='rgba(192,127,255,0.75)'>
						{game.influencePerPlayer} {t('our_games.influence_per_player')}
					</StatRow>
				)}

				{game.scheduledAt && (
					<StatRow icon={<CalendarDays size={13} strokeWidth={1.8} />} darkColor='rgba(15,255,200,0.65)'>
						{formatDate(game.scheduledAt)}
					</StatRow>
				)}

				<div className='flex items-center justify-between gap-[8px]'>
					<StatRow icon={<Banknote size={13} strokeWidth={1.8} />} darkColor='rgba(255,183,40,0.85)'>
						{`Вартість участі: ${(game.participationCost ?? 0).toFixed(2).replace('.', ',')} грн`}
					</StatRow>
					<button
						onClick={onDonate}
						className='flex items-center gap-[4px] px-[9px] py-[4px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-115 flex-shrink-0'
						style={isDark
							? { background: 'rgba(255,183,40,0.08)', border: '1px solid rgba(255,183,40,0.3)', color: 'rgba(255,196,60,0.95)' }
							: { background: 'rgba(192,83,58,0.08)', border: '1px solid rgba(192,83,58,0.25)', color: 'var(--accent)' }
						}
					>
						<CreditCard size={11} strokeWidth={2} />
						Донат
					</button>
				</div>
			</div>

			{/* GM codes block */}
			{isCreator && game.spectatorCode && (
				<div className='flex gap-[8px] items-center rounded-[10px] px-[10px] py-[7px]'
					style={isDark
						? { background: 'rgba(180,130,255,0.05)', border: '1px solid rgba(180,130,255,0.15)' }
						: { background: 'var(--bg-base)', border: '1px solid var(--border-medium)' }
					}>
					<span className='text-[11px]' style={{ color: isDark ? 'rgba(190,148,255,0.78)' : 'var(--text-muted)' }}>👁 Код глядача:</span>
					<span className='text-[13px] font-[700] font-mono tracking-[2px]' style={{ color: isDark ? '#c07fff' : 'var(--accent)' }}>{game.spectatorCode}</span>
				</div>
			)}

			{/* Bottom row: players count + register buttons */}
			<div className='mt-auto flex flex-col gap-[8px]'>
				{!isCreator && isLoggedIn && !isRegistered && !isSpectator && !isFull && (
					<span className='text-[12px] font-[500] text-right' style={{ color: isDark ? 'rgba(180,200,255,0.75)' : 'var(--text-muted)' }}>
						{t('our_games.register_as_label')}
					</span>
				)}
				<div className='flex items-center justify-between pt-[2px]'>
					{/* Left: players count */}
					<div className='flex items-center gap-[10px]'>
						<button
							onClick={onShowPlayers}
							className='flex items-center gap-[5px] text-[12px] transition-colors cursor-pointer'
							style={{ color: isDark ? 'rgba(68,170,255,0.7)' : 'var(--text-muted)' }}
						>
							<UserCheck size={12} strokeWidth={1.8} />
							{regCount} / {game.maxPlayers} {t('our_games.btn_players')}
							{spectators.length > 0 && (
								<span className='ml-[4px]' style={{ color: 'rgba(190,148,255,0.78)' }}>
									· {spectators.length} 👁
								</span>
							)}
						</button>
					</div>

					<div className='flex gap-[6px] items-center'>
						{/* Spectator button */}
						{!isCreator && isLoggedIn && !isRegistered && (
							isSpectator ? (
								<button
									onClick={onUnregisterSpectator}
									disabled={unspectatorLoading}
									className='px-[10px] py-[6px] rounded-[10px] text-[11px] font-[500] transition-all duration-[180ms] cursor-pointer disabled:opacity-40 hover:opacity-75'
									style={isDark
										? { color: 'rgba(180,200,255,0.65)', background: 'rgba(180,200,255,0.07)', border: '1px solid rgba(180,200,255,0.18)' }
										: { color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-medium)' }
									}
								>
									{unspectatorLoading
										? <span className='w-[4px] h-[4px] rounded-full pulse-dot-anim inline-block' style={{ background: isDark ? 'rgba(180,200,255,0.6)' : 'var(--text-muted)' }} />
										: t('our_games.btn_unregister')
									}
								</button>
							) : (
								<button
									onClick={onRegisterSpectator}
									disabled={spectatorLoading}
									className='px-[10px] py-[6px] rounded-[10px] text-[11px] font-[500] transition-all duration-[180ms] cursor-pointer disabled:opacity-40 hover:opacity-75'
									style={isDark
										? { color: 'rgba(180,200,255,0.55)', background: 'transparent', border: '1px solid rgba(180,200,255,0.15)' }
										: { color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-medium)' }
									}
								>
									{spectatorLoading
										? <span className='w-[4px] h-[4px] rounded-full pulse-dot-anim inline-block' style={{ background: isDark ? 'rgba(180,200,255,0.55)' : 'var(--text-muted)' }} />
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
	icon, darkColor, children,
}: {
	icon: React.ReactNode
	darkColor: string
	children: React.ReactNode
}) => {
	const { isDark } = useTheme()
	return (
		<div className='flex items-center gap-[7px] text-[13px]' style={{ color: isDark ? darkColor : 'var(--accent)' }}>
			<span className='flex-shrink-0'>{icon}</span>
			<span style={{ color: isDark ? darkColor : 'var(--text-secondary)' }}>{children}</span>
		</div>
	)
}
