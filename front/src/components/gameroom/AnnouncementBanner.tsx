import React, { useEffect, useState, useRef } from 'react'
import { X, Megaphone } from 'lucide-react'

interface Props {
	text: string | null
	isGM: boolean
	onClose: () => void
}

export const AnnouncementBanner = ({ text, isGM, onClose }: Props) => {
	const [visible, setVisible] = useState(false)
	const [displayText, setDisplayText] = useState<string>('')
	const hideTimer = useRef<ReturnType<typeof setTimeout>>()

	useEffect(() => {
		if (text) {
			clearTimeout(hideTimer.current)
			setDisplayText(text)
			// small rAF delay so browser can mount the element before transition starts
			requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
		} else {
			setVisible(false)
			hideTimer.current = setTimeout(() => setDisplayText(''), 600)
		}
		return () => clearTimeout(hideTimer.current)
	}, [text])

	if (!displayText && !visible) return null

	return (
		<div
			style={{
				maxHeight: visible ? '120px' : '0',
				opacity: visible ? 1 : 0,
				overflow: 'hidden',
				transition: visible
					? 'max-height 1.5s cubic-bezier(0.16,1,0.3,1), opacity 1.2s ease'
					: 'max-height 0.5s ease, opacity 0.45s ease',
				flexShrink: 0,
			}}
		>
			<div
				className='relative flex items-center gap-[12px] px-[20px] py-[13px] text-[14px]'
				style={{
					background: '#f5c800',
					borderBottom: '2px solid #d4a900',
				}}
			>
				<Megaphone size={16} className='flex-shrink-0' style={{ color: '#000' }} />
				<span className='flex-1 font-[600] leading-[1.4]' style={{ color: '#000' }}>
					{displayText}
				</span>
				{isGM && (
					<button
						onClick={onClose}
						className='flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all cursor-pointer hover:bg-black/10'
						style={{ color: '#000' }}
					>
						<X size={12} strokeWidth={2.5} />
					</button>
				)}
			</div>
		</div>
	)
}
