import React, { useState } from 'react'
import { ModalClose } from './ModalClose'
import { ArrowRight, Landmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RoomPlayer } from './types'
import { NumberField } from '../minicomponents/NumberField'

interface Props {
	me: RoomPlayer
	players: RoomPlayer[]
	onTransfer: (toUserId: string, amount: number) => void
	onPayBank: (amount: number) => void
	onClose: () => void
}

export const CoinModal = ({ me, players, onTransfer, onPayBank, onClose }: Props) => {
	const { t } = useTranslation()
	const [tab, setTab]         = useState<'player' | 'bank'>('player')
	const [toUserId, setTo]     = useState('')
	// null while the field is empty — the transfer button waits for a number
	const [amountInput, setAmount] = useState<number | null>(1)
	const amount = amountInput ?? 0
	const [confirm, setConfirm] = useState(false)

	const others = players.filter(p => p.userId !== me.userId && !p.isGamemaster)
	const toPlayer = others.find(p => p.userId === toUserId)

	const handleConfirm = () => {
		if (amount <= 0 || amount > me.coins) return
		if (tab === 'player') {
			if (!toUserId) return
			onTransfer(toUserId, amount)
		} else {
			onPayBank(amount)
		}
		onClose()
	}

	return (
		<div className='room-modal-overlay z-[80]' onClick={onClose}>
			<div
				className='w-[340px] max-w-full rounded-[18px] p-[24px] flex flex-col gap-[16px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
				onClick={e => e.stopPropagation()}
				onKeyDown={e => { if (e.key === 'Escape') onClose() }}
			>
				<div className='flex items-center justify-between'>
					<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>
						{t('room.coin.title')}
					</h3>
					<div className='flex items-center gap-[10px]'>
						<span className='text-[13px] font-[600]' style={{ color: '#0fffc8' }}>
							🪙 {me.coins} {t('room.coin.you_have')}
						</span>
						<ModalClose onClose={onClose} className='' />
					</div>
				</div>

				{/* Tabs */}
				<div className='flex gap-[6px]'>
					{(['player', 'bank'] as const).map(tb => (
						<button key={tb} onClick={() => setTab(tb)}
							className='flex-1 py-[7px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all'
							style={{
								background: tab === tb ? 'rgba(15,255,200,0.1)' : 'rgba(15,17,32,0.5)',
								border: tab === tb ? '1px solid rgba(15,255,200,0.3)' : '1px solid rgba(68,170,255,0.12)',
								color: tab === tb ? '#0fffc8' : 'rgba(100,140,220,0.5)',
							}}>
							{tb === 'player' ? t('room.coin.to_player') : t('room.coin.to_bank')}
						</button>
					))}
				</div>

				{/* Alone with the GM: nobody to give to — say so instead of an empty list */}
				{tab === 'player' && others.length === 0 && (
					<p className='text-[12px] leading-[1.45]' style={{ color: 'rgba(160,175,220,0.75)' }}>{t('room.coin.no_others')}</p>
				)}
				{tab === 'player' && others.length > 0 && (
					<select
						value={toUserId}
						onChange={e => setTo(e.target.value)}
						className='w-full rounded-[8px] px-[10px] py-[8px] text-[13px] appearance-none focus:outline-none'
						style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.85)' }}
					>
						<option value=''>{t('room.coin.select_player')}</option>
						{others.map(p => (
							<option key={p.userId} value={p.userId} style={{ background: '#060e24' }}>
								{p.name}{p.role ? ` (${p.role})` : ''}
							</option>
						))}
					</select>
				)}

				<div className='flex items-center gap-[8px]'>
					<span className='text-[12px]' style={{ color: 'rgba(100,140,220,0.5)' }}>{t('room.coin.amount_label')}</span>
					<NumberField
						value={amountInput}
						onChange={setAmount}
						max={me.coins}
						placeholder='0'
						className='flex-1 rounded-[8px] px-[10px] py-[7px] text-[14px] font-[600] text-center focus:outline-none'
						style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
					/>
					<span className='text-[12px]' style={{ color: 'rgba(100,140,220,0.5)' }}>🪙</span>
				</div>

				{/* Confirm row */}
				{!confirm ? (
					<button
						onClick={() => setConfirm(true)}
						disabled={amount <= 0 || amount > me.coins || (tab === 'player' && !toUserId)}
						className='w-full py-[10px] rounded-[10px] text-[13px] font-[600] cursor-pointer transition-all disabled:opacity-40'
						style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}
					>
						{t('room.coin.transfer_btn')} {amount} 🪙 {tab === 'bank' ? 'в банк' : `→ ${toPlayer?.name ?? ''}`}
					</button>
				) : (
					<div className='flex flex-col gap-[8px]'>
						<p className='text-[12px] text-center' style={{ color: 'rgba(255,183,40,0.8)' }}>
							{t('room.coin.confirm_msg')} {amount} 🪙?
						</p>
						<div className='flex gap-[8px]'>
							<button onClick={() => setConfirm(false)}
								className='flex-1 py-[8px] rounded-[8px] text-[12px] cursor-pointer transition-all'
								style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.15)', color: 'rgba(100,140,220,0.6)' }}>
								{t('room.coin.cancel')}
							</button>
							<button onClick={handleConfirm}
								className='flex-1 py-[8px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all flex items-center justify-center gap-[5px]'
								style={{ background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.35)', color: '#0fffc8' }}>
								<ArrowRight size={13} /> {t('room.coin.confirm')}
							</button>
						</div>
					</div>
				)}

				<button onClick={onClose}
					className='w-full py-[9px] rounded-[9px] text-[12px] cursor-pointer transition-all'
					style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.15)', color: 'rgba(150,175,230,0.8)' }}>
					{t('room.coin.close')}
				</button>
			</div>
		</div>
	)
}
