import React, { useState, useRef, useEffect } from 'react'
import { Users, Trash2, ChevronDown, ArrowRight, Home } from 'lucide-react'

interface BreakoutRoom { id: string; name: string }

interface Props {
	mockCount: number
	mocksByRoom: Record<string, number>
	breakoutRooms?: BreakoutRoom[]
	onAdd: (n: number, breakoutRoomId?: string | null) => void
	onMoveAll: (breakoutRoomId: string | null) => void
	onClearRoom: (breakoutRoomId: string | null) => void
	onClearAll: () => void
}

const BTN_HOVER = 'rgba(255,140,0,0.08)'
const DEL_HOVER = 'rgba(255,56,80,0.08)'

function Row({
	label, count, roomId, onAdd, onMoveAll, onClearRoom, hasOtherMocks,
}: {
	label: string
	count: number
	roomId: string | null
	onAdd: (n: number, rid: string | null) => void
	onMoveAll: (rid: string | null) => void
	onClearRoom: (rid: string | null) => void
	hasOtherMocks: boolean  // true → show "move all here" arrow
}) {
	return (
		<div className='px-[10px] py-[5px]'>
			{/* Room header */}
			<div className='flex items-center justify-between mb-[4px]'>
				<span className='text-[10px] font-[600] truncate'
					style={{ color: 'rgba(255,190,0,0.65)', maxWidth: '120px' }}>
					{roomId === null ? '🏠 Головна' : `🚪 ${label}`}
					{count > 0 && (
						<span className='ml-[5px] text-[10px]'
							style={{ color: 'rgba(255,210,0,0.85)' }}>({count})</span>
					)}
				</span>
				<div className='flex items-center gap-[3px]'>
					{/* Move all mocks here */}
					{hasOtherMocks && (
						<button
							onClick={() => onMoveAll(roomId)}
							title='Перемістити всіх сюди'
							className='flex items-center gap-[2px] px-[4px] py-[2px] rounded-[4px] cursor-pointer transition-all'
							style={{ color: 'rgba(100,200,255,0.75)', border: '1px solid rgba(68,170,255,0.25)' }}
							onMouseEnter={e => (e.currentTarget.style.background = 'rgba(68,170,255,0.08)')}
							onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
							<ArrowRight size={9} strokeWidth={2.5} />
							<span className='text-[9px]'>всіх</span>
						</button>
					)}
					{/* Clear this room */}
					{count > 0 && (
						<button
							onClick={() => onClearRoom(roomId)}
							title='Прибрати моків з цієї кімнати'
							className='flex items-center px-[4px] py-[2px] rounded-[4px] cursor-pointer transition-all'
							style={{ color: 'rgba(255,80,100,0.7)', border: '1px solid rgba(255,56,80,0.2)' }}
							onMouseEnter={e => (e.currentTarget.style.background = DEL_HOVER)}
							onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
							<Trash2 size={9} strokeWidth={2} />
						</button>
					)}
				</div>
			</div>

			{/* Add buttons row */}
			<div className='flex gap-[4px]'>
				{[1, 5, 10].map(n => (
					<button
						key={n}
						onClick={() => onAdd(n, roomId)}
						className='flex-1 text-center py-[3px] rounded-[5px] text-[11px] cursor-pointer transition-all'
						style={{ color: 'rgba(255,165,0,0.85)', border: '1px solid rgba(255,140,0,0.28)' }}
						onMouseEnter={e => (e.currentTarget.style.background = BTN_HOVER)}
						onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
						+{n}
					</button>
				))}
			</div>
		</div>
	)
}

export function DevToolbar({
	mockCount, mocksByRoom, breakoutRooms = [],
	onAdd, onMoveAll, onClearRoom, onClearAll,
}: Props) {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const handler = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open])

	const mainCount = mocksByRoom.main ?? 0
	const hasOtherMocksForMain = mockCount - mainCount > 0

	return (
		<div ref={rootRef} className='relative flex-shrink-0 flex items-center'>
			{/* Trigger button */}
			<div className='flex items-center rounded-[7px] overflow-hidden'
				style={{ border: '1px solid rgba(255,140,0,0.45)', background: 'rgba(255,140,0,0.07)' }}>

				<button
					onClick={() => onAdd(1, null)}
					className='flex items-center gap-[5px] px-[8px] py-[4px] text-[11px] cursor-pointer transition-all hover:brightness-125'
					style={{ color: 'rgba(255,165,0,0.92)' }}
					title='Додати тестового гравця в головну кімнату'>
					<Users size={11} strokeWidth={2} />
					<span>Тест</span>
					{mockCount > 0 && (
						<span className='px-[4px] rounded-full text-[10px] font-[700]'
							style={{ background: 'rgba(255,140,0,0.22)', color: 'rgba(255,190,0,0.98)' }}>
							{mockCount}
						</span>
					)}
				</button>

				<button
					onClick={() => setOpen(v => !v)}
					className='flex items-center px-[5px] py-[4px] cursor-pointer transition-all hover:brightness-125'
					style={{ color: 'rgba(255,160,0,0.7)', borderLeft: '1px solid rgba(255,140,0,0.3)' }}>
					<ChevronDown size={10} />
				</button>
			</div>

			{/* Dropdown */}
			{open && (
				<div className='absolute top-full right-0 mt-[4px] z-[200] rounded-[8px]'
					style={{
						background: '#0f1120',
						border: '1px solid rgba(255,140,0,0.38)',
						boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
						minWidth: '200px',
					}}>

					{/* Header */}
					<div className='px-[10px] py-[6px] text-[10px] font-[600] uppercase tracking-[0.08em]'
						style={{ color: 'rgba(255,140,0,0.55)', borderBottom: '1px solid rgba(255,140,0,0.15)' }}>
						🧪 DEV — Тестовий гравець
					</div>

					{/* Main room row */}
					<Row
						label='Головна'
						count={mainCount}
						roomId={null}
						onAdd={onAdd}
						onMoveAll={onMoveAll}
						onClearRoom={onClearRoom}
						hasOtherMocks={hasOtherMocksForMain}
					/>

					{/* Breakout room rows */}
					{breakoutRooms.map((room, i) => {
						const count = mocksByRoom[room.id] ?? 0
						const hasOthers = mockCount - count > 0
						return (
							<React.Fragment key={room.id}>
								<div className='mx-[10px] h-[1px]' style={{ background: 'rgba(255,140,0,0.12)' }} />
								<Row
									label={room.name}
									count={count}
									roomId={room.id}
									onAdd={onAdd}
									onMoveAll={onMoveAll}
									onClearRoom={onClearRoom}
									hasOtherMocks={hasOthers}
								/>
							</React.Fragment>
						)
					})}

					{/* Clear all */}
					{mockCount > 0 && (
						<>
							<div className='mx-[8px] h-[1px]' style={{ background: 'rgba(255,140,0,0.18)' }} />
							<button
								onClick={() => { onClearAll(); setOpen(false) }}
								className='w-full flex items-center gap-[8px] px-[12px] py-[8px] text-[12px] cursor-pointer transition-all rounded-b-[8px]'
								style={{ color: 'rgba(255,80,100,0.88)' }}
								onMouseEnter={e => (e.currentTarget.style.background = DEL_HOVER)}
								onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
								<Trash2 size={11} strokeWidth={2} />
								Очистити всіх ({mockCount})
							</button>
						</>
					)}
				</div>
			)}
		</div>
	)
}
