import React, { useEffect, useRef, useState } from 'react'
import type { RoomTimer } from './types'

interface Props { timer: RoomTimer }

function fmt(s: number) {
	const m = Math.floor(s / 60), sec = s % 60
	return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function beep(freqs: number[], duration: number, gap = 0.08) {
	try {
		const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
		freqs.forEach((f, i) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)
			osc.type = 'sine'
			osc.frequency.setValueAtTime(f, ctx.currentTime + i * (duration + gap))
			gain.gain.setValueAtTime(0.35, ctx.currentTime + i * (duration + gap))
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * (duration + gap) + duration)
			osc.start(ctx.currentTime + i * (duration + gap))
			osc.stop(ctx.currentTime + i * (duration + gap) + duration)
		})
	} catch {}
}

export const TimerFloatOverlay = ({ timer }: Props) => {
	const [remaining, setRemaining] = useState(0)
	const warned30Ref  = useRef(false)
	const warnedEndRef = useRef(false)
	const startedRef   = useRef(false)

	useEffect(() => {
		warned30Ref.current  = false
		warnedEndRef.current = false
		startedRef.current   = false
	}, [timer.label])

	useEffect(() => {
		const update = () => {
			if (!timer.running || !timer.endsAt) {
				setRemaining(timer.totalSeconds)
				return
			}
			const rem = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000))
			setRemaining(rem)

			// start beep — once when timer becomes running
			if (!startedRef.current) {
				startedRef.current = true
				beep([660, 880], 0.18, 0.07) // two quick rising tones
			}
			// 30-sec warning
			if (rem <= 30 && rem > 0 && !warned30Ref.current) {
				warned30Ref.current = true
				beep([550, 550, 440], 0.15, 0.12) // three mid-low beeps
			}
			// finish
			if (rem === 0 && !warnedEndRef.current) {
				warnedEndRef.current = true
				beep([880, 660, 440], 0.25, 0.15) // three descending tones
			}
		}

		update()
		const id = setInterval(update, 500)
		return () => clearInterval(id)
	}, [timer])

	// also fire start beep when timer.running first becomes true
	useEffect(() => {
		if (timer.running && !startedRef.current) {
			startedRef.current = true
			beep([660, 880], 0.18, 0.07)
		}
	}, [timer.running])

	const isRunning = timer.running && !!timer.endsAt
	const nearEnd   = remaining <= 30 && remaining > 0 && isRunning
	const isEnd     = remaining === 0 && isRunning

	const color = isEnd ? '#ff3850' : nearEnd ? '#c8a830' : '#0fffc8'
	const bg    = isEnd
		? 'rgba(255,56,80,0.12)'
		: nearEnd
			? 'rgba(200,168,48,0.12)'
			: 'rgba(15,255,200,0.08)'
	const border = isEnd
		? 'rgba(255,56,80,0.35)'
		: nearEnd
			? 'rgba(200,168,48,0.35)'
			: 'rgba(15,255,200,0.25)'

	return (
		<div
			className='absolute top-[8px] right-[8px] z-[40] rounded-[10px] px-[14px] py-[8px] flex flex-col items-end'
			style={{
				background: bg,
				border: `1px solid ${border}`,
				backdropFilter: 'blur(6px)',
				boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
				animation: nearEnd && !isEnd ? 'timerPulse 1s ease-in-out infinite alternate' : 'none',
			}}
		>
			<style>{`
				@keyframes timerPulse {
					from { box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
					to   { box-shadow: 0 4px 24px rgba(200,168,48,0.4); }
				}
			`}</style>
			{timer.label && (
				<span className='text-[9px] uppercase tracking-[0.1em] mb-[1px]' style={{ color: `${color}99` }}>
					{timer.label}
				</span>
			)}
			<span
				className='font-mono font-[700] leading-[1]'
				style={{
					fontSize: '26px',
					color,
					textShadow: `0 0 14px ${color}55`,
				}}
			>
				{fmt(remaining)}
			</span>
			{!isRunning && (
				<span className='text-[9px] mt-[1px]' style={{ color: `${color}66` }}>
					{timer.running ? '' : 'пауза'}
				</span>
			)}
		</div>
	)
}
