import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Video, ChevronDown } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/**
 * For gamemasters, where they prepare a game: what recording asks of their
 * device, read calmly before the game rather than discovered during it.
 * The same points are shown once more in the room before the first recording.
 */
export const RecordingInfoCard = () => {
	const { t } = useTranslation()
	const { isDark } = useTheme()
	const [open, setOpen] = useState(false)
	const points = t('recording_info.points', { returnObjects: true }) as Array<{ title: string; text: string }>

	const accent = isDark ? '#0fffc8' : 'var(--accent)'
	const muted = isDark ? 'rgba(160,178,230,0.8)' : 'var(--text-secondary)'

	return (
		<div className='rounded-[14px] p-[16px] flex flex-col gap-[10px]'
			style={isDark
				? { background: 'rgba(15,255,200,0.04)', border: '1px solid rgba(15,255,200,0.18)' }
				: { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
			<div className='flex items-center gap-[8px]'>
				<Video size={15} style={{ color: accent }} />
				<span className='text-[14px] font-[600]'>{t('recording_info.card_title')}</span>
			</div>
			<p className='text-[13px] leading-[1.5]' style={{ color: muted }}>{t('recording_info.lead')}</p>

			{/* The two that matter most, always visible */}
			{Array.isArray(points) && points.slice(0, open ? points.length : 2).map(pt => (
				<div key={pt.title} className='flex flex-col gap-[2px] pl-[10px]' style={{ borderLeft: `2px solid ${isDark ? 'rgba(15,255,200,0.35)' : 'var(--border-medium)'}` }}>
					<span className='text-[13px] font-[600]' style={{ color: accent }}>{pt.title}</span>
					<span className='text-[12px] leading-[1.45]' style={{ color: muted }}>{pt.text}</span>
				</div>
			))}

			<button type='button' onClick={() => setOpen(o => !o)}
				className='self-start flex items-center gap-[4px] text-[12px] font-[600] cursor-pointer hover:underline'
				style={{ color: accent }}>
				{open ? t('recording_info.close') : t('recording_info.card_more')}
				<ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
			</button>
		</div>
	)
}
