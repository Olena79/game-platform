import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StarField } from './StarField'

interface Props { onDone?: () => void }

export const GameEndOverlay = ({ onDone }: Props) => {
	const { t } = useTranslation()
	const [phase, setPhase] = useState<'in' | 'show' | 'out'>('in')

	useEffect(() => {
		const t1 = setTimeout(() => setPhase('show'), 600)
		const t2 = setTimeout(() => setPhase('out'), 8000)
		const t3 = setTimeout(() => onDone?.(), 9000)
		return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
	}, [])

	return (
		<div
			className='fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden'
			style={{
				background: '#030512',
				opacity: phase === 'out' ? 0 : 1,
				transition: 'opacity 1000ms ease',
				pointerEvents: phase === 'out' ? 'none' : 'all',
			}}
		>
			<StarField />

			<div className='absolute inset-0 pointer-events-none'
				style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(15,255,200,0.07) 0%, transparent 60%)' }} />

			<svg className='absolute inset-0 w-full h-full pointer-events-none' style={{ opacity: 0.16 }}>
				{Array.from({ length: 30 }, (_, i) => {
					const angle = (i / 30) * 360
					const r1 = 38, r2 = 48
					const x1 = 50 + r1 * Math.cos(angle * Math.PI / 180)
					const y1 = 50 + r1 * Math.sin(angle * Math.PI / 180) * 0.5
					const x2 = 50 + r2 * Math.cos(angle * Math.PI / 180)
					const y2 = 50 + r2 * Math.sin(angle * Math.PI / 180) * 0.5
					return <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke='#0fffc8' strokeWidth='1' />
				})}
			</svg>

			<div
				className='absolute rounded-full pointer-events-none'
				style={{
					width: 'min(380px, 80vw)',
					height: 'min(380px, 80vw)',
					background: 'radial-gradient(circle, rgba(15,255,200,0.1) 0%, transparent 70%)',
					animation: 'pulse 2s ease-in-out infinite',
				}}
			/>

			<div className='relative flex flex-col items-center gap-[12px] sm:gap-[18px] px-[20px]'
				style={{
					opacity: phase === 'show' ? 1 : 0,
					transform: phase === 'show' ? 'translateY(0) scale(1)' : 'translateY(22px) scale(0.94)',
					transition: 'opacity 700ms ease, transform 700ms ease',
				}}>
				<span
					className='text-[10px] uppercase font-[600] text-center'
					style={{ color: 'rgba(15,255,200,0.55)', letterSpacing: 'clamp(2px, 1vw, 4px)' }}
				>
					Games of Senses
				</span>
				<div className='flex flex-col items-center gap-[6px]'>
					<h1
						className='font-amatic font-[700] leading-[1] text-center'
						style={{
							color: '#0fffc8',
							textShadow: '0 0 40px rgba(15,255,200,0.5)',
							fontSize: 'clamp(36px, 10vw, 80px)',
						}}
					>
						{t('room.end.title')}
					</h1>
					<p
						className='font-[300] tracking-[1px] text-center'
						style={{ color: 'rgba(180,220,255,0.65)', fontSize: 'clamp(13px, 4vw, 22px)' }}
					>
						{t('room.end.subtitle')}
					</p>
				</div>
				<div className='mt-[4px] sm:mt-[8px] flex items-center gap-[8px] text-[13px]' style={{ color: 'rgba(15,255,200,0.4)' }}>
					<span className='w-[24px] sm:w-[32px] h-[1px]' style={{ background: 'rgba(15,255,200,0.28)' }} />
					<span>{t('room.end.thanks')}</span>
					<span className='w-[24px] sm:w-[32px] h-[1px]' style={{ background: 'rgba(15,255,200,0.28)' }} />
				</div>
			</div>
		</div>
	)
}
