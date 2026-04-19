import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
	isOpen: boolean
	onClose: () => void
	title: string
	message?: string
	variant?: 'success' | 'error' | 'warn' | 'default'
	onConfirm?: () => void
	confirmLabel?: string
	cancelLabel?: string
	closeLabel?: string
	children?: React.ReactNode
}

const ACCENT: Record<string, string> = {
	success: '#0fffc8',
	error:   '#ff5fa0',
	warn:    '#ffb340',
	default: '#44aaff',
}

export const Modal: React.FC<ModalProps> = ({
	isOpen,
	onClose,
	title,
	message,
	variant = 'default',
	onConfirm,
	confirmLabel,
	cancelLabel,
	closeLabel = 'OK',
	children,
}) => {
	useEffect(() => {
		if (!isOpen) return
		const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [isOpen, onClose])

	if (!isOpen) return null

	const accent = ACCENT[variant]
	const isConfirm = !!onConfirm

	return createPortal(
		<div
			className='fixed inset-0 z-[500] flex items-center justify-center px-[20px]'
			onMouseDown={onClose}
		>
			<div className='absolute inset-0 bg-[rgba(0,0,10,0.65)] backdrop-blur-[6px]' />

			<div
				className='relative z-10 w-full max-w-[360px] border border-[rgba(68,170,255,0.18)] rounded-[24px] px-[28px] py-[32px] bg-[rgba(3,6,25,0.94)] backdrop-blur-[16px]'
				style={{ boxShadow: `0 0 50px ${accent}1a, 0 8px 32px rgba(0,0,0,0.55)` }}
				onMouseDown={e => e.stopPropagation()}
			>
				<button
					onClick={onClose}
					aria-label='Закрити'
					className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center text-[#44aaff] border border-[rgba(68,170,255,0.35)] hover:text-white hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer'
				>
					<X size={14} strokeWidth={2} />
				</button>

				<div
					className='w-[36px] h-[3px] rounded-full mb-[18px]'
					style={{ background: accent, boxShadow: `0 0 10px ${accent}88` }}
				/>

				<h3
					className='text-[18px] font-[700] mb-[8px] leading-[1.3] pr-[30px]'
					style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}
				>
					{title}
				</h3>

				{message && (
					<p className='text-[13px] text-[rgba(180,200,255,0.65)] leading-[1.6] mb-[10px]'>
						{message}
					</p>
				)}

				{children && <div className='mb-[22px]'>{children}</div>}

				{!message && !children && <div className='mb-[20px]' />}

				{isConfirm ? (
					<div className='flex gap-[10px]'>
						<button
							onClick={onConfirm}
							className='flex-1 py-[11px] rounded-[10px] text-[13px] font-[600] transition-all cursor-pointer hover:brightness-110'
							style={{
								background: `${accent}22`,
								border: `1px solid ${accent}55`,
								color: accent,
							}}
						>
							{confirmLabel}
						</button>
						<button
							onClick={onClose}
							className='flex-1 py-[11px] rounded-[10px] text-[13px] font-[600] text-[rgba(180,200,255,0.45)] border border-[rgba(180,200,255,0.12)] hover:border-[rgba(180,200,255,0.3)] hover:text-[rgba(180,200,255,0.75)] transition-all cursor-pointer'
						>
							{cancelLabel}
						</button>
					</div>
				) : (
					<button
						onClick={onClose}
						className='w-full py-[11px] rounded-[10px] text-[13px] font-[600] transition-all cursor-pointer hover:brightness-110'
						style={{
							background: `${accent}22`,
							border: `1px solid ${accent}55`,
							color: accent,
						}}
					>
						{closeLabel}
					</button>
				)}
			</div>
		</div>,
		document.body
	)
}
