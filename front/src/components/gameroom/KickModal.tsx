import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserX } from 'lucide-react'
import { ModalClose } from './ModalClose'
import type { RoomPlayer } from './types'

interface Props {
	/** Everyone who could be removed (the gamemaster is never among them) */
	players: RoomPlayer[]
	/** Opened from a tile: go straight to the warning for this person */
	initialTarget?: RoomPlayer | null
	onKick: (userId: string) => void
	onClose: () => void
}

/**
 * Removing someone from the game for good — a player or a spectator.
 *
 * Irreversible by design: the server writes the ban on the game, so neither
 * code lets them back and they cannot register again. Hence a list first,
 * then a warning that says exactly that, and only then the action.
 */
export const KickModal = ({ players, initialTarget = null, onKick, onClose }: Props) => {
	const { t } = useTranslation()
	const [target, setTarget] = useState<RoomPlayer | null>(initialTarget)

	const people = players
		.filter(p => !p.isGamemaster && p.connected)
		.sort((a, b) => Number(a.isSpectator) - Number(b.isSpectator) || a.name.localeCompare(b.name))

	const confirm = () => {
		if (!target) return
		onKick(target.userId)
		onClose()
	}

	return (
		<div className='room-modal-overlay z-[80]' onClick={onClose}>
			<div
				className='w-[360px] max-w-full rounded-[18px] p-[22px] flex flex-col gap-[14px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(255,56,80,0.3)' }}
				onClick={e => e.stopPropagation()}
				onKeyDown={e => { if (e.key === 'Escape') onClose() }}
				role='dialog' aria-modal='true'
			>
				<div className='flex items-center justify-between gap-[10px]'>
					<h3 className='text-[15px] font-[700] flex items-center gap-[8px]' style={{ color: 'rgba(255,120,140,0.95)' }}>
						<UserX size={16} /> {t('room.kick.title')}
					</h3>
					<ModalClose onClose={onClose} className='' />
				</div>

				{!target ? (
					people.length === 0 ? (
						<p className='text-[13px]' style={{ color: 'rgba(160,175,220,0.7)' }}>{t('room.kick.nobody')}</p>
					) : (
						<>
							<p className='text-[12px] leading-[1.5]' style={{ color: 'rgba(160,175,220,0.75)' }}>{t('room.kick.pick')}</p>
							<ul className='flex flex-col gap-[6px] max-h-[50vh] overflow-y-auto'>
								{people.map(p => (
									<li key={p.userId} className='flex items-center gap-[10px] rounded-[10px] px-[12px] py-[8px]'
										style={{ background: '#0f1120', border: '1px solid #1c1f35' }}>
										<span className='flex-1 min-w-0'>
											<span className='block text-[13px] font-[600] truncate' style={{ color: 'rgba(220,230,255,0.92)' }}>{p.name}</span>
											<span className='block text-[11px]' style={{ color: 'rgba(140,155,200,0.7)' }}>
												{p.isSpectator ? t('room.kick.spectator') : t('room.kick.player')}
											</span>
										</span>
										<button onClick={() => setTarget(p)}
											className='flex-shrink-0 px-[12px] py-[6px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-125'
											style={{ background: 'rgba(255,56,80,0.08)', border: '1px solid rgba(255,56,80,0.35)', color: '#ff5f78' }}>
											{t('room.kick.remove')}
										</button>
									</li>
								))}
							</ul>
						</>
					)
				) : (
					<>
						<p className='text-[14px] leading-[1.55]' style={{ color: 'rgba(220,230,255,0.92)' }}>
							{target.isSpectator
								? t('room.kick.warning_spectator', { name: target.name })
								: t('room.kick.warning_player', { name: target.name })}
						</p>
						<p className='text-[12px] leading-[1.5] rounded-[10px] px-[12px] py-[9px]'
							style={{ background: 'rgba(255,56,80,0.07)', border: '1px solid rgba(255,56,80,0.25)', color: 'rgba(255,170,180,0.9)' }}>
							{t('room.kick.question')}
						</p>
						<div className='flex gap-[8px]'>
							<button onClick={() => initialTarget ? onClose() : setTarget(null)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.18)', color: 'rgba(140,170,230,0.85)' }}>
								{t('room.kick.cancel')}
							</button>
							<button onClick={confirm}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[700] cursor-pointer transition-all hover:brightness-125'
								style={{ background: 'rgba(255,56,80,0.14)', border: '1px solid rgba(255,56,80,0.5)', color: '#ff5f78' }}>
								{t('room.kick.confirm')}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
