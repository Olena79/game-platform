import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParticipants, useLocalParticipant, VideoTrack as LKVideoTrack } from '@livekit/components-react'
const VideoTrack = LKVideoTrack as React.ComponentType<any>
import { useIsSpeakingSafe as useIsSpeaking } from '../../hooks/useIsSpeakingSafe'
import { Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff, VolumeX, CircleDollarSign, Zap, ScreenShare, ScreenShareOff, ChevronLeft, ChevronRight } from 'lucide-react'
import type { RoomPlayer, GameRoomState } from './types'
import { ImagePanel } from './ImagePanel'
import { NEON_ICONS, NeonRaiseHand } from './NeonReactionIcon'

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🤔', '😢', '😡']

interface FloatItem { id: string; emoji: string; x: number; drift: number }

const REACTION_BADGE_CSS = `
@keyframes reactionBadge {
  0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
  10%  { transform: scale(1.4) rotate(8deg); opacity: 1; }
  18%  { transform: scale(1.0) rotate(0deg); opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; transform: scale(0.8); }
}
`

const FLOAT_CSS = `
@keyframes reactFloat {
  0%   { transform: translateY(0px) translateX(0px) scale(0.4); opacity: 0; }
  10%  { transform: translateY(-35px) translateX(calc(var(--drift) * 0.15)) scale(1.25); opacity: 1; }
  35%  { transform: translateY(-110px) translateX(calc(var(--drift) * 0.5)) scale(1.0); opacity: 1; }
  75%  { transform: translateY(-250px) translateX(calc(var(--drift) * 0.85)) scale(0.9); opacity: 0.65; }
  100% { transform: translateY(-360px) translateX(var(--drift)) scale(0.7); opacity: 0; }
}
`


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
	imageUrl?: string | null
	images?: string[]
	onImageClose?: () => void
	onChangeImage?: (url: string) => void
	playerReactions?: Record<string, { emoji: string; key: number }>
	onMutePlayer?: (uid: string) => void
	mockPlayers?: RoomPlayer[]
	mockSpeakingId?: string | null
	inBreakout?: string | null
}

function MicDot({ active }: { active: boolean }) {
	return (
		<div
			className='w-[9px] h-[9px] rounded-full transition-all duration-200'
			style={{
				background: active ? '#0fffc8' : 'rgba(15,255,200,0.12)',
				boxShadow: active
					? '0 0 8px 3px rgba(15,255,200,0.65), 0 0 18px 6px rgba(15,255,200,0.2)'
					: 'none',
			}}
		/>
	)
}

function getSpeechBorderColor(count: number): string {
	if (count < 3)  return '#4a5070'
	if (count < 6)  return '#c8d0e8'
	if (count < 10) return '#f5c800'
	if (count < 15) return '#ff8c00'
	if (count < 25) return '#ff5500'
	return '#cc1133'
}

function PlayerTile({ player, size = 'strip' }: { player: RoomPlayer; size?: 'strip' | 'mini' }) {
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = participants.find(p => p.identity === player.userId) ?? (localParticipant?.identity === player.userId ? localParticipant : undefined)
	const speaking = useIsSpeaking(participant)
	const camPub = participant?.getTrackPublication(Track.Source.Camera)
	const hasVideo = camPub?.isSubscribed && !camPub?.isMuted

	const sz = size === 'strip' ? 'min-w-[72px]' : 'min-w-[60px]'

	return (
		<div
			className={`${sz} flex-shrink-0 rounded-[8px] p-[6px] flex flex-col items-center gap-[4px] cursor-default transition-all`}
			style={{
				background: speaking ? 'rgba(15,255,200,0.05)' : '#0f1120',
				border: speaking ? '1px solid rgba(15,255,200,0.35)' : '1px solid #1c1f35',
			}}
		>
			{/* Avatar / video */}
			<div className='w-[34px] h-[34px] rounded-full overflow-hidden flex items-center justify-center flex-shrink-0'
				style={{ background: speaking ? 'rgba(15,255,200,0.15)' : '#1a1a2e', border: speaking ? '1px solid rgba(15,255,200,0.3)' : 'none' }}>
				{hasVideo && camPub
					? <VideoTrack trackRef={{ participant: participant!, publication: camPub, source: Track.Source.Camera }} className='w-full h-full object-cover' style={{ transform: localParticipant?.identity === player.userId ? 'scaleX(-1)' : 'scaleX(1)' }} />
					: <span className='text-[11px] font-[700]' style={{ color: speaking ? '#0fffc8' : '#7a80a0' }}>{player.initials}</span>
				}
			</div>
			<span className='text-[10px] text-center leading-[1.2] w-full truncate'
				style={{ color: speaking ? '#0fffc8' : '#4a5070' }}>
				{player.name.split(' ')[0]}
			</span>
			<div className='flex gap-[4px]'>
				{state_placeholder_coins(player)}
			</div>
		</div>
	)
}

// Separate stat component to avoid closure issues
function PlayerStats({ player }: { player: RoomPlayer }) {
	return (
		<div className='flex gap-[4px]'>
			{player.coins > 0 && <span className='text-[9px]' style={{ color: '#4a5070' }}>🪙{player.coins}</span>}
			{player.influence > 0 && <span className='text-[9px]' style={{ color: '#4a5070' }}>⚡{player.influence}</span>}
		</div>
	)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function state_placeholder_coins(_p: RoomPlayer) { return null }

function CoverImageBlock({ state }: { state: GameRoomState }) {
	const { t } = useTranslation()
	const coverUrl = state.coverImage || 'https://res.cloudinary.com/dsgqhwqr7/image/upload/v1777038005/fon_of_game_uwvu0o.png'

	return (
		<div className='flex-1 relative min-h-0 overflow-hidden' style={{ background: '#07080f' }}>
			{/* Cover image */}
			<div
				className='absolute inset-0'
				style={{
					backgroundImage: `url(${coverUrl})`,
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					opacity: 0.35,
					zIndex: 0,
				}}
			/>
			{/* Green radial glow */}
			<div className='absolute inset-0 pointer-events-none'
				style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(15,255,200,0.07) 0%, transparent 65%)', zIndex: 1 }} />
			{/* Dark gradient for title readability */}
			<div className='absolute top-0 left-0 right-0 pointer-events-none'
				style={{
					height: '260px',
					background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
					zIndex: 2,
				}}
			/>
			{state.title && (
				<div className='absolute top-0 left-0 p-[18px] flex flex-col gap-[6px]' style={{ zIndex: 3, pointerEvents: 'none' }}>
					<p className='text-[13px] md:text-[20px] lg:text-[40px]' style={{
						color: 'rgba(180,210,255,0.75)',
						fontWeight: '500',
						letterSpacing: '0.08em',
						textTransform: 'uppercase',
						textShadow: '0 2px 14px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)',
					}}>
						{t('room.speaker.welcome')}
					</p>
					<p className='text-[36px] md:text-[54px] lg:text-[108px]' style={{
						color: '#0fffc8',
						fontWeight: '800',
						lineHeight: 1.1,
						letterSpacing: '0.01em',
						textShadow: '0 0 28px rgba(15,255,200,0.55), 0 2px 18px rgba(0,0,0,1), 0 0 55px rgba(15,255,200,0.25)',
						wordBreak: 'break-word',
					}}>
						{`«${state.title}»`}
					</p>
				</div>
			)}
			<p className='absolute bottom-[8px] left-0 right-0 text-center text-[14px]'
				style={{ color: 'rgba(160,185,255,0.75)', zIndex: 3, pointerEvents: 'none' }}>
				{state.status === 'lobby' ? t('room.speaker.waiting') : t('room.speaker.silence')}
			</p>
		</div>
	)
}

function SpeakerDisplay({ state, speakerPlayer, playerReactions, isMockSpeaking }: {
	state: GameRoomState
	speakerPlayer: RoomPlayer | null
	playerReactions: Record<string, { emoji: string; key: number }>
	isMockSpeaking?: boolean
}) {
	const { t } = useTranslation()
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = speakerPlayer
		? (participants.find(p => p.identity === speakerPlayer.userId) ?? (localParticipant?.identity === speakerPlayer.userId ? localParticipant : undefined))
		: undefined
	const lkSpeaking = useIsSpeaking(participant)
	const speaking = lkSpeaking || (isMockSpeaking ?? false)
	const camPub = participant?.getTrackPublication(Track.Source.Camera)
	const hasVideo = camPub?.isSubscribed && !camPub?.isMuted

	if (!speakerPlayer || state.status === 'lobby') {
		return <CoverImageBlock state={state} />
	}

	const reaction = speakerPlayer ? playerReactions[speakerPlayer.userId] : undefined

	// aspect-video on mobile so the speaker block doesn't stretch full viewport height
	return (
		<div className='aspect-video sm:aspect-auto sm:flex-1 relative overflow-hidden min-h-0 w-full' style={{ background: '#000' }}>
			<div className='absolute inset-0 pointer-events-none'
				style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(15,255,200,0.07) 0%, transparent 65%)', zIndex: 1 }} />

			{hasVideo && camPub ? (
				<>
					<VideoTrack
						trackRef={{ participant: participant!, publication: camPub, source: Track.Source.Camera }}
						className='absolute inset-0 w-full h-full object-contain'
						style={{
							transform: localParticipant?.identity === speakerPlayer?.userId ? 'scaleX(-1)' : 'scaleX(1)',
						}}
					/>
					{reaction && (
						<div key={reaction.key} style={{
							position: 'absolute', bottom: '56px', right: '20px', zIndex: 3,
							fontSize: '48px', lineHeight: 1,
							animation: 'reactionBadge 7s ease-out forwards',
							pointerEvents: 'none',
						}}>
							{reaction.emoji}
						</div>
					)}
					<div className='absolute bottom-0 left-0 right-0 z-[2] flex flex-col items-center gap-[4px] pt-[28px] pb-[10px]'
						style={{ background: 'linear-gradient(to top, rgba(7,8,15,0.82) 0%, transparent 100%)' }}>
						<span className='text-[18px] font-[700]' style={{ color: '#dde1f0' }}>{speakerPlayer.name}</span>
						<span className='text-[14px] font-[700] px-[12px] py-[3px] rounded-[20px]'
							style={speakerPlayer.role
								? { color: '#0fffc8', background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.2)' }
								: { color: 'rgba(155,175,230,0.72)', background: 'transparent', border: '1px solid rgba(130,155,220,0.25)' }}>
							{speakerPlayer.role || t('room.speaker.role_placeholder')}
						</span>
						<MicDot active={speaking} />
					</div>
				</>
			) : (
				<div className='w-full h-full flex flex-col items-center justify-center gap-[12px] relative z-[2]'>
					<div className='relative w-[100px] h-[100px] rounded-full flex items-center justify-center text-[34px] font-[700]'
						style={{
							background: '#0f1120',
							border: '2px solid rgba(15,255,200,0.3)',
							color: '#0fffc8',
							boxShadow: '0 0 24px rgba(15,255,200,0.12)',
						}}>
						{speakerPlayer.initials}
						{reaction && (
							<div key={reaction.key} style={{
								position: 'absolute', bottom: '-12px', right: '-12px',
								fontSize: '36px', lineHeight: 1,
								animation: 'reactionBadge 7s ease-out forwards',
								pointerEvents: 'none',
							}}>
								{reaction.emoji}
							</div>
						)}
					</div>
					<div className='flex flex-col items-center gap-[5px]'>
						<span className='text-[19px] font-[700]' style={{ color: '#dde1f0' }}>{speakerPlayer.name}</span>
						<span className='text-[14px] font-[700] px-[12px] py-[3px] rounded-[20px]'
							style={speakerPlayer.role
								? { color: '#0fffc8', background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.2)' }
								: { color: 'rgba(155,175,230,0.72)', background: 'transparent', border: '1px solid rgba(130,155,220,0.25)' }}>
							{speakerPlayer.role || t('room.speaker.role_placeholder')}
						</span>
						<MicDot active={speaking} />
					</div>
				</div>
			)}
		</div>
	)
}

export const SpeakerView = ({
	state, myId, isGM, isSpectator,
	isMobile = false,
	micOn, camOn, screenOn = false,
	onToggleMic, onToggleCam, onToggleScreen,
	onReact, onRaiseHand, onLeave,
	imageUrl, images = [], onImageClose, onChangeImage,
	playerReactions = {},
	onMutePlayer,
	mockPlayers = [],
	mockSpeakingId = null,
	inBreakout = null,
}: Props) => {
	const { t } = useTranslation()
	const me = state.players.find(p => p.userId === myId)
	const handRaised = me?.handRaised ?? false
	const realMainPlayers = inBreakout
		? state.players.filter(p => p.breakoutRoomId === inBreakout && p.connected)
		: state.players.filter(p => !p.breakoutRoomId && p.connected)
	const filteredMocks = inBreakout
		? mockPlayers.filter(p => p.breakoutRoomId === inBreakout)
		: mockPlayers.filter(p => !p.breakoutRoomId)
	const mainPlayers = [...realMainPlayers, ...filteredMocks]

	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const localSpeaking = useIsSpeaking(localParticipant)

	// Screen share detection — any participant sharing gets priority in main area
	const allParticipants = [localParticipant, ...participants].filter(Boolean) as typeof participants
	const screenShareParticipant = allParticipants.find(p => {
		const pub = p.getTrackPublication(Track.Source.ScreenShare)
		return pub && !pub.isMuted && pub.track
	})
	const screenSharePub = screenShareParticipant?.getTrackPublication(Track.Source.ScreenShare)

	// Track active speaker — last known speaker stays first (Google Meet style)
	const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
	const currentSpeaker = participants.filter(p => p.isSpeaking)[0] ?? null
	useEffect(() => {
		if (currentSpeaker) setActiveSpeakerId(currentSpeaker.identity)
		// Silent: keep last speaker pinned — never reset to avoid order jumps
	}, [currentSpeaker?.identity]) // eslint-disable-line react-hooks/exhaustive-deps

	// Real LiveKit speaker > mock speaker > first non-spectator player
	const speakerPlayer = (activeSpeakerId
		? mainPlayers.find(p => p.userId === activeSpeakerId && !p.isSpectator)
		: null)
		?? (mockSpeakingId ? mainPlayers.find(p => p.userId === mockSpeakingId) : null)
		?? mainPlayers.find(p => !p.isSpectator)
		?? null
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
		<div className='flex-1 flex flex-col overflow-hidden relative' style={{ background: '#07080f' }}>
		<style>{REACTION_BADGE_CSS + FLOAT_CSS}</style>

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
			{/* Top badges */}
			<div className='flex items-center justify-between px-[12px] pt-[10px] pb-0 flex-shrink-0'>
				<div className='flex items-center gap-[6px]'>
					<span className='text-[11px] font-[700] px-[8px] py-[3px] rounded-[4px]'
						style={{ background: '#ff3850', color: '#fff', letterSpacing: '0.06em' }}>● LIVE</span>
					<span className='text-[11px]' style={{ color: '#7a88b0' }}>{state.title}</span>
				</div>
				<div className='flex items-center gap-[8px]'>
					<span className='text-[12px]' style={{ color: '#7a88b0' }}>
						{mainPlayers.filter(p => !p.isSpectator).length} {t('room.speaker.online')}
					</span>
					<span className='text-[12px]' style={{ color: '#7a88b0' }}>
						👁 {state.players.filter(p => p.isSpectator && p.connected).length} {t('room.speaker.spectators')}
					</span>
				</div>
			</div>

			{/* Main area: screen share > image > speaker */}
			{screenShareParticipant && screenSharePub ? (
				<div className='flex-1 relative min-h-0 flex items-center justify-center' style={{ background: '#000' }}>
					<VideoTrack
						trackRef={{ participant: screenShareParticipant, publication: screenSharePub, source: Track.Source.ScreenShare }}
						className='max-w-full max-h-full object-contain'
					/>
					<div className='absolute top-[10px] left-[10px] flex items-center gap-[5px] px-[8px] py-[3px] rounded-[5px]'
						style={{ background: 'rgba(15,17,32,0.85)', border: '1px solid rgba(68,170,255,0.3)' }}>
						<ScreenShare size={10} style={{ color: 'rgba(68,170,255,0.9)' }} />
						<span className='text-[11px] font-[600]' style={{ color: 'rgba(68,170,255,0.9)' }}>{t('room.speaker.screen_share')}</span>
					</div>
				</div>
			) : imageUrl
				? <ImagePanel imageUrl={imageUrl} isGM={isGM} images={images} onChangeImage={onChangeImage} onClose={onImageClose} fill />
				: <SpeakerDisplay
					state={state}
					speakerPlayer={speakerPlayer}
					playerReactions={playerReactions}
					isMockSpeaking={speakerPlayer ? mockSpeakingId === speakerPlayer.userId : false}
				/>
			}

			{/* Players strip with navigation */}
			<PlayerStrip
				players={mainPlayers.filter(p => !p.isSpectator)}
				playerReactions={playerReactions}
				gameStarted={state.status === 'started'}
				isGM={isGM}
				onMutePlayer={onMutePlayer}
				mockSpeakingId={mockSpeakingId}
			/>

			{/* Controls + Reactions — one row (desktop only) */}
			{!isMobile && (
				<div className='flex-shrink-0 flex items-center gap-[5px] px-[10px] py-[6px] flex-wrap'
					style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
					{!isSpectator && <CtrlBtn active={micOn} onClick={onToggleMic} icon={micOn ? <Mic size={13}/> : <MicOff size={13}/>} label={t('room.speaker.mic_label')} />}
					{!isSpectator && <CtrlBtn active={camOn} onClick={onToggleCam} icon={camOn ? <Video size={13}/> : <VideoOff size={13}/>} label={t('room.speaker.cam_label')} />}
					{!isSpectator && onToggleScreen && (
						<CtrlBtn active={screenOn} onClick={onToggleScreen} icon={screenOn ? <ScreenShareOff size={13}/> : <ScreenShare size={13}/>} label={t('room.speaker.screen_label')} />
					)}
					<CtrlBtn onClick={onLeave} icon={<PhoneOff size={13}/>} label={t('room.speaker.leave_label')} variant='red' />
					<div className='flex-shrink-0 w-[1px] h-[18px] mx-[2px]' style={{ background: '#1c1f35' }} />
					{REACTIONS.map(emoji => (
						<button key={emoji} onClick={() => handleReact(emoji)}
							className='flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110'
							style={{ width: '46px', height: '46px', background: 'transparent', borderRadius: '10px' }}
						>
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
		</div>
	)
}

// ── Navigable player strip ────────────────────────────────────────────────────
const SCROLL_STEP = 280 // px per arrow click

function PlayerStrip({ players, playerReactions, gameStarted, isGM, onMutePlayer, mockSpeakingId }: {
	players: RoomPlayer[]
	playerReactions: Record<string, { emoji: string; key: number }>
	gameStarted: boolean
	isGM?: boolean
	onMutePlayer?: (uid: string) => void
	mockSpeakingId?: string | null
}) {
	const stripRef = useRef<HTMLDivElement>(null)
	const [canLeft, setCanLeft] = useState(false)
	const [canRight, setCanRight] = useState(false)

	const checkScroll = useCallback(() => {
		const el = stripRef.current
		if (!el) return
		setCanLeft(el.scrollLeft > 2)
		setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
	}, [])

	useEffect(() => {
		const el = stripRef.current
		if (!el) return
		checkScroll()
		el.addEventListener('scroll', checkScroll, { passive: true })
		const obs = new ResizeObserver(checkScroll)
		obs.observe(el)
		return () => { el.removeEventListener('scroll', checkScroll); obs.disconnect() }
	}, [checkScroll, players.length])

	const scroll = (dir: 1 | -1) => {
		stripRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' })
	}

	// Touch swipe: handled natively by overflow-x: auto on mobile
	// Arrow buttons: desktop convenience

	const showNav = canLeft || canRight

	return (
		<div className='flex-shrink-0 relative flex items-stretch'
			style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>

			{/* Left arrow */}
			<button
				onClick={() => scroll(-1)}
				className='flex-shrink-0 flex items-center justify-center transition-all cursor-pointer'
				style={{
					width: showNav ? '28px' : '0px',
					opacity: canLeft ? 1 : 0,
					pointerEvents: canLeft ? 'auto' : 'none',
					background: 'rgba(11,13,26,0.92)',
					borderRight: canLeft ? '1px solid #1c2035' : 'none',
					color: 'rgba(100,170,255,0.85)',
					overflow: 'hidden',
					transition: 'width 0.2s, opacity 0.2s',
				}}>
				<ChevronLeft size={14} strokeWidth={2} />
			</button>

			{/* Scrollable strip */}
			<div
				ref={stripRef}
				className='flex gap-[7px] px-[10px] py-[6px] flex-1 min-w-0'
				style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
				{players.map(p => (
					<StripTileWrapper
						key={p.userId}
						player={p}
						reaction={playerReactions[p.userId]}
						gameStarted={gameStarted}
						isGM={isGM}
						onMutePlayer={onMutePlayer}
						isMockSpeaking={mockSpeakingId === p.userId}
					/>
				))}
			</div>

			{/* Right arrow */}
			<button
				onClick={() => scroll(1)}
				className='flex-shrink-0 flex items-center justify-center transition-all cursor-pointer'
				style={{
					width: showNav ? '28px' : '0px',
					opacity: canRight ? 1 : 0,
					pointerEvents: canRight ? 'auto' : 'none',
					background: 'rgba(11,13,26,0.92)',
					borderLeft: canRight ? '1px solid #1c2035' : 'none',
					color: 'rgba(100,170,255,0.85)',
					overflow: 'hidden',
					transition: 'width 0.2s, opacity 0.2s',
				}}>
				<ChevronRight size={14} strokeWidth={2} />
			</button>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────

function StripTileWrapper({ player, reaction, gameStarted, isGM, onMutePlayer, isMockSpeaking }: {
	player: RoomPlayer; reaction?: { emoji: string; key: number }; gameStarted: boolean
	isGM?: boolean; onMutePlayer?: (uid: string) => void; isMockSpeaking?: boolean
}) {
	const { t } = useTranslation()
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = participants.find(p => p.identity === player.userId) ?? (localParticipant?.identity === player.userId ? localParticipant : undefined)
	const lkSpeaking = useIsSpeaking(participant)
	const speaking = lkSpeaking || (isMockSpeaking ?? false)
	const isPlayer = !player.isGamemaster && !player.isSpectator

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

	const borderColor = isPlayer
		? (gameStarted ? getSpeechBorderColor(speechCount) : '#4a5070')
		: (speaking ? 'rgba(15,255,200,0.4)' : '#1c1f35')

	const canMute = isGM && !player.isGamemaster && !player.isSpectator && onMutePlayer

	return (
		<div className='flex-shrink-0 min-w-[72px] rounded-[8px] p-[6px] flex flex-col items-center gap-[3px] cursor-default relative group'
			style={{
				background: (!isPlayer && speaking) ? 'rgba(15,255,200,0.05)' : '#0f1120',
				border: `1px solid ${borderColor}`,
				transition: 'border-color 0.5s ease, background 0.5s ease',
			}}>
			<StripTile player={player} reaction={reaction} isMockSpeaking={isMockSpeaking} />
			{canMute && (
				<button
					onClick={() => onMutePlayer!(player.userId)}
					className='absolute top-[2px] right-[2px] w-[16px] h-[16px] rounded-[3px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer'
					style={{ background: 'rgba(11,13,26,0.9)', border: '1px solid #1c1f35', color: '#ff3850' }}
					title={t('room.speaker.mic_label')}>
					<VolumeX size={9} strokeWidth={2} />
				</button>
			)}
		</div>
	)
}

function StripTile({ player, reaction, isMockSpeaking }: { player: RoomPlayer; reaction?: { emoji: string; key: number }; isMockSpeaking?: boolean }) {
	const { t } = useTranslation()
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = participants.find(p => p.identity === player.userId) ?? (localParticipant?.identity === player.userId ? localParticipant : undefined)
	const lkSpeaking = useIsSpeaking(participant)
	const speaking = lkSpeaking || (isMockSpeaking ?? false)

	return (
		<>
			<div className='relative w-[32px] h-[32px] rounded-full flex items-center justify-center text-[11px] font-[700]'
				style={{
					background: speaking ? 'rgba(15,255,200,0.15)' : '#1a1a2e',
					color: speaking ? '#0fffc8' : '#7a80a0',
					border: speaking ? '1px solid rgba(15,255,200,0.3)' : 'none',
				}}>
				{player.initials}
				{reaction && (
					<div key={reaction.key} style={{
						position: 'absolute', bottom: '-5px', right: '-5px',
						fontSize: '15px', lineHeight: 1,
						animation: 'reactionBadge 7s ease-out forwards',
						pointerEvents: 'none',
					}}>
						{reaction.emoji}
					</div>
				)}
				{player.handRaised && (
					<div style={{ position: 'absolute', top: '-6px', left: '-6px', pointerEvents: 'none' }}>
						<NeonRaiseHand size={14} active />
					</div>
				)}
			</div>
			<span className='text-[11px] w-full text-center truncate' style={{ color: speaking ? '#0fffc8' : '#8892b8' }}>
				{player.name.split(' ')[0]}
			</span>
			<div className='flex gap-[4px] items-center justify-center'>
				{player.isGamemaster
					? <span className='text-[8px] font-[700] px-[4px] py-[1px] rounded-[3px] whitespace-nowrap'
						style={{ background: 'rgba(15,255,200,0.1)', color: '#0fffc8', border: '1px solid rgba(15,255,200,0.2)' }}>
						{t('room.speaker.gamemaster')}
					</span>
					: <>
						{player.coins > 0 && <span className='text-[10px] flex items-center gap-[1px]' style={{ color: '#7a88b0' }}><CircleDollarSign size={9} />{player.coins}</span>}
						{player.influence > 0 && <span className='text-[10px] flex items-center gap-[1px]' style={{ color: '#7a88b0' }}><Zap size={9} />{player.influence}</span>}
					</>
				}
			</div>
		</>
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
