import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Megaphone, Vote, VolumeX, Timer, DoorOpen, Users, Square } from 'lucide-react'
import type { GameRoomState, RoomTimer } from './types'
import { RecordingControls, RecordingControlsProps } from './RecordingControls'

function useTimer(timer: RoomTimer | null, clockOffset = 0) {
	const [remaining, setRemaining] = useState(0)

	useEffect(() => {
		if (!timer) { setRemaining(0); return }
		const update = () => {
			if (!timer.running || !timer.endsAt) { setRemaining(timer.totalSeconds); return }
			setRemaining(Math.max(0, Math.round((timer.endsAt - (Date.now() + clockOffset)) / 1000)))
		}
		update()
		const id = setInterval(update, 500)
		return () => clearInterval(id)
	}, [timer])

	return remaining
}

function fmt(s: number) {
	const m = Math.floor(s / 60), sec = s % 60
	return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

interface Props {
	state: GameRoomState
	onAnnounce: () => void
	onVoting: () => void
	onSpectatorVoting: () => void
	onMuteAll: () => void
	onEndGame: () => void
	onTimer: () => void
	onTimerStart: () => void
	onTimerStop: () => void
	onTimerClear: () => void
	onBreakout: () => void
	recording: RecordingControlsProps
	clockOffset?: number
}

export const ModPanel = ({
	state, onAnnounce, onVoting, onSpectatorVoting, onMuteAll, onEndGame,
	onTimer, onTimerStart, onTimerStop, onTimerClear, onBreakout,
	recording, clockOffset = 0,
}: Props) => {
	const { t } = useTranslation()
	const remaining = useTimer(state.timer, clockOffset)
	const timer = state.timer

	const toolBtn = (
		icon: React.ReactNode, label: string,
		onClick: () => void,
		variant: 'default' | 'warn' | 'danger' = 'default',
		active = false,
	) => {
		const colors = {
			default: active
				? { border: '1px solid rgba(15,255,200,0.35)', color: '#0fffc8', bg: 'rgba(15,255,200,0.1)' }
				: { border: '1px solid #1c1f35', color: 'rgba(115,128,175,1)', bg: '#0f1120' },
			warn:    { border: '1px solid rgba(200,168,48,0.3)', color: '#c8a830', bg: 'rgba(200,168,48,0.07)' },
			danger:  { border: '1px solid rgba(255,56,80,0.3)', color: '#ff3850', bg: 'rgba(255,56,80,0.07)' },
		}[variant]

		return (
			<button
				onClick={onClick}
				className='rounded-[8px] p-[8px] cursor-pointer flex flex-col items-center gap-[3px] transition-all hover:brightness-125'
				style={{ background: colors.bg, border: colors.border }}
			>
				<span style={{ color: colors.color }}>{icon}</span>
				<span className='text-[11px] text-center leading-[1.3]' style={{ color: colors.color }}>{label}</span>
			</button>
		)
	}

	return (
		<div className='flex flex-col gap-[8px] p-[10px]' style={{ borderTop: '1px solid #151824' }}>
			<span className='text-[11px] uppercase tracking-[0.1em]' style={{ color: '#7a88b0' }}>
				{t('room.mod.title')}
			</span>

			{/* Timer display */}
			{timer && (
				<div className='flex items-center gap-[6px] rounded-[8px] px-[10px] py-[7px]'
					style={{ background: 'rgba(200,168,48,0.08)', border: '1px solid rgba(200,168,48,0.22)' }}>
					<div className='flex-1'>
						<div className='text-[11px] mb-[1px]' style={{ color: 'rgba(200,168,48,0.85)' }}>{timer.label}</div>
						<div className='text-[18px] font-[700] font-mono' style={{ color: '#c8a830' }}>{fmt(remaining)}</div>
					</div>
					{!timer.running
						? <button onClick={onTimerStart} className='text-[11px] px-[8px] py-[5px] rounded-[6px] cursor-pointer transition-all'
								style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>▶</button>
						: <button onClick={onTimerStop} className='text-[11px] px-[8px] py-[5px] rounded-[6px] cursor-pointer transition-all'
								style={{ background: 'rgba(200,168,48,0.1)', border: '1px solid rgba(200,168,48,0.3)', color: '#c8a830' }}>⏸</button>
					}
					<button onClick={onTimerClear} className='text-[11px] px-[6px] py-[5px] rounded-[6px] cursor-pointer transition-all'
						style={{ background: 'rgba(255,56,80,0.07)', border: '1px solid rgba(255,56,80,0.25)', color: 'rgba(255,56,80,0.88)' }}>✕</button>
				</div>
			)}

			<div className='grid grid-cols-3 gap-[5px]'>
				{toolBtn(<Megaphone size={14} />, t('room.mod.announce'), onAnnounce, 'default', !!state.announcement)}
				{toolBtn(<Vote size={14} />, t('room.mod.vote'), onVoting, 'default', !!state.activeVote)}
				{toolBtn(<Users size={14} />, t('room.mod.spectators'), onSpectatorVoting, 'default', !!state.spectatorVote)}
				{toolBtn(<Timer size={14} />, t('room.mod.timer'), onTimer)}
				{toolBtn(<VolumeX size={14} />, t('room.mod.mute_all'), onMuteAll, 'warn')}
				{toolBtn(<DoorOpen size={14} />, `${t('room.mod.breakout')} (${state.breakoutRooms.length})`, onBreakout)}
				{toolBtn(<Square size={14} />, t('room.mod.stop_game'), onEndGame, 'danger')}
			</div>

			{/* Recording */}
			<div className='mt-[2px] flex flex-col gap-[5px]' style={{ borderTop: '1px solid #1c1f35', paddingTop: '8px' }}>
				<span className='text-[11px] uppercase tracking-[0.1em]' style={{ color: '#7a88b0' }}>{t('room.mod.recording')}</span>

				<RecordingControls {...recording} />
			</div>
		</div>
	)
}
