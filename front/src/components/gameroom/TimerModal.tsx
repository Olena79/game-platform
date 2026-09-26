import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NumberField } from '../minicomponents/NumberField'

interface Props {
	/** `start` true: the timer starts counting straight away */
	onSet: (label: string, seconds: number, start: boolean) => void
	onClose: () => void
}

const numberClass = 'w-full text-center rounded-[8px] px-[6px] py-[8px] text-[18px] font-[700] focus:outline-none'
const numberStyle = { background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }

/**
 * Setting a timer. "Set" only prepares it — the gamemaster starts it later —
 * which left people wondering why nothing counted down, so "Set and start"
 * sits right next to it.
 */
export const TimerModal = ({ onSet, onClose }: Props) => {
	const { t } = useTranslation()
	const [label, setLabel] = useState('')
	const [mins, setMins]   = useState<number | null>(5)
	const [secs, setSecs]   = useState<number | null>(0)

	const totalSecs = (mins ?? 0) * 60 + (secs ?? 0)
	const ready = totalSecs > 0

	const submit = (start: boolean) => {
		if (!ready) return
		onSet(label.trim() || t('room.timer.default_label'), totalSecs, start)
		onClose()
	}
	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') { e.preventDefault(); submit(false) }
		if (e.key === 'Escape') onClose()
	}

	return (
		<div className='room-modal-overlay z-[80]' onClick={onClose}>
			<div
				className='w-[320px] max-w-full rounded-[18px] p-[22px] flex flex-col gap-[14px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
				onClick={e => e.stopPropagation()}
				onKeyDown={onKeyDown}
			>
				<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>{t('room.timer.title')}</h3>

				<input
					placeholder={t('room.timer.name_placeholder')}
					value={label}
					onChange={e => setLabel(e.target.value.slice(0, 40))}
					className='w-full rounded-[8px] px-[10px] py-[8px] text-[13px] focus:outline-none'
					style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
				/>

				<div className='flex items-center gap-[10px]'>
					<div className='flex flex-col items-center gap-[4px] flex-1'>
						<span className='text-[10px] uppercase tracking-[0.5px]' style={{ color: 'rgba(100,140,220,0.45)' }}>{t('room.timer.minutes')}</span>
						<NumberField value={mins} onChange={setMins} max={99} placeholder='0'
							className={numberClass} style={numberStyle} aria-label={t('room.timer.minutes')} />
					</div>
					<span className='text-[22px] font-[300] pt-[16px]' style={{ color: 'rgba(100,140,220,0.4)' }}>:</span>
					<div className='flex flex-col items-center gap-[4px] flex-1'>
						<span className='text-[10px] uppercase tracking-[0.5px]' style={{ color: 'rgba(100,140,220,0.45)' }}>{t('room.timer.seconds')}</span>
						<NumberField value={secs} onChange={setSecs} max={59} placeholder='0'
							className={numberClass} style={numberStyle} aria-label={t('room.timer.seconds')} />
					</div>
				</div>

				<div className='flex flex-col gap-[8px]'>
					<button
						onClick={() => submit(true)}
						disabled={!ready}
						className='w-full py-[10px] rounded-[9px] text-[13px] font-[700] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed'
						style={{ background: 'rgba(15,255,200,0.16)', border: '1px solid rgba(15,255,200,0.45)', color: '#0fffc8' }}>
						{t('room.timer.set_and_start')}
					</button>
					<div className='flex gap-[8px]'>
						<button onClick={onClose}
							className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer transition-all'
							style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.6)' }}>
							{t('room.timer.cancel')}
						</button>
						<button
							onClick={() => submit(false)}
							disabled={!ready}
							className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed'
							style={{ background: 'rgba(15,255,200,0.06)', border: '1px solid rgba(15,255,200,0.25)', color: '#0fffc8' }}>
							{t('room.timer.set')}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
