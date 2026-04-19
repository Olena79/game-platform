import React from 'react'

interface Props { size?: number }

const glow = (color: string, s = 7) =>
	`drop-shadow(0 0 ${s * 0.4}px ${color}) drop-shadow(0 0 ${s}px ${color}) drop-shadow(0 0 ${s * 2}px ${color})`

const Face = ({ color, children, size }: { color: string; children: React.ReactNode; size: number }) => (
	<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
		style={{ filter: glow(color), flexShrink: 0 }}>
		<circle cx='20' cy='20' r='18' fill='#07080f' />
		<circle cx='20' cy='20' r='18' stroke={color} strokeWidth='2.5' />
		{children}
	</svg>
)

/* ── 😂 Laugh — gold ring, white smile ── */
export const NeonLaugh = ({ size = 36 }: Props) => (
	<Face color='#ffcc00' size={size}>
		<path d='M11 17 q3-5 6 0' stroke='#ffcc00' strokeWidth='2.8' strokeLinecap='round' fill='none' />
		<path d='M23 17 q3-5 6 0' stroke='#ffcc00' strokeWidth='2.8' strokeLinecap='round' fill='none' />
		<path d='M11 23 q9 11 18 0' stroke='#fff8a0' strokeWidth='3' strokeLinecap='round' fill='none' />
		<path d='M10 18 Q7 22 8 27' stroke='#fff8a0' strokeWidth='2.2' strokeLinecap='round' fill='none' />
		<path d='M30 18 Q33 22 32 27' stroke='#fff8a0' strokeWidth='2.2' strokeLinecap='round' fill='none' />
	</Face>
)

/* ── 😢 Sad — cyan ring, light-blue tear ── */
export const NeonSad = ({ size = 36 }: Props) => (
	<Face color='#00ccff' size={size}>
		<circle cx='14' cy='18' r='2.5' fill='#00ccff' />
		<circle cx='26' cy='18' r='2.5' fill='#00ccff' />
		<path d='M26 21 L24 27 Q26 30 28 27 Z' stroke='#aaeeff' strokeWidth='1.5' strokeLinejoin='round' fill='#aaeeff' />
		<path d='M12 29 q8-7 16 0' stroke='#aaeeff' strokeWidth='3' strokeLinecap='round' fill='none' />
	</Face>
)

/* ── 😡 Angry — red ring, orange brows ── */
export const NeonAngry = ({ size = 36 }: Props) => (
	<Face color='#ff3300' size={size}>
		<line x1='9'  y1='13' x2='17' y2='18' stroke='#ff7700' strokeWidth='3.2' strokeLinecap='round' />
		<line x1='31' y1='13' x2='23' y2='18' stroke='#ff7700' strokeWidth='3.2' strokeLinecap='round' />
		<circle cx='14' cy='21' r='2.5' fill='#ff3300' />
		<circle cx='26' cy='21' r='2.5' fill='#ff3300' />
		<path d='M12 29 q8-7 16 0' stroke='#ff6644' strokeWidth='3' strokeLinecap='round' fill='none' />
	</Face>
)

/* ── 🤔 Think — purple ring, lavender smirk ── */
export const NeonThink = ({ size = 36 }: Props) => (
	<Face color='#b060ff' size={size}>
		<path d='M9 15 q4-4 8 1' stroke='#d090ff' strokeWidth='2.8' strokeLinecap='round' fill='none' />
		<line x1='23' y1='14' x2='31' y2='14' stroke='#b060ff' strokeWidth='2.8' strokeLinecap='round' />
		<circle cx='14' cy='20' r='2.5' fill='#b060ff' />
		<circle cx='26' cy='20' r='2.5' fill='#b060ff' />
		<path d='M14 28 q6 4 10-1' stroke='#d090ff' strokeWidth='3' strokeLinecap='round' fill='none' />
	</Face>
)

/* ── 👍 Like — blue ring, light-blue thumb ── */
export const NeonThumbUp = ({ size = 36 }: Props) => (
	<Face color='#2299ff' size={size}>
		<path d='M14 24 L14 12 Q14 8 18 8 Q22 8 22 12 L22 24
		         Q22 22 26 22 Q30 22 30 26 L30 30 Q30 34 26 34
		         L14 34 Q10 34 10 30 L10 24 Z'
			stroke='#66ccff' strokeWidth='2.5' strokeLinejoin='round' fill='none' />
	</Face>
)

/* ── ❤️ Heart — pink ring, hot-pink heart ── */
export const NeonHeart = ({ size = 36 }: Props) => (
	<Face color='#ff4488' size={size}>
		<path d='M20 32 C20 32 7 23 7 14 a7 7 0 0 1 13-2 7 7 0 0 1 13 2 c0 9-13 18-13 18z'
			stroke='#ff88bb' strokeWidth='2.5' strokeLinejoin='round' fill='none' />
	</Face>
)

/* ── 🔥 Fire — orange ring, yellow inner flame ── */
export const NeonFire = ({ size = 36 }: Props) => (
	<Face color='#ff6600' size={size}>
		<path d='M20 34 C12 34 10 25 13 18 C14 24 17 24 17 20 C17 15 20 8 20 8 C20 8 23 15 23 20 C23 24 26 24 27 18 C30 25 28 34 20 34z'
			stroke='#ff6600' strokeWidth='2.5' strokeLinejoin='round' fill='none' />
		<path d='M20 30 C17 30 16 25 17.5 22 C18 25 19 25 19.5 23 C20 21 20 18 20 18 C20 18 21.5 21 21 23 C20.5 25 23 24 23 22 C24.5 25 23 30 20 30z'
			stroke='#ffdd00' strokeWidth='2' strokeLinejoin='round' fill='none' />
	</Face>
)

/* ── 👏 Clap — teal ring, white-teal palms ── */
export const NeonClap = ({ size = 36 }: Props) => (
	<Face color='#00ddaa' size={size}>
		<rect x='7' y='14' width='11' height='17' rx='5'
			stroke='#00ffcc' strokeWidth='2.5' fill='none'
			transform='rotate(15 12.5 22.5)' />
		<rect x='22' y='14' width='11' height='17' rx='5'
			stroke='#00ffcc' strokeWidth='2.5' fill='none'
			transform='rotate(-15 27.5 22.5)' />
		<line x1='20' y1='6'  x2='20' y2='10' stroke='#00ffcc' strokeWidth='2.5' strokeLinecap='round' />
		<line x1='15' y1='8'  x2='17' y2='12' stroke='#00ffcc' strokeWidth='2' strokeLinecap='round' />
		<line x1='25' y1='8'  x2='23' y2='12' stroke='#00ffcc' strokeWidth='2' strokeLinecap='round' />
	</Face>
)

/* ── ✋ Raise Hand ── */
export const NeonRaiseHand = ({ size = 36, active = false }: Props & { active?: boolean }) => {
	const ring  = active ? '#f0c040' : '#806810'
	const fill  = active ? '#ffe080' : '#a08020'
	return (
		<svg width={size} height={size} viewBox='0 0 40 40' fill='none'
			style={{ filter: glow(ring, active ? 9 : 4), flexShrink: 0 }}>
			<circle cx='20' cy='20' r='18' fill='#07080f' />
			<circle cx='20' cy='20' r='18' stroke={ring} strokeWidth='2.5' />
			<path d='M12 30 Q12 34 16 34 L24 34 Q28 34 28 30
			         L28 22 Q31 21 31 18 Q31 15 29 15 Q27 15 27 18
			         L27 13 Q27 10 25 10 Q23 10 23 13
			         L23 11 Q23 8 21 8 Q19 8 19 11
			         L19 13 Q19 10 17 10 Q15 10 15 13
			         L15 22 Q13 21 12 22 Z'
				stroke={fill} strokeWidth='2.5' strokeLinejoin='round' fill='none' />
		</svg>
	)
}

export const NEON_ICONS: Record<string, React.ComponentType<Props>> = {
	'👍': NeonThumbUp,
	'❤️': NeonHeart,
	'😂': NeonLaugh,
	'🔥': NeonFire,
	'🤔': NeonThink,
	'👏': NeonClap,
	'😢': NeonSad,
	'😡': NeonAngry,
}
