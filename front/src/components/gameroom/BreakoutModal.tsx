import React, { useState } from 'react'
import { Plus, Send, X } from 'lucide-react'
import type { BreakoutRoom, RoomPlayer } from './types'

interface Props {
	breakoutRooms: BreakoutRoom[]
	players: RoomPlayer[]
	images: string[]
	myId: string
	inBreakout: string | null
	onCreate: (name: string, imageUrl: string, timerSeconds: number | null) => void
	onInvite: (roomId: string, playerIds: string[]) => void
	onJoin: (roomId: string) => void
	onEnd: (roomId: string) => void
	onClose: () => void
}

export const BreakoutModal = ({
	breakoutRooms, players, images, myId, inBreakout,
	onCreate, onInvite, onJoin, onEnd, onClose,
}: Props) => {
	const [tab, setTab]             = useState<'rooms' | 'create'>('rooms')
	const [name, setName]           = useState('')
	const [imageUrl, setImageUrl]   = useState(images[0] ?? '')
	const [useTmer, setUseTimer]    = useState(false)
	const [minutes, setMinutes]     = useState(10)
	const [inviteMap, setInviteMap] = useState<Record<string, string[]>>({})

	const nonGMPlayers = players.filter(p => !p.isGamemaster)

	const handleCreate = () => {
		if (!name.trim()) return
		onCreate(name.trim(), imageUrl, useTmer ? minutes * 60 : null)
		setName(''); setTab('rooms')
	}

	const toggleInvite = (roomId: string, userId: string) => {
		setInviteMap(prev => {
			const list = prev[roomId] ?? []
			return {
				...prev,
				[roomId]: list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId],
			}
		})
	}

	const sendInvites = (roomId: string) => {
		const ids = inviteMap[roomId] ?? []
		if (!ids.length) return
		onInvite(roomId, ids)
		setInviteMap(prev => ({ ...prev, [roomId]: [] }))
	}

	const tabStyle = (active: boolean) => ({
		background: active ? 'rgba(15,255,200,0.1)' : 'transparent',
		border: active ? '1px solid rgba(15,255,200,0.25)' : '1px solid transparent',
		color: active ? '#0fffc8' : 'rgba(100,140,220,0.5)',
	})

	return (
		<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.75)' }}>
			<div
				className='w-[400px] max-h-[90vh] overflow-y-auto rounded-[18px] p-[22px] flex flex-col gap-[14px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
			>
				<div className='flex items-center justify-between'>
					<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>
						🚪 Кімнати
					</h3>
					<button onClick={onClose} className='cursor-pointer' style={{ color: 'rgba(100,140,220,0.4)' }}>
						<X size={16} strokeWidth={2} />
					</button>
				</div>

				<div className='flex gap-[6px]'>
					{(['rooms', 'create'] as const).map(t => (
						<button key={t} onClick={() => setTab(t)}
							className='flex-1 py-[6px] rounded-[7px] text-[11px] font-[600] cursor-pointer transition-all'
							style={tabStyle(tab === t)}>
							{t === 'rooms' ? `Кімнати (${breakoutRooms.length}/5)` : '+ Нова'}
						</button>
					))}
				</div>

				{tab === 'create' && (
					<div className='flex flex-col gap-[10px]'>
						<input
							placeholder='Назва кімнати...'
							value={name}
							onChange={e => setName(e.target.value.slice(0, 50))}
							className='w-full rounded-[8px] px-[10px] py-[8px] text-[13px] focus:outline-none'
							style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
						/>
						{images.length > 0 && (
							<div>
								<p className='text-[11px] mb-[6px]' style={{ color: 'rgba(100,140,220,0.45)' }}>Картинка:</p>
								<div className='flex gap-[5px] flex-wrap'>
									{images.map((url, i) => (
										<button key={i} onClick={() => setImageUrl(url)}
											className='w-[48px] h-[32px] rounded-[6px] overflow-hidden cursor-pointer'
											style={{ border: url === imageUrl ? '2px solid #0fffc8' : '2px solid rgba(255,255,255,0.1)' }}>
											<img src={url} alt='' className='w-full h-full object-cover' />
										</button>
									))}
								</div>
							</div>
						)}
						<label className='flex items-center gap-[8px] cursor-pointer text-[12px]' style={{ color: 'rgba(180,200,255,0.6)' }}>
							<input type='checkbox' checked={useTmer} onChange={e => setUseTimer(e.target.checked)} className='accent-[#0fffc8]' />
							Авто-повернення через
							{useTmer && (
								<input type='number' min={1} max={120} value={minutes}
									onChange={e => setMinutes(Math.max(1, Number(e.target.value)))}
									className='w-[50px] text-center rounded-[6px] px-[4px] py-[3px] text-[12px] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none'
									style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.85)' }}
								/>
							)}
							{useTmer && <span>хв</span>}
						</label>
						<button onClick={handleCreate} disabled={!name.trim() || breakoutRooms.length >= 5}
							className='py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer transition-all disabled:opacity-40 flex items-center justify-center gap-[6px]'
							style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
							<Plus size={13} /> Створити кімнату
						</button>
					</div>
				)}

				{tab === 'rooms' && (
					<div className='flex flex-col gap-[10px]'>
						{breakoutRooms.length === 0 && (
							<p className='text-[12px] text-center py-[20px]' style={{ color: 'rgba(100,140,220,0.35)' }}>
								Немає активних кімнат
							</p>
						)}
						{breakoutRooms.map(br => (
							<div key={br.id} className='rounded-[10px] p-[12px] flex flex-col gap-[8px]'
								style={{ background: '#0f1120', border: '1px solid #1c1f35' }}>
								<div className='flex items-center justify-between'>
									<div className='flex items-center gap-[7px]'>
										<span className='text-[13px] font-[600]' style={{ color: 'rgba(220,230,255,0.85)' }}>{br.name}</span>
										{inBreakout === br.id && (
											<span className='text-[9px] px-[5px] py-[1px] rounded-[4px]'
												style={{ background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
												● Ви тут
											</span>
										)}
									</div>
									<div className='flex items-center gap-[6px]'>
										<span className='text-[11px]' style={{ color: 'rgba(100,140,220,0.45)' }}>
											{br.playerIds.length} гравців
										</span>
										{inBreakout !== br.id && (
											<button onClick={() => { onJoin(br.id); onClose() }}
												className='text-[10px] px-[7px] py-[3px] rounded-[5px] cursor-pointer transition-all'
												style={{ background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.25)', color: 'rgba(15,255,200,0.85)' }}>
												Увійти →
											</button>
										)}
										<button onClick={() => onEnd(br.id)}
											className='text-[10px] px-[7px] py-[3px] rounded-[5px] cursor-pointer'
											style={{ background: 'rgba(255,95,160,0.08)', border: '1px solid rgba(255,95,160,0.2)', color: 'rgba(255,95,160,0.7)' }}>
											Завершити
										</button>
									</div>
								</div>
								{/* Select players to invite */}
								<div className='flex flex-wrap gap-[5px]'>
									{nonGMPlayers.map(p => {
										const inRoom = br.playerIds.includes(p.userId)
										const selected = (inviteMap[br.id] ?? []).includes(p.userId)
										if (inRoom) return (
											<span key={p.userId} className='text-[10px] px-[7px] py-[2px] rounded-[5px]'
												style={{ background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.2)', color: 'rgba(15,255,200,0.65)' }}>
												{p.name.split(' ')[0]} ✓
											</span>
										)
										return (
											<button key={p.userId} onClick={() => toggleInvite(br.id, p.userId)}
												className='text-[10px] px-[7px] py-[2px] rounded-[5px] cursor-pointer transition-all'
												style={{
													background: selected ? 'rgba(68,170,255,0.1)' : 'rgba(15,17,32,0.5)',
													border: selected ? '1px solid rgba(68,170,255,0.35)' : '1px solid rgba(68,170,255,0.12)',
													color: selected ? 'rgba(68,170,255,0.9)' : 'rgba(100,140,220,0.5)',
												}}>
												{p.name.split(' ')[0]}
											</button>
										)
									})}
								</div>
								{(inviteMap[br.id]?.length ?? 0) > 0 && (
									<button onClick={() => sendInvites(br.id)}
										className='self-end flex items-center gap-[5px] text-[11px] px-[10px] py-[5px] rounded-[7px] cursor-pointer transition-all'
										style={{ background: 'rgba(68,170,255,0.08)', border: '1px solid rgba(68,170,255,0.25)', color: 'rgba(68,170,255,0.8)' }}>
										<Send size={11} /> Запросити
									</button>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
