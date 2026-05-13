import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'

const REACTION_BADGE_CSS = `
@keyframes reactionBadge {
  0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
  10%  { transform: scale(1.4) rotate(8deg); opacity: 1; }
  18%  { transform: scale(1.0) rotate(0deg); opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; transform: scale(0.8); }
}
@keyframes reactFloat {
  0%   { transform: translateY(0px) translateX(0px) scale(0.4); opacity: 0; }
  10%  { transform: translateY(-35px) translateX(calc(var(--drift) * 0.15)) scale(1.25); opacity: 1; }
  35%  { transform: translateY(-110px) translateX(calc(var(--drift) * 0.5)) scale(1.0); opacity: 1; }
  75%  { transform: translateY(-250px) translateX(calc(var(--drift) * 0.85)) scale(0.9); opacity: 0.65; }
  100% { transform: translateY(-360px) translateX(var(--drift)) scale(0.7); opacity: 0; }
}
`

interface FloatItem { id: string; emoji: string; x: number; drift: number }
import { useParticipants, useLocalParticipant, VideoTrack as LKVideoTrack } from '@livekit/components-react'
const VideoTrack = LKVideoTrack as React.ComponentType<any>
import { useIsSpeakingSafe as useIsSpeaking } from '../../hooks/useIsSpeakingSafe'
import { Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Pencil, Minus, Plus, VolumeX, CircleDollarSign, Zap, ScreenShare, ScreenShareOff } from 'lucide-react'
import { NEON_ICONS, NeonRaiseHand } from './NeonReactionIcon'
import type { RoomPlayer, GameRoomState } from './types'

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🤔', '😢', '😡']

interface Props {
	state: GameRoomState
	myId: string
	isGM: boolean
	isSpectator: boolean
	isMobile?: boolean
	micOn: boolean
	camOn: boolean
	screenOn?: boolean
	onToggleMic: () => void
	onToggleCam: () => void
	onToggleScreen?: () => void
	onReact: (emoji: string) => void
	onRaiseHand: (v: boolean) => void
	onLeave: () => void
	onSetRole: (targetUserId: string, role: string) => void
	onSetInfluence: (targetUserId: string, delta: number) => void
	onMutePlayer?: (targetUserId: string) => void
	playerReactions?: Record<string, { emoji: string; key: number }>
	mockPlayers?: RoomPlayer[]
	mockSpeakingId?: string | null
	inBreakout?: string | null
}

function getSpeechBorderColor(count: number): string {
	if (count < 3)  return '#4a5070'
	if (count < 6)  return '#c8d0e8'
	if (count < 10) return '#f5c800'
	if (count < 15) return '#ff8c00'
	if (count < 25) return '#ff5500'
	return '#cc1133'
}

// Returns optimal cols/rows — Google Meet style, tiles prefer 16:9 aspect ratio
function computeGrid(n: number, w: number, h: number) {
	if (n <= 0) return { cols: 1, rows: 1 }
	const GAP = 7, PAD = 7
	const TARGET = 16 / 9
	let bestCols = 1
	let bestScore = -1
	for (let cols = 1; cols <= n; cols++) {
		const rows = Math.ceil(n / cols)
		const tileW = (w - PAD * 2 - GAP * (cols - 1)) / cols
		const tileH = (h - PAD * 2 - GAP * (rows - 1)) / rows
		if (tileW <= 0 || tileH <= 0) continue
		const diff = Math.abs(tileW / tileH - TARGET) / TARGET
		// Maximise area, but heavily penalise tiles far from 16:9
		const score = tileW * tileH * Math.max(0.15, 1 - diff * 0.7)
		if (score > bestScore) { bestScore = score; bestCols = cols }
	}
	return { cols: bestCols, rows: Math.ceil(n / bestCols) }
}

function GridPlayerCard({ player, isGM, myId, onSetRole, onSetInfluence, onMutePlayer, reaction, gameStarted, isMockSpeaking }: {
	player: RoomPlayer; isGM: boolean; myId: string
	onSetRole: (uid: string, role: string) => void
	onSetInfluence: (uid: string, delta: number) => void
	onMutePlayer?: (uid: string) => void
	reaction?: { emoji: string; key: number }
	gameStarted: boolean
	isMockSpeaking?: boolean
}) {
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = participants.find(p => p.identity === player.userId)
		?? (localParticipant?.identity === player.userId ? localParticipant : undefined)
	const lkSpeaking = useIsSpeaking(participant)
	const speaking = lkSpeaking || (isMockSpeaking ?? false)
	const camPub = participant?.getTrackPublication(Track.Source.Camera)
	const hasVideo = camPub?.isSubscribed && !camPub?.isMuted
	const micPub = participant?.getTrackPublication(Track.Source.Microphone)
	const micMuted = !micPub || micPub.isMuted
	const isPlayer = !player.isGamemaster && !player.isSpectator

	const [editRole, setEditRole] = useState(false)
	const [roleInput, setRoleInput] = useState(player.role)
	const [speechCount, setSpeechCount] = useState(0)
	const prevSpeakingRef = useRef(false)

	useEffect(() => {
		setSpeechCount(0)
		prevSpeakingRef.current = false
	}, [gameStarted])

	useEffect(() => {
		const was = prevSpeakingRef.current
		prevSpeakingRef.current = speaking
		if (speaking && !was && isPlayer && gameStarted) setSpeechCount(c => c + 1)
	}, [speaking]) // eslint-disable-line react-hooks/exhaustive-deps

	const canEditRole = !player.isSpectator && (isGM || player.userId === myId)

	const borderColor = isPlayer
		? (gameStarted ? getSpeechBorderColor(speechCount) : '#4a5070')
		: (speaking ? 'rgba(15,255,200,0.4)' : '#1c1f35')

	return (
		<div
			className='relative rounded-[9px] overflow-hidden flex flex-col'
			style={{
				background: '#0f1120',
				border: `1px solid ${borderColor}`,
				boxShadow: (!isPlayer && speaking) ? '0 0 10px rgba(15,255,200,0.08)' : 'none',
				transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
				height: '100%',
			}}
		>
			{/* Mic icon */}
			<div className='absolute top-[5px] left-[5px] text-[11px] z-10'>
				{micMuted ? '🔇' : '🎤'}
			</div>

			{/* Camera area — fills remaining height */}
			<div className='flex-1 min-h-0 flex items-center justify-center relative overflow-hidden' style={{ background: '#080912' }}>
				{hasVideo && camPub ? (
					<VideoTrack
						trackRef={{ participant: participant!, publication: camPub, source: Track.Source.Camera }}
						className='w-full h-full object-cover'
					/>
				) : (
					<div className='relative w-[57px] h-[57px] rounded-full flex items-center justify-center text-[20px] font-[700]'
						style={{
							background: speaking ? 'rgba(15,255,200,0.15)' : '#1a1a2e',
							color: speaking ? '#0fffc8' : '#7a80a0',
							border: speaking ? '1px solid rgba(15,255,200,0.3)' : 'none',
						}}>
						{player.initials}
						{reaction && (
							<div key={reaction.key} style={{
								position: 'absolute', bottom: '-6px', right: '-6px',
								fontSize: '18px', lineHeight: 1,
								animation: 'reactionBadge 7s ease-out forwards',
								pointerEvents: 'none',
							}}>
								{reaction.emoji}
							</div>
						)}
					</div>
				)}
				{reaction && hasVideo && (
					<div key={reaction.key} style={{
						position: 'absolute', bottom: '6px', right: '6px',
						fontSize: '22px', lineHeight: 1,
						animation: 'reactionBadge 7s ease-out forwards',
						pointerEvents: 'none',
					}}>
						{reaction.emoji}
					</div>
				)}
				{player.handRaised && (
					<div style={{ position: 'absolute', bottom: '4px', left: '4px', zIndex: 15, pointerEvents: 'none' }}>
						<NeonRaiseHand size={16} active />
					</div>
				)}
			</div>

			{/* Footer */}
			<div className='flex-shrink-0 px-[7px] py-[5px] flex items-center justify-between gap-[4px]'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				<div className='flex-1 min-w-0'>
					{player.isGamemaster ? (
						<>
							<span className='text-[11px] font-[700] px-[5px] py-[1px] rounded-[4px] self-start'
								style={{ background: 'rgba(15,255,200,0.1)', color: '#0fffc8', border: '1px solid rgba(15,255,200,0.3)' }}>
								Ігромайстер
							</span>
							<div className='text-[11px] truncate'
								style={{ color: speaking ? 'rgba(15,255,200,0.9)' : 'rgba(200,218,255,0.85)' }}>
								{player.name}
							</div>
						</>
					) : editRole ? (
						<input
							autoFocus
							value={roleInput}
							onChange={e => setRoleInput(e.target.value.slice(0, 60))}
							onBlur={() => { onSetRole(player.userId, roleInput); setEditRole(false) }}
							onKeyDown={e => { if (e.key === 'Enter') { onSetRole(player.userId, roleInput); setEditRole(false) } }}
							placeholder='Введіть вашу роль'
							className='w-full text-[11px] rounded-[4px] px-[4px] py-[1px] focus:outline-none'
							style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.3)', color: 'rgba(180,200,255,0.9)' }}
						/>
					) : (
						<>
							<div
								className='flex items-center gap-[3px]'
								onClick={canEditRole ? () => { setRoleInput(player.role); setEditRole(true) } : undefined}
								style={{ cursor: canEditRole ? 'text' : 'default' }}
							>
								<span className='text-[12px] font-[700] truncate'
									style={{ color: player.role ? (speaking ? '#0fffc8' : '#c07fff') : 'rgba(140,160,220,0.6)' }}>
									{player.role || '—'}
								</span>
								{canEditRole && (
									<Pencil size={8} strokeWidth={2} className='flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all'
										style={{ color: 'rgba(68,170,255,0.55)' }} />
								)}
							</div>
							<div className='text-[11px] truncate'
								style={{ color: speaking ? 'rgba(15,255,200,0.9)' : 'rgba(200,218,255,0.85)' }}>
								{player.name}
							</div>
						</>
					)}
				</div>
				<div className='flex gap-[5px] flex-shrink-0 text-[11px] items-center' style={{ color: '#7a88b0' }}>
					{player.coins > 0 && <span className='flex items-center gap-[1px]'><CircleDollarSign size={9} />{player.coins}</span>}
					{player.influence > 0 && <span className='flex items-center gap-[1px]'><Zap size={9} />{player.influence}</span>}
				</div>
			</div>

			{/* GM actions overlay */}
			{isGM && !player.isGamemaster && (
				<div className='absolute top-[4px] right-[4px] flex gap-[2px]'>
					{onMutePlayer && !player.isSpectator && (
						<button onClick={() => onMutePlayer(player.userId)}
							className='w-[18px] h-[18px] rounded-[4px] flex items-center justify-center cursor-pointer transition-all'
							style={{ background: 'rgba(11,13,26,0.85)', border: '1px solid #1c1f35', color: '#ff3850' }}
							title='Вимкнути мік'>
							<VolumeX size={9} strokeWidth={2} />
						</button>
					)}
					<button onClick={() => onSetInfluence(player.userId, 1)}
						className='w-[18px] h-[18px] rounded-[4px] flex items-center justify-center cursor-pointer transition-all'
						style={{ background: 'rgba(11,13,26,0.85)', border: '1px solid #1c1f35', color: '#4a5070' }}
						title='⚡+1'>
						<Plus size={9} strokeWidth={2} />
					</button>
					<button onClick={() => onSetInfluence(player.userId, -1)}
						className='w-[18px] h-[18px] rounded-[4px] flex items-center justify-center cursor-pointer transition-all'
						style={{ background: 'rgba(11,13,26,0.85)', border: '1px solid #1c1f35', color: '#4a5070' }}
						title='⚡-1'>
						<Minus size={9} strokeWidth={2} />
					</button>
				</div>
			)}
		</div>
	)
}

const getPageSize = () => {
	if (typeof window === 'undefined') return 16
	if (window.innerWidth >= 1024) return 16
	if (window.innerWidth >= 768) return 9
	return 6
}

export const GridView = ({
	state, myId, isGM, isSpectator,
	isMobile = false,
	micOn, camOn, screenOn = false,
	onToggleMic, onToggleCam, onToggleScreen,
	onReact, onRaiseHand, onLeave,
	onSetRole, onSetInfluence,
	onMutePlayer,
	playerReactions = {},
	mockPlayers = [],
	mockSpeakingId = null,
	inBreakout = null,
}: Props) => {
	const me = state.players.find(p => p.userId === myId)
	const handRaised = me?.handRaised ?? false
	// Show players from the current room only — real AND mock filtered by room
	const realMainPlayers = inBreakout
		? state.players.filter(p => p.breakoutRoomId === inBreakout && p.connected && !p.isSpectator)
		: state.players.filter(p => !p.breakoutRoomId && p.connected && !p.isSpectator)
	const filteredMocks = inBreakout
		? mockPlayers.filter(p => p.breakoutRoomId === inBreakout)
		: mockPlayers.filter(p => !p.breakoutRoomId)
	const mainPlayers = [...realMainPlayers, ...filteredMocks]
	const spectatorCount = state.players.filter(p => p.isSpectator && p.connected).length

	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const localSpeaking = useIsSpeaking(localParticipant)

	// Screen share detection — show notification banner if anyone is sharing
	const allParticipants = [localParticipant, ...participants].filter(Boolean) as typeof participants
	const isAnyoneSharing = allParticipants.some(p => {
		const pub = p.getTrackPublication(Track.Source.ScreenShare)
		return pub && !pub.isMuted && pub.track
	})

	// Grid view: stable join order — NO speaker-based reordering (prevents jumping tiles)
	const sortedPlayers = useMemo(() => [...mainPlayers], [mainPlayers])

	const [currentPage, setCurrentPage] = useState(0)
	const [pageSize, setPageSize] = useState(getPageSize)
	useEffect(() => {
		const handler = () => { setPageSize(getPageSize()); setCurrentPage(0) }
		window.addEventListener('resize', handler)
		return () => window.removeEventListener('resize', handler)
	}, [])

	const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / pageSize))
	const pagedPlayers = sortedPlayers.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
	const hiddenCount = sortedPlayers.length - pagedPlayers.length

	// ResizeObserver → optimal grid cols/rows for current container size
	const gridRef = useRef<HTMLDivElement>(null)
	const [containerSize, setContainerSize] = useState({ w: 800, h: 500 })
	useEffect(() => {
		const el = gridRef.current
		if (!el) return
		const obs = new ResizeObserver(entries => {
			const r = entries[0].contentRect
			setContainerSize({ w: r.width, h: r.height })
		})
		obs.observe(el)
		return () => obs.disconnect()
	}, [])
	const { cols, rows } = computeGrid(pagedPlayers.length, containerSize.w, containerSize.h)

	const handRaisedRef = useRef(handRaised)
	handRaisedRef.current = handRaised
	useEffect(() => {
		if (localSpeaking && handRaisedRef.current) onRaiseHand(false)
	}, [localSpeaking, onRaiseHand])

	const [floatItems, setFloatItems] = useState<FloatItem[]>([])
	const prevReactionsRef = useRef<Record<string, number>>({})
	const recentClickRef = useRef<Record<string, number>>({})
	const initializedRef = useRef(false)

	const spawnFloat = useCallback((emoji: string) => {
		const id = `${emoji}-${Date.now()}-${Math.random()}`
		const x = 12 + Math.random() * 76
		const drift = (Math.random() - 0.5) * 60
		setFloatItems(prev => [...prev, { id, emoji, x, drift }])
		setTimeout(() => setFloatItems(prev => prev.filter(r => r.id !== id)), 3400)
	}, [])

	useEffect(() => {
		if (!initializedRef.current) {
			initializedRef.current = true
			prevReactionsRef.current = { ...state.reactions }
			return
		}
		const prev = prevReactionsRef.current
		const curr = state.reactions
		REACTIONS.forEach(emoji => {
			const delta = (curr[emoji] ?? 0) - (prev[emoji] ?? 0)
			if (delta > 0) {
				const skipOne = Date.now() - (recentClickRef.current[emoji] ?? 0) < 1500
				const toSpawn = skipOne ? delta - 1 : delta
				for (let i = 0; i < toSpawn; i++) {
					setTimeout(() => spawnFloat(emoji), i * 180)
				}
			}
		})
		prevReactionsRef.current = { ...curr }
	}, [state.reactions, spawnFloat])

	const handleReact = (emoji: string) => {
		recentClickRef.current[emoji] = Date.now()
		spawnFloat(emoji)
		onReact(emoji)
	}

	return (
		<div className='flex-1 flex flex-col overflow-hidden relative group' style={{ background: '#07080f' }}>
		<style>{REACTION_BADGE_CSS}</style>

		{/* Floating reactions layer */}
		<div className='absolute inset-0 pointer-events-none' style={{ zIndex: 50, overflow: 'hidden' }}>
			{floatItems.map(item => {
				const Icon = NEON_ICONS[item.emoji] ?? NEON_ICONS['👍']
				return (
					<div key={item.id} style={{
						position: 'absolute',
						bottom: '80px',
						left: `${item.x}%`,
						['--drift' as string]: `${item.drift}px`,
						animation: 'reactFloat 3.2s ease-out forwards',
					}}>
						<Icon size={42} />
					</div>
				)
			})}
		</div>

			{/* Online + spectator counters — always visible */}
			<div className='flex-shrink-0 flex items-center gap-[12px] px-[12px] py-[5px]'
				style={{ background: '#0b0d1a', borderBottom: '1px solid #151824' }}>
				<span className='text-[12px]' style={{ color: '#7a88b0' }}>
					{mainPlayers.length} онлайн
				</span>
				<span className='text-[12px]' style={{ color: '#7a88b0' }}>
					👁 {spectatorCount} глядачів
				</span>
			</div>

			{/* Screen share notification */}
			{isAnyoneSharing && (
				<div className='flex-shrink-0 flex items-center gap-[6px] px-[12px] py-[4px]'
					style={{ background: 'rgba(68,170,255,0.06)', borderBottom: '1px solid rgba(68,170,255,0.18)' }}>
					<ScreenShare size={11} style={{ color: 'rgba(68,170,255,0.85)' }} />
					<span className='text-[12px]' style={{ color: 'rgba(68,170,255,0.85)' }}>
						Демонстрація екрану — перейдіть у режим «Спікер» для перегляду
					</span>
				</div>
			)}

			{/* Grid — tiles fill full container (Google Meet style) */}
			<div
				ref={gridRef}
				className='flex-1 overflow-hidden'
				style={{
					display: 'grid',
					gridTemplateColumns: `repeat(${cols}, 1fr)`,
					gridTemplateRows: `repeat(${rows}, 1fr)`,
					gap: '7px',
					padding: '7px',
				}}
			>
				{pagedPlayers.map(p => (
					<GridPlayerCard
						key={p.userId}
						player={p}
						isGM={isGM}
						myId={myId}
						onSetRole={onSetRole}
						onSetInfluence={onSetInfluence}
						onMutePlayer={onMutePlayer}
						reaction={playerReactions[p.userId]}
						gameStarted={state.status === 'started'}
						isMockSpeaking={mockSpeakingId === p.userId}
					/>
				))}
			</div>

			{/* ↓ +N — click to go to next page (cycles) */}
			{totalPages > 1 && (
				<div className='flex-shrink-0 flex items-center justify-center py-[4px]'
					style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
					<button
						onClick={() => setCurrentPage(p => (p + 1) % totalPages)}
						className='px-[14px] py-[4px] rounded-[6px] text-[12px] cursor-pointer transition-all hover:brightness-125'
						style={{ background: '#0f1120', border: '1px solid rgba(68,170,255,0.25)', color: 'rgba(68,170,255,0.8)' }}
					>
						↓ +{hiddenCount}
					</button>
				</div>
			)}

			{/* Reactions bar (desktop only) */}
			{!isMobile && (
				<div className='flex-shrink-0 flex items-center gap-[5px] px-[14px] py-[7px] flex-wrap'
					style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
					{REACTIONS.map(emoji => (
						<button key={emoji} onClick={() => handleReact(emoji)}
							className='flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110'
							style={{ width: '46px', height: '46px', background: 'transparent', borderRadius: '10px' }}>
							{React.createElement(NEON_ICONS[emoji] ?? NEON_ICONS['👍'], { size: 30 })}
						</button>
					))}
					{!isSpectator && (
						<button onClick={() => onRaiseHand(!handRaised)}
							className='flex flex-col items-center justify-center cursor-pointer transition-all'
							style={{
								width: '46px', height: '46px',
								background: handRaised ? 'rgba(200,168,48,0.08)' : 'transparent',
								borderRadius: '10px',
							}}>
							<NeonRaiseHand size={30} active={handRaised} />
						</button>
					)}
				</div>
			)}

			{/* Controls (desktop only) */}
			{!isMobile && (
				<div className='flex-shrink-0 flex items-center gap-[7px] px-[14px] py-[9px]'
					style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
					{!isSpectator && <CtrlBtn active={micOn} onClick={onToggleMic} icon={micOn ? <Mic size={14}/> : <MicOff size={14}/>} label='Мікрофон' />}
					{!isSpectator && <CtrlBtn active={camOn} onClick={onToggleCam} icon={camOn ? <Video size={14}/> : <VideoOff size={14}/>} label='Камера' />}
					{!isSpectator && onToggleScreen && (
						<CtrlBtn active={screenOn} onClick={onToggleScreen} icon={screenOn ? <ScreenShareOff size={14}/> : <ScreenShare size={14}/>} label='Екран' />
					)}
					<CtrlBtn onClick={onLeave} icon={<PhoneOff size={14}/>} label='Вийти' variant='red' />
				</div>
			)}
		</div>
	)
}

function CtrlBtn({ active, onClick, icon, label, variant = 'default' }: {
	active?: boolean; onClick: () => void; icon: React.ReactNode; label: string; variant?: 'default' | 'red'
}) {
	const style = variant === 'red'
		? { background: 'rgba(255,56,80,0.08)', border: '1px solid rgba(255,56,80,0.25)', color: '#ff3850' }
		: active
			? { background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }
			: { background: '#0f1120', border: '1px solid #1c1f35', color: '#9aabb0' }

	return (
		<button onClick={onClick}
			className='flex items-center gap-[5px] rounded-[8px] px-[12px] py-[8px] cursor-pointer transition-all hover:brightness-120 text-[13px] whitespace-nowrap'
			style={style}>
			{icon} {label}
		</button>
	)
}
