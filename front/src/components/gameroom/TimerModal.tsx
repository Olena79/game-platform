import React, { useState } from 'react'

interface Props {
	onSet: (label: string, seconds: number) => void
	onClose: () => void
}

export const TimerModal = ({ onSet, onClose }: Props) => {
	const [label, setLabel]   = useState('')
	const [mins, setMins]     = useState(5)
	const [secs, setSecs]     = useState(0)

	const totalSecs = mins * 60 + secs

	return (
		<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.75)' }}>
			<div
				className='w-[300px] rounded-[18px] p-[22px] flex flex-col gap-[14px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
			>
				<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>⏱️ Таймер</h3>

				<input
					placeholder='Назва (наприклад: Раунд 1)'
					value={label}
					onChange={e => setLabel(e.target.value.slice(0, 40))}
					className='w-full rounded-[8px] px-[10px] py-[8px] text-[13px] focus:outline-none'
					style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
				/>

				<div className='flex items-center gap-[10px]'>
					<div className='flex flex-col items-center gap-[4px] flex-1'>
						<span className='text-[10px] uppercase tracking-[0.5px]' style={{ color: 'rgba(100,140,220,0.45)' }}>Хв</span>
						<input
							type='number' min={0} max={99} value={mins}
							onChange={e => setMins(Math.max(0, Number(e.target.value)))}
							className='w-full text-center rounded-[8px] px-[6px] py-[8px] text-[18px] font-[700] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
							style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
						/>
					</div>
					<span className='text-[22px] font-[300] pt-[16px]' style={{ color: 'rgba(100,140,220,0.4)' }}>:</span>
					<div className='flex flex-col items-center gap-[4px] flex-1'>
						<span className='text-[10px] uppercase tracking-[0.5px]' style={{ color: 'rgba(100,140,220,0.45)' }}>Сек</span>
						<input
							type='number' min={0} max={59} value={secs}
							onChange={e => setSecs(Math.max(0, Math.min(59, Number(e.target.value))))}
							className='w-full text-center rounded-[8px] px-[6px] py-[8px] text-[18px] font-[700] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
							style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
						/>
					</div>
				</div>

				<div className='flex gap-[8px]'>
					<button onClick={onClose}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer transition-all'
						style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.5)' }}>
						Скасувати
					</button>
					<button
						onClick={() => { if (totalSecs > 0) { onSet(label || 'Таймер', totalSecs); onClose() } }}
						disabled={totalSecs <= 0}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer transition-all disabled:opacity-40'
						style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
						Встановити
					</button>
				</div>
			</div>
		</div>
	)
}
