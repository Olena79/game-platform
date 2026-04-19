import React, { useState } from 'react'
import { useParticipants, useLocalParticipant, VideoTrack as LKVideoTrack } from '@livekit/components-react'
const VideoTrack = LKVideoTrack as React.ComponentType<any>
import { useIsSpeakingSafe as useIsSpeaking } from '../../hooks/useIsSpeakingSafe'
import { Track } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Pencil, Minus, Plus } from 'lucide-react'
import type { RoomPlayer, GameRoomState } from './types'

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🤔', '👏']

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
	onSetRole: (targetUserId: string, role: string) => void
	onSetInfluence: (targetUserId: string, delta: number) => void
}

function GridPlayerCard({ player, isGM, myId, onSetRole, onSetInfluence }: {
	player: RoomPlayer; isGM: boolean; myId: string
	onSetRole: (uid: string, role: string) => void
	onSetInfluence: (uid: string, delta: number) => void
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

	const [editRole, setEditRole] = useState(false)
	const [roleInput, setRoleInput] = useState(player.role)

	const canEditRole = isGM || player.userId === myId

	return (
		<div
			className='relative rounded-[9px] overflow-hidden flex flex-col'
			style={{
				background: '#0f1120',
				border: speaking ? '1px solid rgba(15,255,200,0.4)' : '1px solid #1c1f35',
				boxShadow: speaking ? '0 0 10px rgba(15,255,200,0.08)' : 'none',
			}}
		>
			{/* Mic icon */}
			<div className='absolute top-[5px] left-[5px] text-[11px] z-10'>
				{micMuted ? '🔇' : '🎤'}
			</div>

			{/* Camera area */}
			<div className='flex-1 flex items-center justify-center' style={{ background: '#080912', minHeight: '80px' }}>
				{hasVideo && camPub ? (
					<VideoTrack
						trackRef={{ participant: participant!, publication: camPub, source: Track.Source.Camera }}
						className='w-full h-full object-cover'
					/>
				) : (
					<div className='w-[38px] h-[38px] rounded-full flex items-center justify-center text-[14px] font-[700]'
						style={{
							background: speaking ? 'rgba(15,255,200,0.15)' : '#1a1a2e',
							color: speaking ? '#0fffc8' : '#7a80a0',
							border: speaking ? '1px solid rgba(15,255,200,0.3)' : 'none',
						}}>
						{player.initials}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className='px-[7px] py-[5px] flex items-center justify-between gap-[4px]'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				<div className='flex-1 min-w-0'>
					<div className='text-[11px] font-[600] truncate'
						style={{ color: speaking ? '#0fffc8' : '#dde1f0' }}>
						{player.name}
					</div>
					{editRole ? (
						<input
							autoFocus
							value={roleInput}
							onChange={e => setRoleInput(e.target.value.slice(0, 60))}
							onBlur={() => { onSetRole(player.userId, roleInput); setEditRole(false) }}
							onKeyDown={e => { if (e.key === 'Enter') { onSetRole(player.userId, roleInput); setEditRole(false) } }}
							className='w-full text-[10px] rounded-[4px] px-[4px] py-[1px] focus:outline-none'
							style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.3)', color: 'rgba(180,200,255,0.9)' }}
						/>
					) : (
						<div className='flex items-center gap-[3px]'>
							<span className='text-[10px] truncate' style={{ color: '#4a5070' }}>{player.role || '—'}</span>
							{canEditRole && (
								<button onClick={() => { setRoleInput(player.role); setEditRole(true) }}
									className='cursor-pointer opacity-0 group-hover:opacity-100 transition-all'
									style={{ color: 'rgba(68,170,255,0.4)' }}>
									<Pencil size={8} strokeWidth={2} />
								</button>
							)}
						</div>
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
					<button onClick={() => { setRoleInput(player.role); setEditRole(true) }}
						className='w-[18px] h-[18px] rounded-[4px] flex items-center justify-center cursor-pointer transition-all'
						style={{ background: 'rgba(11,13,26,0.85)', border: '1px solid #1c1f35', color: '#4a5070' }}>
						<Pencil size={9} strokeWidth={2} />
					</button>
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

export const GridView = ({
	state, myId, isGM,
	micOn, camOn, onToggleMic, onToggleCam,
	onReact, onRaiseHand, onLeave,
	onSetRole, onSetInfluence,
}: Props) => {
	const me = state.players.find(p => p.userId === myId)
	const handRaised = me?.handRaised ?? false
	const mainPlayers = state.players.filter(p => !p.breakoutRoomId && p.connected)

	return (
		<div className='flex-1 flex flex-col overflow-hidden group' style={{ background: '#07080f' }}>
			{/* Grid */}
			<div className='flex-1 overflow-y-auto p-[10px]'
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
					gap: '7px',
					alignContent: 'start',
				}}>
				{mainPlayers.map(p => (
					<GridPlayerCard
						key={p.userId}
						player={p}
						isGM={isGM}
						myId={myId}
						onSetRole={onSetRole}
						onSetInfluence={onSetInfluence}
					/>
				))}
			</div>

			{/* Reactions bar */}
			<div className='flex-shrink-0 flex items-center gap-[5px] px-[14px] py-[7px] flex-wrap'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				{REACTIONS.map(emoji => (
					<button key={emoji} onClick={() => onReact(emoji)}
						className='flex items-center gap-[4px] rounded-[20px] px-[10px] py-[4px] cursor-pointer transition-all hover:brightness-110'
						style={{ background: '#0f1120', border: '1px solid #1c1f35' }}>
						<span className='text-[14px]'>{emoji}</span>
						<span className='text-[11px] font-[600]' style={{ color: '#7a80a0' }}>{state.reactions[emoji] ?? 0}</span>
					</button>
				))}
				<button onClick={() => onRaiseHand(!handRaised)}
					className='ml-auto flex items-center gap-[5px] rounded-[20px] px-[10px] py-[4px] cursor-pointer transition-all'
					style={{
						background: handRaised ? 'rgba(200,168,48,0.1)' : 'rgba(15,17,32,0.5)',
						border: handRaised ? '1px solid rgba(200,168,48,0.35)' : '1px solid #1c1f35',
					}}>
					<span className='text-[13px]'>✋</span>
					<span className='text-[11px]' style={{ color: '#c8a830' }}>
						{state.players.filter(p => p.handRaised).length}
					</span>
				</button>
			</div>

			{/* Controls */}
			<div className='flex-shrink-0 flex items-center gap-[7px] px-[14px] py-[9px]'
				style={{ background: '#0b0d1a', borderTop: '1px solid #151824' }}>
				<CtrlBtn active={micOn} onClick={onToggleMic} icon={micOn ? <Mic size={14}/> : <MicOff size={14}/>} label='Мікрофон' />
				<CtrlBtn active={camOn} onClick={onToggleCam} icon={camOn ? <Video size={14}/> : <VideoOff size={14}/>} label='Камера' />
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
