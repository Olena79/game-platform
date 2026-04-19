import React, { useState } from 'react'
import { ArrowRight, Landmark } from 'lucide-react'
import type { RoomPlayer } from './types'

interface Props {
	me: RoomPlayer
	players: RoomPlayer[]
	onTransfer: (toUserId: string, amount: number) => void
	onPayBank: (amount: number) => void
	onClose: () => void
}

export const CoinModal = ({ me, players, onTransfer, onPayBank, onClose }: Props) => {
	const [tab, setTab]         = useState<'player' | 'bank'>('player')
	const [toUserId, setTo]     = useState('')
	const [amount, setAmount]   = useState(1)
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
		<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.75)' }}>
			<div
				className='w-[340px] rounded-[18px] p-[24px] flex flex-col gap-[16px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
			>
				<div className='flex items-center justify-between'>
					<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>
						Монети
					</h3>
					<span className='text-[13px] font-[600]' style={{ color: '#0fffc8' }}>
						🪙 {me.coins} у вас
					</span>
				</div>

				{/* Tabs */}
				<div className='flex gap-[6px]'>
					{(['player', 'bank'] as const).map(t => (
						<button key={t} onClick={() => setTab(t)}
							className='flex-1 py-[7px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all'
							style={{
								background: tab === t ? 'rgba(15,255,200,0.1)' : 'rgba(15,17,32,0.5)',
								border: tab === t ? '1px solid rgba(15,255,200,0.3)' : '1px solid rgba(68,170,255,0.12)',
								color: tab === t ? '#0fffc8' : 'rgba(100,140,220,0.5)',
							}}>
							{t === 'player' ? '→ Гравцю' : '🏦 В банк'}
						</button>
					))}
				</div>

				{tab === 'player' && (
					<select
						value={toUserId}
						onChange={e => setTo(e.target.value)}
						className='w-full rounded-[8px] px-[10px] py-[8px] text-[13px] appearance-none focus:outline-none'
						style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.85)' }}
					>
						<option value=''>— Оберіть гравця —</option>
						{others.map(p => (
							<option key={p.userId} value={p.userId} style={{ background: '#060e24' }}>
								{p.name}{p.role ? ` (${p.role})` : ''}
							</option>
						))}
					</select>
				)}

				<div className='flex items-center gap-[8px]'>
					<span className='text-[12px]' style={{ color: 'rgba(100,140,220,0.5)' }}>Сума:</span>
					<input
						type='number'
						min={1}
						max={me.coins}
						value={amount}
						onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
						className='flex-1 rounded-[8px] px-[10px] py-[7px] text-[14px] font-[600] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
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
						Передати {amount} 🪙 {tab === 'bank' ? 'в банк' : `→ ${toPlayer?.name ?? ''}`}
					</button>
				) : (
					<div className='flex flex-col gap-[8px]'>
						<p className='text-[12px] text-center' style={{ color: 'rgba(255,183,40,0.8)' }}>
							Підтвердити передачу {amount} 🪙?
						</p>
						<div className='flex gap-[8px]'>
							<button onClick={() => setConfirm(false)}
								className='flex-1 py-[8px] rounded-[8px] text-[12px] cursor-pointer transition-all'
								style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.15)', color: 'rgba(100,140,220,0.6)' }}>
								Скасувати
							</button>
							<button onClick={handleConfirm}
								className='flex-1 py-[8px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all flex items-center justify-center gap-[5px]'
								style={{ background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.35)', color: '#0fffc8' }}>
								<ArrowRight size={13} /> Підтвердити
							</button>
						</div>
					</div>
				)}

				<button onClick={onClose}
					className='text-[11px] text-center cursor-pointer transition-colors'
					style={{ color: 'rgba(100,140,220,0.4)' }}>
					Закрити
				</button>
			</div>
		</div>
	)
}
