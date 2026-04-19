import React, { useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'

interface Props {
	imageUrl: string
	isGM?: boolean
	images?: string[]
	onChangeImage?: (url: string) => void
	onClose?: () => void
	fill?: boolean
}

export const ImagePanel = ({ imageUrl, isGM, images = [], onChangeImage, onClose, fill = false }: Props) => {
	const [expanded, setExpanded] = useState(false)

	if (expanded) {
		return (
			<div
				className='fixed inset-0 z-[100] flex items-center justify-center'
				style={{ background: 'rgba(7,8,15,0.92)' }}
				onClick={() => setExpanded(false)}
			>
				<img
					src={imageUrl}
					alt=''
					className='max-w-full max-h-full object-contain'
					style={{ maxWidth: '96vw', maxHeight: '92vh' }}
					onClick={e => e.stopPropagation()}
				/>
				<button
					onClick={() => setExpanded(false)}
					className='absolute top-[16px] right-[16px] w-[36px] h-[36px] rounded-full flex items-center justify-center cursor-pointer transition-all'
					style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.25)', color: '#0fffc8' }}
				>
					<Minimize2 size={16} strokeWidth={2} />
				</button>
			</div>
		)
	}

	return (
		<div
			className='relative w-full flex justify-center items-center min-h-0'
			style={{
				...(fill ? { flex: 1 } : { height: '40vh', flexShrink: 0 }),
				borderBottom: '1px solid rgba(68,170,255,0.1)',
				background: '#07080f',
			}}
		>
			<img
				src={imageUrl}
				alt=''
				style={{ maxHeight: '100%', maxWidth: '100%', width: 'auto', height: 'auto', display: 'block' }}
			/>
			{/* Controls overlay */}
			<div className='absolute bottom-[8px] right-[8px] flex gap-[5px]'>
				<button
					onClick={() => setExpanded(true)}
					className='w-[26px] h-[26px] rounded-[6px] flex items-center justify-center cursor-pointer transition-all'
					style={{ background: 'rgba(7,8,15,0.7)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(200,220,255,0.6)' }}
					title='Розгорнути'
				>
					<Maximize2 size={12} strokeWidth={2} />
				</button>
				{isGM && onClose && (
					<button
						onClick={onClose}
						className='w-[26px] h-[26px] rounded-[6px] flex items-center justify-center cursor-pointer transition-all'
						style={{ background: 'rgba(7,8,15,0.7)', border: '1px solid rgba(255,95,160,0.2)', color: 'rgba(255,95,160,0.6)' }}
						title='Сховати картинку'
					>
						<X size={12} strokeWidth={2} />
					</button>
				)}
			</div>

			{/* GM: image selector strip */}
			{isGM && images.length > 1 && (
				<div className='absolute bottom-[8px] left-[8px] flex gap-[4px]'>
					{images.map((url, i) => (
						<button
							key={i}
							onClick={() => onChangeImage?.(url)}
							className='w-[28px] h-[20px] rounded-[4px] overflow-hidden cursor-pointer transition-all'
							style={{
								border: url === imageUrl ? '2px solid #0fffc8' : '2px solid rgba(255,255,255,0.1)',
								opacity: url === imageUrl ? 1 : 0.5,
							}}
						>
							<img src={url} alt='' className='w-full h-full object-cover' />
						</button>
					))}
				</div>
			)}
		</div>
	)
}
