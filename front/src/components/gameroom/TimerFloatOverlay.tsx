import React, { useEffect, useRef, useState } from 'react'
import { formatClock } from '../../utils/clock'
import { useTranslation } from 'react-i18next'
import type { RoomTimer } from './types'
import { sfx } from '../../utils/sounds'

interface Props { timer: RoomTimer 	/** Difference between this device's clock and the room's */
	clockOffset?: number
	/** Distance from the top of the room's main area: below the bar with the
	    image and bank buttons, which it used to cover */
	top?: number
}

const fmt = formatClock

export const TimerFloatOverlay = ({ timer, clockOffset = 0, top = 8 }: Props) => {
	const { t } = useTranslation()
	const [remaining, setRemaining] = useState(0)
	const warned30Ref  = useRef(false)
	const warnedEndRef = useRef(false)
	const startedRef   = useRef(false)
	// The countdown was seen running: only then is reaching zero "the end".
	// Joining a room whose timer already ran out used to ring at once.
	const sawRunningRef = useRef(false)

	useEffect(() => {
		warned30Ref.current  = false
		warnedEndRef.current = false
		startedRef.current   = false
		sawRunningRef.current = false
	}, [timer.label, timer.endsAt])

	useEffect(() => {
		const update = () => {
			if (!timer.running || !timer.endsAt) {
				setRemaining(timer.totalSeconds)
				return
			}
			const rem = Math.max(0, Math.round((timer.endsAt - (Date.now() + clockOffset)) / 1000))
			setRemaining(rem)

			// start beep — once when timer becomes running
			if (!startedRef.current) {
				startedRef.current = true
				if (rem > 0) sfx.timerStart()
			}
			if (rem > 0) sawRunningRef.current = true
			// 30-sec warning
			if (rem <= 30 && rem > 0 && !warned30Ref.current) {
				warned30Ref.current = true
				sfx.timerWarning()
			}
			// finish
			if (rem === 0 && !warnedEndRef.current && sawRunningRef.current) {
				warnedEndRef.current = true
				sfx.timerEnd()
			}
		}

		update()
		const id = setInterval(update, 500)
		return () => clearInterval(id)
	}, [timer])


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
			className='absolute right-[8px] z-[40] rounded-[10px] px-[14px] py-[8px] flex flex-col items-end'
			style={{
				top,
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
					{timer.running ? '' : t('room.timer.paused')}
				</span>
			)}
		</div>
	)
}
