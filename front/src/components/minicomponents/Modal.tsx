import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

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

const ACCENT_DARK: Record<string, string> = {
	success: '#0fffc8',
	error:   '#ff5fa0',
	warn:    '#ffb340',
	default: '#44aaff',
}

const ACCENT_LIGHT: Record<string, string> = {
	success: '#2a7a4a',
	error:   '#c0533a',
	warn:    '#c08030',
	default: '#c0533a',
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
	const { isDark } = useTheme()

	useEffect(() => {
		if (!isOpen) return
		const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [isOpen, onClose])

	if (!isOpen) return null

	const accent = isDark ? ACCENT_DARK[variant] : ACCENT_LIGHT[variant]
	const isConfirm = !!onConfirm

	return createPortal(
		<div
			className='fixed inset-0 z-[500] flex items-center justify-center px-[20px]'
			onMouseDown={onClose}
		>
			<div
				className='absolute inset-0 backdrop-blur-[6px]'
				style={{ background: isDark ? 'rgba(0,0,10,0.65)' : 'rgba(0,0,0,0.45)' }}
			/>

			<div
				className='relative z-10 w-full max-w-[360px] rounded-[24px] px-[28px] py-[32px] backdrop-blur-[16px]'
				style={{
					background: isDark ? 'rgba(3,6,25,0.94)' : 'var(--bg-card)',
					border: `1px solid ${isDark ? 'rgba(68,170,255,0.18)' : 'var(--border-subtle)'}`,
					boxShadow: isDark
						? `0 0 50px ${accent}1a, 0 8px 32px rgba(0,0,0,0.55)`
						: '0 4px 24px rgba(0,0,0,0.10), 0 8px 32px rgba(0,0,0,0.06)',
				}}
				onMouseDown={e => e.stopPropagation()}
			>
				<button
					onClick={onClose}
					aria-label='Закрити'
					className='absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all cursor-pointer hover:bg-[rgba(128,128,128,0.12)]'
					style={{
						color: isDark ? '#44aaff' : 'var(--text-muted)',
						border: `1px solid ${isDark ? 'rgba(68,170,255,0.35)' : 'var(--border-medium)'}`,
					}}
				>
					<X size={14} strokeWidth={2} />
				</button>

				<div
					className='w-[36px] h-[3px] rounded-full mb-[18px]'
					style={{
						background: accent,
						boxShadow: isDark ? `0 0 10px ${accent}88` : 'none',
					}}
				/>

				<h3
					className='text-[18px] font-[700] mb-[8px] leading-[1.3] pr-[30px]'
					style={{
						color: accent,
						textShadow: isDark ? `0 0 18px ${accent}55` : 'none',
					}}
				>
					{title}
				</h3>

				{message && (
					<p
						className='text-[14px] leading-[1.65] mb-[10px]'
						style={{ color: isDark ? 'rgba(210,225,255,0.9)' : 'var(--text-secondary)' }}
					>
						{message}
					</p>
				)}

				{children && <div className='mb-[22px]'>{children}</div>}

				{!message && !children && <div className='mb-[20px]' />}

				{isConfirm ? (
					<div className='flex gap-[10px]'>
						<button
							onClick={onConfirm}
							className='flex-1 py-[12px] rounded-[10px] text-[14px] font-[600] transition-all cursor-pointer hover:brightness-110'
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
							className='flex-1 py-[12px] rounded-[10px] text-[14px] font-[600] transition-all cursor-pointer'
							style={{
								color: isDark ? 'rgba(195,212,255,0.78)' : 'var(--text-secondary)',
								border: `1px solid ${isDark ? 'rgba(180,200,255,0.18)' : 'var(--border-subtle)'}`,
							}}
						>
							{cancelLabel}
						</button>
					</div>
				) : (
					<button
						onClick={onClose}
						className='w-full py-[12px] rounded-[10px] text-[14px] font-[600] transition-all cursor-pointer hover:brightness-110'
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
