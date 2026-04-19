import React from 'react'
import { useParticipants, useLocalParticipant, VideoTrack as LKVideoTrack } from '@livekit/components-react'
const VideoTrack = LKVideoTrack as React.ComponentType<any>
import { useIsSpeakingSafe as useIsSpeaking } from '../../hooks/useIsSpeakingSafe'
import { Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import type { RoomPlayer, GameRoomState } from './types'
import { ImagePanel } from './ImagePanel'
import { NEON_ICONS, NeonRaiseHand } from './NeonReactionIcon'

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🤔', '👏', '😢', '😡']

interface Props {
	state: GameRoomState
	myId: string
	isGM: boolean
	micOn: boolean
	camOn: boolean
	onToggleMic: () => void
	onToggleCam: () => void
	onReact: (emoji: string) => void
	onRaiseHand: (v: boolean) => void
	onLeave: () => void
	imageUrl?: string | null
	images?: string[]
	onImageClose?: () => void
	onChangeImage?: (url: string) => void
}

function MicBars({ active }: { active: boolean }) {
	if (!active) return null
	return (
		<div className='flex gap-[3px] items-end h-[18px]'>
			{[6, 14, 18, 12, 7].map((h, i) => (
				<div key={i} className='w-[3px] rounded-[2px]'
					style={{
						height: `${h}px`,
						background: '#0fffc8',
						animation: `barPulse 0.7s ease-in-out ${i * 0.1}s infinite alternate`,
					}}
				/>
			))}
		</div>
	)
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
					? <VideoTrack trackRef={{ participant: participant!, publication: camPub, source: Track.Source.Camera }} className='w-full h-full object-cover' />
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

function SpeakerDisplay({ state, speakerPlayer }: { state: GameRoomState; speakerPlayer: RoomPlayer | null }) {
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = speakerPlayer
		? (participants.find(p => p.identity === speakerPlayer.userId) ?? (localParticipant?.identity === speakerPlayer.userId ? localParticipant : undefined))
		: undefined
	const speaking = useIsSpeaking(participant)
	const camPub = participant?.getTrackPublication(Track.Source.Camera)
	const hasVideo = camPub?.isSubscribed && !camPub?.isMuted

	if (!speakerPlayer) {
		return (
			<div className='flex-1 flex items-center justify-center flex-col gap-[10px] relative min-h-0'>
				<div className='absolute inset-0 pointer-events-none'
					style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(15,255,200,0.06) 0%, transparent 65%)' }} />
				<div
					className='rounded-[14px] flex-shrink-0'
					style={{
						backgroundImage: `url(${state.shownImageUrl || state.coverImage || 'https://res.cloudinary.com/dsgqhwqr7/image/upload/v1776487495/none-399125188_ca4czg.webp'})`,
						backgroundSize: 'contain',
						backgroundRepeat: 'no-repeat',
						backgroundPosition: 'center',
						width: '600px',
						maxWidth: '90%',
						height: '340px',
						opacity: 0.7,
					}}
				/>
				<p className='text-[13px] flex-shrink-0' style={{ color: 'rgba(100,140,220,0.4)' }}>
					{state.status === 'lobby' ? 'Очікуємо початку...' : 'Тиша...'}
				</p>
			</div>
		)
	}

	return (
		<div className='flex-1 flex items-center justify-center flex-col gap-[14px] relative'>
			<div className='absolute inset-0 pointer-events-none'
				style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(15,255,200,0.07) 0%, transparent 65%)' }} />

			<div className='relative w-full h-full flex items-center justify-center'>
				{hasVideo && camPub ? (
					<div className='w-full h-full max-w-[480px] max-h-[270px] rounded-[14px] overflow-hidden'>
						<VideoTrack
							trackRef={{ participant: participant!, publication: camPub, source: Track.Source.Camera }}
							className='w-full h-full object-cover'
						/>
					</div>
				) : (
					<div className='w-[88px] h-[88px] rounded-full flex items-center justify-center text-[30px] font-[700]'
						style={{
							background: '#0f1120',
							border: '2px solid rgba(15,255,200,0.3)',
							color: '#0fffc8',
							boxShadow: '0 0 24px rgba(15,255,200,0.12)',
						}}>
						{speakerPlayer.initials}
					</div>
				)}
			</div>

			<div className='flex flex-col items-center gap-[5px]'>
				<span className='text-[19px] font-[700]' style={{ color: '#dde1f0' }}>{speakerPlayer.name}</span>
				{speakerPlayer.role && (
					<span className='text-[11px] px-[12px] py-[3px] rounded-[20px]'
						style={{ color: '#0fffc8', background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.2)' }}>
						{speakerPlayer.role}
					</span>
				)}
				<MicBars active={speaking} />
			</div>
		</div>
	)
}

export const SpeakerView = ({
	state, myId, isGM,
	micOn, camOn, onToggleMic, onToggleCam,
	onReact, onRaiseHand, onLeave,
	imageUrl, images = [], onImageClose, onChangeImage,
}: Props) => {
	const me = state.players.find(p => p.userId === myId)
	const handRaised = me?.handRaised ?? false
	const mainPlayers = state.players.filter(p => !p.breakoutRoomId && p.connected)
	const speakerPlayer = mainPlayers[0] ?? null

	return (
		<div className='flex-1 flex flex-col overflow-hidden' style={{ background: '#07080f' }}>
			{/* Top badges */}
			<div className='flex items-center justify-between px-[12px] pt-[10px] pb-0 flex-shrink-0'>
				<div className='flex items-center gap-[6px]'>
					<span className='text-[10px] font-[700] px-[8px] py-[3px] rounded-[4px]'
						style={{ background: '#ff3850', color: '#fff', letterSpacing: '0.06em' }}>● LIVE</span>
					<span className='text-[10px]' style={{ color: '#4a5070' }}>{state.title}</span>
				</div>
				<span className='text-[11px]' style={{ color: '#4a5070' }}>{mainPlayers.length} онлайн</span>
			</div>

			{/* Main area: image OR speaker */}
			{imageUrl
				? <ImagePanel imageUrl={imageUrl} isGM={isGM} images={images} onChangeImage={onChangeImage} onClose={onImageClose} fill />
				: <SpeakerDisplay state={state} speakerPlayer={speakerPlayer} />
			}

			{/* Players strip */}
			<div className='flex-shrink-0 overflow-x-auto px-[10px] py-[6px] flex gap-[7px]'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				{mainPlayers.map(p => (
					<div key={p.userId} className='flex-shrink-0 min-w-[72px] rounded-[8px] p-[6px] flex flex-col items-center gap-[3px] cursor-default'
						style={{ background: '#0f1120', border: '1px solid #1c1f35' }}>
						<StripTile player={p} />
					</div>
				))}
			</div>

			{/* Controls + Reactions — one row */}
			<div className='flex-shrink-0 flex items-center gap-[5px] px-[10px] py-[6px] flex-wrap'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				<CtrlBtn active={micOn} onClick={onToggleMic} icon={micOn ? <Mic size={13}/> : <MicOff size={13}/>} label='Мік' />
				<CtrlBtn active={camOn} onClick={onToggleCam} icon={camOn ? <Video size={13}/> : <VideoOff size={13}/>} label='Кам' />
				<CtrlBtn onClick={onLeave} icon={<PhoneOff size={13}/>} label='Вийти' variant='red' />
				<div className='flex-shrink-0 w-[1px] h-[18px] mx-[2px]' style={{ background: '#1c1f35' }} />
				{REACTIONS.map(emoji => (
					<button key={emoji} onClick={() => onReact(emoji)}
						className='flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110'
						style={{ width: '46px', height: '46px', background: 'transparent', borderRadius: '10px' }}
					>
						{React.createElement(NEON_ICONS[emoji] ?? NEON_ICONS['👍'], { size: 30 })}
						{(state.reactions[emoji] ?? 0) > 0 && (
							<span style={{ fontSize: '9px', color: '#0fffc8', fontWeight: 700, marginTop: '1px', lineHeight: 1 }}>
								{state.reactions[emoji]}
							</span>
						)}
					</button>
				))}
				<button onClick={() => onRaiseHand(!handRaised)}
					className='flex flex-col items-center justify-center cursor-pointer transition-all'
					style={{
						width: '46px', height: '46px',
						background: handRaised ? 'rgba(200,168,48,0.08)' : 'transparent',
						borderRadius: '10px',
					}}>
					<NeonRaiseHand size={30} active={handRaised} />
					{state.players.filter(p => p.handRaised).length > 0 && (
						<span style={{ fontSize: '9px', color: '#c8a830', fontWeight: 700, marginTop: '1px', lineHeight: 1 }}>
							{state.players.filter(p => p.handRaised).length}
						</span>
					)}
				</button>
			</div>
		</div>
	)
}

function StripTile({ player }: { player: RoomPlayer }) {
	const participants = useParticipants()
	const { localParticipant } = useLocalParticipant()
	const participant = participants.find(p => p.identity === player.userId) ?? (localParticipant?.identity === player.userId ? localParticipant : undefined)
	const speaking = useIsSpeaking(participant)

	return (
		<>
			<div className='w-[32px] h-[32px] rounded-full flex items-center justify-center text-[11px] font-[700]'
				style={{
					background: speaking ? 'rgba(15,255,200,0.15)' : '#1a1a2e',
					color: speaking ? '#0fffc8' : '#7a80a0',
					border: speaking ? '1px solid rgba(15,255,200,0.3)' : 'none',
				}}>
				{player.initials}
			</div>
			<span className='text-[10px] w-full text-center truncate' style={{ color: speaking ? '#0fffc8' : '#4a5070' }}>
				{player.name.split(' ')[0]}
			</span>
			<div className='flex gap-[4px]'>
				{player.coins > 0 && <span className='text-[9px]' style={{ color: '#4a5070' }}>🪙{player.coins}</span>}
				{player.influence > 0 && <span className='text-[9px]' style={{ color: '#4a5070' }}>⚡{player.influence}</span>}
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
			: { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }

	return (
		<button onClick={onClick}
			className='flex items-center gap-[5px] rounded-[8px] px-[12px] py-[7px] cursor-pointer transition-all hover:brightness-120 text-[12px] whitespace-nowrap'
			style={style}>
			{icon} {label}
		</button>
	)
}
