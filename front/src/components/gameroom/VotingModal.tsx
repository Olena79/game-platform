import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
	onCreate: (question: string, options: string[], isAnonymous: boolean, multipleChoice: boolean) => void
	onClose: () => void
}

export const VotingModal = ({ onCreate, onClose }: Props) => {
	const { t } = useTranslation()
	const [question, setQuestion]         = useState('')
	const [options, setOptions]           = useState(['', ''])
	const [isAnonymous, setAnonymous]     = useState(false)
	const [multipleChoice, setMultiple]   = useState(false)

	const addOption = () => { if (options.length < 8) setOptions(p => [...p, '']) }
	const removeOption = (i: number) => setOptions(p => p.filter((_, idx) => idx !== i))
	const setOption = (i: number, v: string) => setOptions(p => p.map((o, idx) => idx === i ? v : o))

	const handleCreate = () => {
		const q = question.trim()
		const opts = options.map(o => o.trim()).filter(Boolean)
		if (!q || opts.length < 2) return
		onCreate(q, opts, isAnonymous, multipleChoice)
		onClose()
	}

	const btnStyle = (active: boolean) => ({
		background: active ? 'rgba(15,255,200,0.1)' : 'rgba(15,17,32,0.5)',
		border: active ? '1px solid rgba(15,255,200,0.3)' : '1px solid rgba(68,170,255,0.12)',
		color: active ? '#0fffc8' : 'rgba(100,140,220,0.5)',
	})

	return (
		<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.75)' }}>
			<div
				className='w-[360px] max-h-[90vh] overflow-y-auto rounded-[18px] p-[22px] flex flex-col gap-[14px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
			>
				<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>
					{t('room.vote.title')}
				</h3>

				<textarea
					placeholder={t('room.vote.question_placeholder')}
					value={question}
					onChange={e => setQuestion(e.target.value.slice(0, 300))}
					rows={2}
					className='w-full rounded-[10px] px-[12px] py-[9px] text-[13px] resize-none focus:outline-none'
					style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
				/>

				<div className='flex flex-col gap-[6px]'>
					{options.map((opt, i) => (
						<div key={i} className='flex gap-[6px]'>
							<input
								placeholder={`${t('room.vote.option_placeholder')}${i + 1}`}
								value={opt}
								onChange={e => setOption(i, e.target.value.slice(0, 100))}
								className='flex-1 rounded-[8px] px-[10px] py-[7px] text-[12px] focus:outline-none'
								style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.18)', color: 'rgba(180,200,255,0.85)' }}
							/>
							{options.length > 2 && (
								<button onClick={() => removeOption(i)}
									className='w-[30px] h-[30px] rounded-[7px] flex items-center justify-center cursor-pointer transition-all'
									style={{ background: 'rgba(255,95,160,0.06)', border: '1px solid rgba(255,95,160,0.18)', color: 'rgba(255,95,160,0.6)' }}>
									<Trash2 size={11} strokeWidth={2} />
								</button>
							)}
						</div>
					))}
					{options.length < 8 && (
						<button onClick={addOption}
							className='flex items-center gap-[5px] text-[11px] py-[5px] cursor-pointer transition-colors'
							style={{ color: 'rgba(68,170,255,0.5)' }}>
							<Plus size={12} /> {t('room.vote.add_option')}
						</button>
					)}
				</div>

				<div className='flex gap-[6px]'>
					<button onClick={() => setAnonymous(p => !p)}
						className='flex-1 py-[6px] rounded-[7px] text-[11px] font-[600] cursor-pointer transition-all'
						style={btnStyle(isAnonymous)}>
						{t('room.vote.anonymous')}
					</button>
					<button onClick={() => setMultiple(p => !p)}
						className='flex-1 py-[6px] rounded-[7px] text-[11px] font-[600] cursor-pointer transition-all'
						style={btnStyle(multipleChoice)}>
						{t('room.vote.multiple')}
					</button>
				</div>

				<div className='flex gap-[8px] pt-[2px]'>
					<button onClick={onClose}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer transition-all'
						style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.5)' }}>
						{t('room.vote.cancel')}
					</button>
					<button onClick={handleCreate}
						disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer transition-all disabled:opacity-40'
						style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
						{t('room.vote.start')}
					</button>
				</div>
			</div>
		</div>
	)
}
