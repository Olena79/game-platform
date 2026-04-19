import React from 'react'
import { X, Megaphone } from 'lucide-react'

interface Props {
	text: string
	isGM: boolean
	onClose: () => void
}

export const AnnouncementBanner = ({ text, isGM, onClose }: Props) => (
	<div
		className='relative flex items-center gap-[10px] px-[16px] py-[9px] text-[13px] z-50 animate-slide-down'
		style={{
			background: 'linear-gradient(90deg, rgba(200,168,48,0.18) 0%, rgba(200,168,48,0.08) 100%)',
			borderBottom: '1px solid rgba(200,168,48,0.3)',
		}}
	>
		<Megaphone size={14} className='flex-shrink-0' style={{ color: '#c8a830' }} />
		<span className='flex-1 text-[rgba(255,230,120,0.9)] leading-[1.4]'>{text}</span>
		{isGM && (
			<button
				onClick={onClose}
				className='flex-shrink-0 w-[20px] h-[20px] rounded-full flex items-center justify-center hover:bg-[rgba(200,168,48,0.2)] transition-all cursor-pointer'
				style={{ color: 'rgba(200,168,48,0.7)' }}
			>
				<X size={11} strokeWidth={2.5} />
			</button>
		)}
	</div>
)
