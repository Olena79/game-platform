import React, { useRef, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import type { GameRoomState } from './types'
import { VotingPanel } from './VotingPanel'
import { ModPanel } from './ModPanel'

interface Props {
	state: GameRoomState
	myId: string
	isGM: boolean
	onSendChat: (text: string) => void
	onCastVote: (optionIds: string[]) => void
	onCloseVote: () => void
	onClearVote: () => void
	// mod actions
	onAnnounce: () => void
	onVoting: () => void
	onMuteAll: () => void
	onEndGame: () => void
	onTimer: () => void
	onTimerStart: () => void
	onTimerStop: () => void
	onTimerClear: () => void
	onBreakout: () => void
	onShowImagePicker: () => void
}

export const ChatPanel = ({
	state, myId, isGM,
	onSendChat, onCastVote, onCloseVote, onClearVote,
	onAnnounce, onVoting, onMuteAll, onEndGame,
	onTimer, onTimerStart, onTimerStop, onTimerClear, onBreakout, onShowImagePicker,
}: Props) => {
	const [tab, setTab]   = useState<'chat' | 'scenario'>('chat')
	const [text, setText] = useState('')
	const endRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [state.messages])

	const send = () => {
		const t = text.trim()
		if (!t) return
		onSendChat(t)
		setText('')
	}

	const msgColor = (userId: string) => {
		const colors = ['#0fffc8', '#44aaff', '#c07fff', '#ff5fa0', '#ffb728', '#5fffb0']
		let h = 0
		for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % colors.length
		return colors[h]
	}

	return (
		<div
			className='flex flex-col h-full'
			style={{ background: '#0b0d1a', borderLeft: '1px solid #151824' }}
		>
			{/* Tab headers */}
			<div className='flex-shrink-0 flex' style={{ borderBottom: '1px solid #151824' }}>
				{(['chat', 'scenario'] as const).map(t => (
					<button key={t} onClick={() => setTab(t)}
						className='flex-1 py-[9px] text-[11px] uppercase tracking-[0.08em] font-[600] cursor-pointer transition-all'
						style={{
							color: tab === t ? '#0fffc8' : '#4a5070',
							borderBottom: tab === t ? '2px solid #0fffc8' : '2px solid transparent',
							background: 'transparent',
						}}>
						{t === 'chat' ? 'Чат' : 'Сценарій'}
					</button>
				))}
			</div>

			{tab === 'chat' && (
				<>
					{/* Messages */}
					<div className='flex-1 overflow-y-auto p-[10px] flex flex-col gap-[8px] min-h-0'>
						{state.activeVote && (
							<VotingPanel
								vote={state.activeVote}
								myId={myId}
								isGM={isGM}
								onCast={onCastVote}
								onClose={onCloseVote}
								onClear={onClearVote}
							/>
						)}
						{state.messages.map(msg => (
							<div key={msg.id}>
								<div className='text-[11px] font-[700] mb-[1px]' style={{ color: msgColor(msg.userId) }}>
									{msg.name}
								</div>
								<div className='text-[12px] leading-[1.45]' style={{ color: '#7a80a0' }}>
									{msg.text}
								</div>
							</div>
						))}
						<div ref={endRef} />
					</div>

					{/* Input */}
					<div className='flex-shrink-0 flex gap-[6px] p-[10px]' style={{ borderTop: '1px solid #151824' }}>
						<input
							value={text}
							onChange={e => setText(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
							placeholder='Написати...'
							className='flex-1 rounded-[6px] px-[10px] py-[6px] text-[12px] focus:outline-none'
							style={{ background: '#0f1120', border: '1px solid #1c1f35', color: '#dde1f0' }}
						/>
						<button onClick={send}
							className='w-[30px] h-[30px] rounded-[6px] flex items-center justify-center cursor-pointer transition-all'
							style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.25)', color: '#0fffc8' }}>
							<Send size={13} strokeWidth={2} />
						</button>
					</div>
				</>
			)}

			{tab === 'scenario' && (
				<div className='flex-1 overflow-y-auto p-[12px]'>
					{state.scenario
						? <p className='text-[12px] leading-[1.7]' style={{ color: '#7a80a0', whiteSpace: 'pre-wrap' }}>
								{state.scenario}
							</p>
						: <p className='text-[12px] text-center pt-[20px]' style={{ color: 'rgba(100,140,220,0.3)' }}>
								Сценарій не вказано
							</p>
					}
				</div>
			)}

			{/* Mod panel (GM only) */}
			{isGM && (
				<ModPanel
					state={state}
					onAnnounce={onAnnounce}
					onVoting={onVoting}
					onMuteAll={onMuteAll}
					onEndGame={onEndGame}
					onTimer={onTimer}
					onTimerStart={onTimerStart}
					onTimerStop={onTimerStop}
					onTimerClear={onTimerClear}
					onBreakout={onBreakout}
					onShowImagePicker={onShowImagePicker}
				/>
			)}
		</div>
	)
}
