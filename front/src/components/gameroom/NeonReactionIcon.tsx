import React from 'react'

interface Props { size?: number }

const glow = (color: string, s = 7) =>
	`drop-shadow(0 0 ${s * 0.4}px ${color}) drop-shadow(0 0 ${s}px ${color}) drop-shadow(0 0 ${s * 2}px ${color})`

/* ── 👍 Like — cyan neon, thumb + rect wrist ── */
export const NeonThumbUp = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#00ffe1', 9), flexShrink: 0 }}>
		<path
			d='M13 28 L13 18 L18 8 C19 7 22 7 22 9 L22 16 L29 16 C31 16 33 18 32 19 L29 28 C29 29 28 30 26 30 L13 30'
			stroke='#00ffe1' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'
		/>
		<rect x='7' y='17' width='6' height='13' rx='2' stroke='#00ffe1' strokeWidth='2.4' />
	</svg>
)

/* ── ❤️ Heart — pink neon ── */
export const NeonHeart = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#ff4daa', 9), flexShrink: 0 }}>
		<path
			d='M20 32 C20 32 6 23 6 14 C6 9 9 6 14 6 C17 6 19 7 20 9 C21 7 23 6 26 6 C31 6 34 9 34 14 C34 23 20 32 20 32 Z'
			stroke='#ff4daa' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'
		/>
	</svg>
)

/* ── 🔥 Fire — orange neon ── */
export const NeonFire = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#ff6a15', 9), flexShrink: 0 }}>
		<path
			d='M20 34
			C13 34 8 28 8 21
			C8 16 12 13 14 10
			C14 13 16 15 17 15
			C16 11 19 6 23 4
			C21 9 24 12 25 13
			C26 11 26 9 28 8
			C29 12 29 17 28 21
			C29 19 30 18 30 15
			C33 19 32 26 29 29
			C27 31 24 34 20 34 Z'
			stroke='#ff6a15' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'
		/>
	</svg>
)

/* ── 😂 Laugh — yellow neon ring, arched brows, big smile ── */
export const NeonLaugh = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#ffe14d'), flexShrink: 0 }}>
		<circle cx='20' cy='20' r='16' stroke='#ffe14d' strokeWidth='2.4' />
		<path d='M11 13 C13 10 15 10 18 11' stroke='#ffe14d' strokeWidth='2.2' strokeLinecap='round' />
		<path d='M24 11 C25 10 27 10 30 13' stroke='#ffe14d' strokeWidth='2.2' strokeLinecap='round' />
		<circle cx='14' cy='18' r='2' fill='#ffe14d' />
		<circle cx='26' cy='18' r='2' fill='#ffe14d' />
		<path d='M11 25 C13 31 27 31 30 25' stroke='#ffe14d' strokeWidth='2.2' strokeLinecap='round' />
	</svg>
)

/* ── 😢 Sad — blue neon ring, droopy brows, frown ── */
export const NeonSad = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#4db8ff'), flexShrink: 0 }}>
		<circle cx='20' cy='20' r='16' stroke='#4db8ff' strokeWidth='2.4' />
		<path d='M11 11 C13 14 15 14 18 11' stroke='#4db8ff' strokeWidth='2.2' strokeLinecap='round' />
		<path d='M24 11 C25 14 27 14 30 11' stroke='#4db8ff' strokeWidth='2.2' strokeLinecap='round' />
		<circle cx='14' cy='18' r='2' fill='#4db8ff' />
		<circle cx='26' cy='18' r='2' fill='#4db8ff' />
		<path d='M13 27 C15 25 25 25 27 27' stroke='#4db8ff' strokeWidth='2.2' strokeLinecap='round' />
	</svg>
)

/* ── 😡 Angry — red neon ring, angled brows, frown ── */
export const NeonAngry = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#ff3d3d'), flexShrink: 0 }}>
		<circle cx='20' cy='20' r='16' stroke='#ff3d3d' strokeWidth='2.4' />
		<path d='M10 11 C13 15 16 14 18 13' stroke='#ff3d3d' strokeWidth='2.4' strokeLinecap='round' />
		<path d='M30 11 C27 15 24 14 23 13' stroke='#ff3d3d' strokeWidth='2.4' strokeLinecap='round' />
		<circle cx='14' cy='18' r='2' fill='#ff3d3d' />
		<circle cx='26' cy='18' r='2' fill='#ff3d3d' />
		<path d='M13 27 C15 25 25 25 27 27' stroke='#ff3d3d' strokeWidth='2.4' strokeLinecap='round' />
	</svg>
)

/* ── 🤔 Think — purple neon ring, asymmetric brows ── */
export const NeonThink = ({ size = 36 }: Props) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow('#b44dff'), flexShrink: 0 }}>
		<circle cx='20' cy='19' r='16' stroke='#b44dff' strokeWidth='2.4' />
		<path d='M11 12 C13 9 15 9 18 10' stroke='#b44dff' strokeWidth='2.2' strokeLinecap='round' />
		<path d='M24 13 C25 13 27 13 30 13' stroke='#b44dff' strokeWidth='2.2' strokeLinecap='round' />
		<circle cx='14' cy='15' r='2' fill='#b44dff' />
		<circle cx='26' cy='17' r='1.6' fill='#b44dff' />
		<path d='M14 25 C16 24 23 25 26 26' stroke='#b44dff' strokeWidth='2.2' strokeLinecap='round' />
	</svg>
)

/* ── ✋ Raise Hand — bright yellow neon pencil, clear 5-finger silhouette ── */
export const NeonRaiseHand = ({ size = 36, active = false }: Props & { active?: boolean }) => {
	const color = active ? '#ffee00' : '#f0c040'
	return (
		<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
			style={{
				filter: glow(color, active ? 12 : 7),
				flexShrink: 0,
				transform: active ? 'translateY(-3px)' : 'none',
				transition: 'transform 0.18s ease, filter 0.18s ease',
			}}>
			<path
				d='M17 37
				C14 37 10 34 10 32
				Q7 31 5 29
				Q3 27 5 25
				Q7 22 10 27
				L10 22
				Q10 14 13 9
				Q15 7 16 14
				Q16 18 17 18
				Q17 12 19 5
				Q21 4 22 13
				Q22 18 23 18
				Q23 12 25 8
				Q27 7 28 14
				Q28 18 29 18
				Q29 14 30 13
				Q32 13 32 18
				C32 26 24 37 23 37
				L17 37 Z'
				stroke={color}
				strokeWidth='2.5'
				strokeLinejoin='round'
				strokeLinecap='round'
				fill={active ? 'rgba(255,238,0,0.32)' : 'none'}
			/>
		</svg>
	)
}

export const NEON_ICONS: Record<string, React.ComponentType<Props>> = {
	'👍': NeonThumbUp,
	'❤️': NeonHeart,
	'😂': NeonLaugh,
	'🔥': NeonFire,
	'🤔': NeonThink,
	'😢': NeonSad,
	'😡': NeonAngry,
}
