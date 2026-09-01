import React from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface RegistrationSuccessModalProps {
	isOpen: boolean
	telegramBotUsername: string
	userId: string
	onClose: () => void
}

export const RegistrationSuccessModal = ({
	isOpen,
	telegramBotUsername,
	userId,
	onClose,
}: RegistrationSuccessModalProps) => {
	const { t } = useTranslation()
	const { isDark } = useTheme()

	if (!isOpen) return null

	const telegramDeepLink = `https://t.me/${telegramBotUsername}?start=${userId}`

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center px-4'
			style={{ background: 'rgba(0, 0, 0, 0.5)' }}
			onClick={onClose}
		>
			<div
				className='relative rounded-[16px] p-[24px] md:p-[32px] max-w-[420px] w-full'
				style={isDark
					? { border: '1px solid rgba(68,170,255,0.18)', background: 'rgba(3,6,25,0.9)' }
					: { border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }
				}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={onClose}
					aria-label='Close'
					className='absolute top-[12px] right-[12px] w-[24px] h-[24px] rounded-full flex items-center justify-center transition-all'
					style={isDark
						? { color: '#44aaff', border: '1px solid rgba(68,170,255,0.35)' }
						: { color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
					}
				>
					<X size={14} strokeWidth={2} />
				</button>

				{/* Title */}
				<h2
					className='text-[20px] font-[600] mb-[12px]'
					style={{ color: isDark ? '#44aaff' : 'var(--text)' }}
				>
					{t('auth.modal_success_register_title')}
				</h2>

				{/* Success message */}
				<p
					className='text-[14px] mb-[24px] leading-[1.5]'
					style={{ color: isDark ? 'rgba(180,200,255,0.8)' : 'var(--text-muted)' }}
				>
					{t('auth.modal_success_register_msg')}
				</p>

				{/* Telegram section */}
				<div
					className='rounded-[12px] p-[16px] mb-[24px] border-l-4'
					style={isDark
						? { background: 'rgba(68,170,255,0.08)', borderColor: '#44aaff', borderLeftColor: '#44aaff' }
						: { background: 'rgba(195,84,54,0.05)', borderColor: 'var(--border-subtle)', borderLeftColor: '#c35436' }
					}
				>
					<p
						className='text-[13px] font-[500] mb-[8px]'
						style={{ color: isDark ? '#44aaff' : '#c35436' }}
					>
						💬 {t('auth.telegram_section_title', 'Telegram для кодов игр')}
					</p>
					<p
						className='text-[12px] leading-[1.5]'
						style={{ color: isDark ? 'rgba(180,200,255,0.7)' : 'var(--text-muted)' }}
					>
						{t('auth.telegram_section_desc', 'Подключите Telegram, чтобы получать коды игр прямо в сообщениях. Это удобнее и надежнее.')}
					</p>
				</div>

				{/* Buttons */}
				<div className='flex flex-col gap-[10px]'>
					{/* Telegram Button */}
					<a
						href={telegramDeepLink}
						target='_blank'
						rel='noopener noreferrer'
						className='w-full py-[10px] px-[16px] rounded-[8px] font-[500] text-[14px] text-center transition-all cursor-pointer'
						style={isDark
							? {
								background: 'linear-gradient(135deg, rgba(68,170,255,0.2) 0%, rgba(100,180,255,0.1) 100%)',
								border: '1px solid rgba(68,170,255,0.35)',
								color: '#44aaff',
							}
							: {
								background: 'linear-gradient(135deg, rgba(68,170,255,0.12) 0%, rgba(100,180,255,0.08) 100%)',
								border: '1px solid #44aaff',
								color: '#44aaff',
							}
						}
					>
						{t('auth.btn_telegram_register', 'Зарегистрироваться в Telegram')}
					</a>

					{/* Close Button */}
					<button
						onClick={onClose}
						className='w-full py-[10px] px-[16px] rounded-[8px] font-[500] text-[14px] transition-all cursor-pointer'
						style={isDark
							? {
								background: 'rgba(255,255,255,0.08)',
								border: '1px solid rgba(68,170,255,0.12)',
								color: 'rgba(180,200,255,0.9)',
							}
							: {
								background: 'var(--bg-hover)',
								border: '1px solid var(--border-subtle)',
								color: 'var(--text-muted)',
							}
						}
					>
						{t('auth.btn_skip', 'Позже')}
					</button>
				</div>
			</div>
		</div>
	)
}
