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
import { Mic, MicOff, Video, VideoOff, PhoneOff, Pencil, Minus, Plus } from 'lucide-react'
import { NEON_ICONS, NeonRaiseHand } from './NeonReactionIcon'
import type { RoomPlayer, GameRoomState } from './types'

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🤔', '😢', '😡']

interface Props {
	state: GameRoomState
	myId: string
	isGM: boolean
	isSpectator: boolean
	micOn: boolean
	camOn: boolean
	onToggleMic: () => void
	onToggleCam: () => void
	onReact: (emoji: string) => void
	onRaiseHand: (v: boolean) => void
	onLeave: () => void
	onSetRole: (targetUserId: string, role: string) => void
	onSetInfluence: (targetUserId: string, delta: number) => void
	playerReactions?: Record<string, { emoji: string; key: number }>
}

function getSpeechBorderColor(count: number): string {
	if (count < 3)  return '#4a5070'
	if (count < 6)  return '#c8d0e8'
	if (count < 10) return '#f5c800'
	if (count < 15) return '#ff8c00'
	if (count < 25) return '#ff5500'
	return '#cc1133'
}

// Returns optimal cols/rows so tiles fill the container like Google Meet
function computeGrid(n: number, w: number, h: number) {
	if (n <= 0) return { cols: 1, rows: 1 }
	const GAP = 7, PAD = 7
	let bestCols = 1
	let bestArea = 0
	for (let cols = 1; cols <= n; cols++) {
		const rows = Math.ceil(n / cols)
		const tileW = (w - PAD * 2 - GAP * (cols - 1)) / cols
		const tileH = (h - PAD * 2 - GAP * (rows - 1)) / rows
		const area = tileW * tileH
		if (area > bestArea) { bestArea = area; bestCols = cols }
	}
	return { cols: bestCols, rows: Math.ceil(n / bestCols) }
}

function GridPlayerCard({ player, isGM, myId, onSetRole, onSetInfluence, reaction, gameStarted }: {
	player: RoomPlayer; isGM: boolean; myId: string
	onSetRole: (uid: string, role: string) => void
	onSetInfluence: (uid: string, delta: number) => void
	reaction?: { emoji: string; key: number }
	gameStarted: boolean
}) {
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = participants.find(p => p.identity === player.userId)
		?? (localParticipant?.identity === player.userId ? localParticipant : undefined)
	const speaking = useIsSpeaking(participant)
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
				transition: 'border-color 0.5s ease',
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
					{editRole ? (
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
									style={{ color: player.role ? (speaking ? '#0fffc8' : '#c07fff') : 'rgba(100,120,200,0.35)' }}>
									{player.role || '—'}
								</span>
								{canEditRole && (
									<Pencil size={8} strokeWidth={2} className='flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all'
										style={{ color: 'rgba(68,170,255,0.4)' }} />
								)}
							</div>
							<div className='text-[10px] truncate'
								style={{ color: speaking ? 'rgba(15,255,200,0.75)' : 'rgba(180,200,255,0.55)' }}>
								{player.name}
							</div>
						</>
					)}
				</div>
				<div className='flex gap-[5px] flex-shrink-0 text-[10px]' style={{ color: '#4a5070' }}>
					{player.coins > 0 && <span>🪙{player.coins}</span>}
					{player.influence > 0 && <span>⚡{player.influence}</span>}
				</div>
			</div>

			{/* GM actions overlay */}
			{isGM && !player.isGamemaster && (
				<div className='absolute top-[4px] right-[4px] flex gap-[2px]'>
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
	if (typeof window === 'undefined') return 32
	if (window.innerWidth >= 1024) return 32
	if (window.innerWidth >= 768) return 16
	return 8
}

export const GridView = ({
	state, myId, isGM, isSpectator,
	micOn, camOn, onToggleMic, onToggleCam,
	onReact, onRaiseHand, onLeave,
	onSetRole, onSetInfluence,
	playerReactions = {},
}: Props) => {
	const me = state.players.find(p => p.userId === myId)
	const handRaised = me?.handRaised ?? false
	const mainPlayers = state.players.filter(p => !p.breakoutRoomId && p.connected && !p.isSpectator)
	const spectatorCount = state.players.filter(p => p.isSpectator && p.connected).length

	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const localSpeaking = useIsSpeaking(localParticipant)

	// Debounced active speaker — stays pinned for 3s after going silent
	const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
	const speakerClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const currentSpeaker = participants.filter(p => p.isSpeaking)[0] ?? null
	useEffect(() => {
		if (currentSpeaker) {
			if (speakerClearTimer.current) clearTimeout(speakerClearTimer.current)
			setActiveSpeakerId(currentSpeaker.identity)
		} else {
			speakerClearTimer.current = setTimeout(() => setActiveSpeakerId(null), 3000)
		}
		return () => { if (speakerClearTimer.current) clearTimeout(speakerClearTimer.current) }
	}, [currentSpeaker?.identity]) // eslint-disable-line react-hooks/exhaustive-deps

	// Active speaker moves to position 0, rest of order stays stable
	const sortedPlayers = useMemo(() => {
		const arr = [...mainPlayers]
		if (activeSpeakerId) {
			const idx = arr.findIndex(p => p.userId === activeSpeakerId)
			if (idx > 0) { const [s] = arr.splice(idx, 1); arr.unshift(s) }
		}
		return arr
	}, [mainPlayers, activeSpeakerId])

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

			{/* Spectator counter — only for "глядач" role, no tile shown */}
			{spectatorCount > 0 && (
				<div className='flex-shrink-0 flex items-center gap-[6px] px-[12px] py-[4px]'
					style={{ background: '#0b0d1a', borderBottom: '1px solid #151824' }}>
					<span className='text-[11px]' style={{ color: '#4a5070' }}>
						👁 Глядачі: {spectatorCount}
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
						reaction={playerReactions[p.userId]}
						gameStarted={state.status === 'started'}
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

			{/* Reactions bar */}
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

			{/* Controls */}
			<div className='flex-shrink-0 flex items-center gap-[7px] px-[14px] py-[9px]'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				{!isSpectator && <CtrlBtn active={micOn} onClick={onToggleMic} icon={micOn ? <Mic size={14}/> : <MicOff size={14}/>} label='Мікрофон' />}
				{!isSpectator && <CtrlBtn active={camOn} onClick={onToggleCam} icon={camOn ? <Video size={14}/> : <VideoOff size={14}/>} label='Камера' />}
				<CtrlBtn onClick={onLeave} icon={<PhoneOff size={14}/>} label='Вийти' variant='red' />
			</div>
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
			: { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }

	return (
		<button onClick={onClick}
			className='flex items-center gap-[5px] rounded-[8px] px-[12px] py-[7px] cursor-pointer transition-all hover:brightness-120 text-[12px] whitespace-nowrap'
			style={style}>
			{icon} {label}
		</button>
	)
}
