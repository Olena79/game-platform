import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

interface TelegramStatusIconProps {
	size?: number
}

export const TelegramStatusIcon = ({ size = 38 }: TelegramStatusIconProps) => {
	const { user } = useAuth()
	const { isDark } = useTheme()
	const [showTooltip, setShowTooltip] = useState(false)

	if (!user) return null

	const isConnected = user.telegramConnected ?? false
	const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'gamesofsenses_bot'
	const deepLink = `https://t.me/${telegramBotUsername}?start=${user.id}`

	const handleClick = () => {
		if (!isConnected) {
			window.open(deepLink, '_blank')
		}
	}

	return (
		<div
			className='relative'
			onMouseEnter={() => setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<button
				onClick={handleClick}
				disabled={isConnected}
				className='flex items-center justify-center transition-all duration-[250ms] cursor-pointer'
				style={{
					width: `${size}px`,
					height: `${size}px`,
					opacity: isConnected ? 1 : 0.7,
				}}
				title={isConnected ? 'Telegram підключено' : 'Підключити Telegram'}
			>
				<svg
					viewBox='0 0 38 38'
					fill='none'
					xmlns='http://www.w3.org/2000/svg'
					width={size}
					height={size}
				>
					<defs>
						<linearGradient id='tg-gradient' x1='5' y1='10' x2='33' y2='33'>
							<stop offset='0%' stopColor={isConnected ? (isDark ? '#00e5ff' : '#c0533a') : (isDark ? 'rgba(0,229,255,0.4)' : 'rgba(192,83,58,0.4)')} />
							<stop offset='100%' stopColor={isConnected ? (isDark ? '#0099ff' : '#9b3a25') : (isDark ? 'rgba(0,153,255,0.4)' : 'rgba(155,58,37,0.4)')} />
						</linearGradient>
						{isDark && isConnected && (
							<filter id='tg-glow'>
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
					<g filter={isDark && isConnected ? 'url(#tg-glow)' : undefined}>
						<circle cx='19' cy='19' r='16' stroke='url(#tg-gradient)' strokeWidth='1.5' />

						{/* Paper plane shape */}
						<path
							d='M13 19L25 13L18 25'
							stroke='url(#tg-gradient)'
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
								<line x1='25' y1='25' x2='31' y2='31' stroke='url(#tg-gradient)' strokeWidth='1.5' strokeLinecap='round' />
								<line x1='31' y1='25' x2='25' y2='31' stroke='url(#tg-gradient)' strokeWidth='1.5' strokeLinecap='round' />
							</>
						)}
					</g>
				</svg>
			</button>

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
					{isConnected
						? '✓ Telegram підключено'
						: '◯ Клацніть для підключення'}
				</div>
			)}
		</div>
	)
}
