import { useState } from 'react'
import { ModalClose } from './ModalClose'
import { useTranslation } from 'react-i18next'
import type { RoomPlayer } from './types'
import { NumberField } from '../minicomponents/NumberField'

interface Props {
	bankCoins: number
	players: RoomPlayer[]
	onGive: (toUserId: string, amount: number) => void
	onClose: () => void
}

/**
 * The gamemaster's bank: what players paid in plus what the game started
 * with, handed out to a player during the game.
 */
export const BankModal = ({ bankCoins, players, onGive, onClose }: Props) => {
	const { t } = useTranslation()
	const [toUserId, setTo] = useState('')
	const [amountInput, setAmount] = useState<number | null>(null)
	const amount = amountInput ?? 0

	const recipients = players.filter(p => !p.isGamemaster && !p.isSpectator && p.connected)
	const ready = !!toUserId && amount > 0 && amount <= bankCoins

	const give = () => {
		if (!ready) return
		onGive(toUserId, amount)
		setAmount(null)
	}

	return (
		<div className='room-modal-overlay z-[80]' onClick={onClose}>
			<div
				className='w-[340px] max-w-full rounded-[18px] p-[24px] flex flex-col gap-[16px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(200,168,48,0.25)' }}
				onClick={e => e.stopPropagation()}
				onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); give() } if (e.key === 'Escape') onClose() }}
			>
				<div className='flex items-center justify-between'>
					<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>🏦 {t('room.bank.title')}</h3>
					<div className='flex items-center gap-[10px]'>
						<span className='text-[15px] font-[700]' style={{ color: '#c8a830' }}>{bankCoins}</span>
						<ModalClose onClose={onClose} className='' />
					</div>
				</div>

				{recipients.length === 0 ? (
					<p className='text-[13px]' style={{ color: 'rgba(160,175,220,0.7)' }}>{t('room.bank.no_players')}</p>
				) : (
					<>
						<label className='flex flex-col gap-[6px]'>
							<span className='text-[12px]' style={{ color: 'rgba(160,175,220,0.7)' }}>{t('room.bank.to_player')}</span>
							<select value={toUserId} onChange={e => setTo(e.target.value)}
								className='w-full rounded-[8px] px-[10px] py-[8px] text-[13px] focus:outline-none'
								style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}>
								<option value=''>{t('room.coin.select_player')}</option>
								{recipients.map(p => (
									<option key={p.userId} value={p.userId}>{p.name} · 🪙 {p.coins}</option>
								))}
							</select>
						</label>
						<label className='flex flex-col gap-[6px]'>
							<span className='text-[12px]' style={{ color: 'rgba(160,175,220,0.7)' }}>{t('room.coin.amount_label')}</span>
							<NumberField value={amountInput} onChange={setAmount} max={bankCoins} placeholder='0'
								className='w-full text-center rounded-[8px] px-[6px] py-[8px] text-[18px] font-[700] focus:outline-none'
								style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }} />
						</label>
					</>
				)}

				<div className='flex gap-[8px]'>
					<button onClick={onClose}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
						style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.6)' }}>
						{t('room.coin.close')}
					</button>
					<button onClick={give} disabled={!ready}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[700] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed'
						style={{ background: 'rgba(200,168,48,0.12)', border: '1px solid rgba(200,168,48,0.4)', color: '#e0c050' }}>
						{t('room.bank.give')}
					</button>
				</div>
			</div>
		</div>
	)
}
