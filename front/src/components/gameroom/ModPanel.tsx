import React, { useState, useEffect } from 'react'
import { Megaphone, Vote, VolumeX, Timer, DoorOpen, Users, Video, Square } from 'lucide-react'
import type { GameRoomState, RoomTimer } from './types'

function useTimer(timer: RoomTimer | null) {
	const [remaining, setRemaining] = useState(0)

	useEffect(() => {
		if (!timer) { setRemaining(0); return }
		const update = () => {
			if (!timer.running || !timer.endsAt) { setRemaining(timer.totalSeconds); return }
			setRemaining(Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000)))
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
	onOpenObserver: () => void
	onRecordStart: () => void
	onRecordStop: () => void
	recordStatus: string
}

export const ModPanel = ({
	state, onAnnounce, onVoting, onSpectatorVoting, onMuteAll, onEndGame,
	onTimer, onTimerStart, onTimerStop, onTimerClear, onBreakout,
	onOpenObserver, onRecordStart, onRecordStop, recordStatus,
}: Props) => {
	const remaining = useTimer(state.timer)
	const t = state.timer

	const hasObserver = state.hasObserver ?? false
	const isRecording = recordStatus === 'recording'
	const isPrepared = recordStatus === 'prepared'
	const isUploading = recordStatus === 'uploading'
	const isDone = recordStatus === 'done'

	const toolBtn = (
		icon: React.ReactNode, label: string,
		onClick: () => void,
		variant: 'default' | 'warn' | 'danger' = 'default',
		active = false,
	) => {
		const colors = {
			default: active
				? { border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8', bg: 'rgba(15,255,200,0.08)' }
				: { border: '1px solid #1c1f35', color: 'rgba(74,80,112,1)', bg: '#0f1120' },
			warn:    { border: '1px solid rgba(200,168,48,0.25)', color: '#c8a830', bg: 'rgba(200,168,48,0.05)' },
			danger:  { border: '1px solid rgba(255,56,80,0.25)', color: '#ff3850', bg: 'rgba(255,56,80,0.05)' },
		}[variant]

		return (
			<button
				onClick={onClick}
				className='rounded-[8px] p-[8px] cursor-pointer flex flex-col items-center gap-[3px] transition-all hover:brightness-125'
				style={{ background: colors.bg, border: colors.border }}
			>
				<span style={{ color: colors.color }}>{icon}</span>
				<span className='text-[10px] text-center leading-[1.2]' style={{ color: colors.color }}>{label}</span>
			</button>
		)
	}

	return (
		<div className='flex flex-col gap-[8px] p-[10px]' style={{ borderTop: '1px solid #151824' }}>
			<span className='text-[10px] uppercase tracking-[0.1em]' style={{ color: '#4a5070' }}>
				Панель ведучого
			</span>

			{/* Timer display */}
			{t && (
				<div className='flex items-center gap-[6px] rounded-[8px] px-[10px] py-[7px]'
					style={{ background: 'rgba(200,168,48,0.08)', border: '1px solid rgba(200,168,48,0.22)' }}>
					<div className='flex-1'>
						<div className='text-[10px] mb-[1px]' style={{ color: 'rgba(200,168,48,0.6)' }}>{t.label}</div>
						<div className='text-[18px] font-[700] font-mono' style={{ color: '#c8a830' }}>{fmt(remaining)}</div>
					</div>
					{!t.running
						? <button onClick={onTimerStart} className='text-[10px] px-[8px] py-[4px] rounded-[6px] cursor-pointer transition-all'
								style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>▶</button>
						: <button onClick={onTimerStop} className='text-[10px] px-[8px] py-[4px] rounded-[6px] cursor-pointer transition-all'
								style={{ background: 'rgba(200,168,48,0.1)', border: '1px solid rgba(200,168,48,0.3)', color: '#c8a830' }}>⏸</button>
					}
					<button onClick={onTimerClear} className='text-[10px] px-[6px] py-[4px] rounded-[6px] cursor-pointer transition-all'
						style={{ background: 'rgba(255,56,80,0.06)', border: '1px solid rgba(255,56,80,0.2)', color: 'rgba(255,56,80,0.65)' }}>✕</button>
				</div>
			)}

			<div className='grid grid-cols-3 gap-[5px]'>
				{toolBtn(<Megaphone size={14} />, 'Оголошення', onAnnounce, 'default', !!state.announcement)}
				{toolBtn(<Vote size={14} />, 'Голосування', onVoting, 'default', !!state.activeVote)}
				{toolBtn(<Users size={14} />, 'Глядачі', onSpectatorVoting, 'default', !!state.spectatorVote)}
				{toolBtn(<Timer size={14} />, 'Таймер', onTimer)}
				{toolBtn(<VolumeX size={14} />, 'Мют всіх', onMuteAll, 'warn')}
				{toolBtn(<DoorOpen size={14} />, `Кімнати (${state.breakoutRooms.length})`, onBreakout)}
				{toolBtn(<Square size={14} />, 'Зупинити гру', onEndGame, 'danger')}
			</div>

			{/* Observer / Recording section */}
			<div className='mt-[2px] flex flex-col gap-[5px]' style={{ borderTop: '1px solid #1c1f35', paddingTop: '8px' }}>
				<span className='text-[10px] uppercase tracking-[0.1em]' style={{ color: '#4a5070' }}>Запис</span>

				{!hasObserver ? (
					<button onClick={onOpenObserver}
						className='flex items-center justify-center gap-[6px] rounded-[8px] p-[8px] cursor-pointer transition-all hover:brightness-125'
						style={{ background: '#0f1120', border: '1px solid #1c1f35', color: 'rgba(74,80,112,1)' }}>
						<Video size={13} />
						<span className='text-[11px]'>Відкрити спостерігача</span>
					</button>
				) : (
					<div className='flex flex-col gap-[5px]'>
						<div className='flex items-center gap-[6px] px-[8px] py-[5px] rounded-[8px]'
							style={{
								background: isRecording ? 'rgba(255,56,80,0.08)' : 'rgba(15,255,200,0.06)',
								border: isRecording ? '1px solid rgba(255,56,80,0.25)' : '1px solid rgba(15,255,200,0.2)',
							}}>
							<Video size={12} style={{ color: isRecording ? '#ff3850' : '#0fffc8' }} />
							<span className='text-[11px] font-[500]' style={{ color: isRecording ? '#ff3850' : '#0fffc8' }}>
								{isRecording ? '● Запис активний' : isUploading ? `Завантаження...` : isDone ? '✓ Збережено' : isPrepared ? 'Готовий' : 'Спостерігач підключений'}
							</span>
						</div>
						<div className='grid grid-cols-2 gap-[5px]'>
							<button
								onClick={onRecordStart}
								disabled={!isPrepared}
								className='rounded-[8px] p-[7px] cursor-pointer flex items-center justify-center gap-[4px] transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed'
								style={{ background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.25)', color: '#0fffc8' }}>
								<span className='text-[10px]'>▶ Старт</span>
							</button>
							<button
								onClick={onRecordStop}
								disabled={!isRecording}
								className='rounded-[8px] p-[7px] cursor-pointer flex items-center justify-center gap-[4px] transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed'
								style={{ background: 'rgba(255,56,80,0.08)', border: '1px solid rgba(255,56,80,0.25)', color: '#ff3850' }}>
								<span className='text-[10px]'>■ Стоп</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
