import React, { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

interface TelegramStatusIconProps {
	size?: number
}

export const TelegramStatusIcon = ({ size = 38 }: TelegramStatusIconProps) => {
	const { t } = useTranslation()
	const { user } = useAuth()
	const { isDark } = useTheme()
	const [showTooltip, setShowTooltip] = useState(false)

	// Header renders this component twice (desktop + mobile blocks). Shared <defs>
	// ids would collide and the gradient would resolve to the hidden instance,
	// leaving the icon unpainted — so every instance gets its own id suffix.
	const uid = useId().replace(/:/g, '')
	const gradientId = `tg-gradient-${uid}`
	const glowId = `tg-glow-${uid}`

	if (!user) return null

	const isConnected = user.telegramConnected ?? false
	const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'gamesofsenses_bot'
	// Not linked yet → deep link carrying the user id so /start can bind the chat.
	// Already linked → plain chat link, just open the conversation.
	const botLink = isConnected
		? `https://t.me/${telegramBotUsername}`
		: `https://t.me/${telegramBotUsername}?start=${user.id}`

	const label = isConnected ? t('auth.telegram_open_bot') : t('auth.telegram_connect_label')

	return (
		<div
			className='relative'
			onMouseEnter={() => setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<a
				href={botLink}
				target='_blank'
				rel='noopener noreferrer'
				aria-label={label}
				title={label}
				className='flex items-center justify-center transition-all duration-[250ms] hover:scale-[1.08] cursor-pointer'
				style={{ width: `${size}px`, height: `${size}px`, opacity: isConnected ? 1 : 0.7 }}
			>
				<svg
					viewBox='0 0 38 38'
					fill='none'
					xmlns='http://www.w3.org/2000/svg'
					width={size}
					height={size}
				>
					<defs>
						<linearGradient id={gradientId} x1='5' y1='10' x2='33' y2='33'>
							<stop offset='0%' stopColor={isConnected ? (isDark ? '#00e5ff' : '#c0533a') : (isDark ? 'rgba(0,229,255,0.4)' : 'rgba(192,83,58,0.4)')} />
							<stop offset='100%' stopColor={isConnected ? (isDark ? '#0099ff' : '#9b3a25') : (isDark ? 'rgba(0,153,255,0.4)' : 'rgba(155,58,37,0.4)')} />
						</linearGradient>
						{isDark && isConnected && (
							<filter id={glowId}>
								<feGaussianBlur in='SourceGraphic' stdDeviation='2' result='g1' />
								<feGaussianBlur in='SourceGraphic' stdDeviation='0.8' result='g2' />
								<feMerge>
									<feMergeNode in='g1' />
									<feMergeNode in='g2' />
									<feMergeNode in='SourceGraphic' />
								</feMerge>
							</filter>
						)}
					</defs>

					{/* Telegram paper plane icon */}
					<g filter={isDark && isConnected ? `url(#${glowId})` : undefined}>
						<circle cx='19' cy='19' r='16' stroke={`url(#${gradientId})`} strokeWidth='1.5' />

						{/* Paper plane shape */}
						<path
							d='M13 19L25 13L18 25'
							stroke={`url(#${gradientId})`}
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						/>

						{/* Status indicator */}
						{isConnected && (
							<circle
								cx='29'
								cy='28'
								r='3.5'
								fill={isDark ? '#00ff66' : '#00cc44'}
								filter={isDark ? 'drop-shadow(0 0 4px rgba(0,255,102,0.6))' : undefined}
							>
								<animate attributeName='r' values='3.5;4.5;3.5' dur='2s' repeatCount='indefinite' />
							</circle>
						)}

						{/* X for disconnected */}
						{!isConnected && (
							<>
								<line x1='25' y1='25' x2='31' y2='31' stroke={`url(#${gradientId})`} strokeWidth='1.5' strokeLinecap='round' />
								<line x1='31' y1='25' x2='25' y2='31' stroke={`url(#${gradientId})`} strokeWidth='1.5' strokeLinecap='round' />
							</>
						)}
					</g>
				</svg>
			</a>

			{/* Tooltip */}
			{showTooltip && (
				<div
					className='absolute top-[calc(100%+8px)] right-0 px-[10px] py-[6px] rounded-[6px] text-[11px] font-[500] whitespace-nowrap z-[300] pointer-events-none'
					style={{
						background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.75)',
						color: isConnected ? (isDark ? '#00ff66' : '#4caf50') : '#ffb74d',
						border: `1px solid ${isDark ? 'rgba(0,229,255,0.3)' : 'rgba(192,83,58,0.3)'}`,
						boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
					}}
				>
					{isConnected ? `✓ ${t('auth.telegram_connected_label')}` : `◯ ${t('auth.telegram_connect_label')}`}
				</div>
			)}
		</div>
	)
}
