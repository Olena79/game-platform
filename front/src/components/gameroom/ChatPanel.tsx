import React, { useRef, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import type { GameRoomState, RoomPlayer } from './types'
import { VotingPanel } from './VotingPanel'
import { ModPanel } from './ModPanel'

interface Props {
	state: GameRoomState
	myId: string
	isGM: boolean
	isSpectator: boolean
	notes: string
	onNotesChange: (v: string) => void
	onSendChat: (text: string) => void
	onCastVote: (optionIds: string[]) => void
	onCloseVote: () => void
	onClearVote: () => void
	onCastSpectatorVote: (optionIds: string[]) => void
	onCloseSpectatorVote: () => void
	onClearSpectatorVote: () => void
	// mod actions
	onAnnounce: () => void
	onVoting: () => void
	onSpectatorVoting: () => void
	onMuteAll: () => void
	onEndGame: () => void
	onTimer: () => void
	onTimerStart: () => void
	onTimerStop: () => void
	onTimerClear: () => void
	onBreakout: () => void
}

export const ChatPanel = ({
	state, myId, isGM, isSpectator,
	notes, onNotesChange,
	onSendChat, onCastVote, onCloseVote, onClearVote,
	onCastSpectatorVote, onCloseSpectatorVote, onClearSpectatorVote,
	onAnnounce, onVoting, onSpectatorVoting, onMuteAll, onEndGame,
	onTimer, onTimerStart, onTimerStop, onTimerClear, onBreakout,
}: Props) => {
	const [tab, setTab]   = useState<'chat' | 'scenario' | 'notes'>('chat')
	const [text, setText] = useState('')
	const endRef  = useRef<HTMLDivElement>(null)
	const notesRef = useRef<HTMLTextAreaElement>(null)

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

	const insertPlayer = (player: RoomPlayer) => {
		const label = player.name + (player.role ? ` (${player.role})` : '') + ' — '
		const el = notesRef.current
		if (!el) {
			onNotesChange(notes + (notes && !notes.endsWith('\n') ? '\n' : '') + label)
			return
		}
		const start = el.selectionStart ?? notes.length
		const end   = el.selectionEnd   ?? notes.length
		const prefix = notes.slice(0, start)
		const suffix = notes.slice(end)
		const nl = prefix && !prefix.endsWith('\n') ? '\n' : ''
		const insert = nl + label
		onNotesChange(prefix + insert + suffix)
		setTimeout(() => {
			if (!notesRef.current) return
			const pos = start + insert.length
			notesRef.current.focus()
			notesRef.current.setSelectionRange(pos, pos)
		}, 0)
	}

	const tabLabel = (t: 'chat' | 'scenario' | 'notes') =>
		t === 'chat' ? 'Чат' : t === 'scenario' ? 'Сценарій' : 'Нотатки'

	const tabs = ['chat', ...(isGM ? ['scenario', 'notes'] : [])] as ('chat' | 'scenario' | 'notes')[]

	const notesPlayers = state.players.filter(p => p.connected)

	return (
		<div
			className='flex flex-col h-full'
			style={{ background: '#0b0d1a', borderLeft: '1px solid #151824' }}
		>
			{/* Tab headers */}
			<div className='flex-shrink-0 flex' style={{ borderBottom: '1px solid #151824' }}>
				{tabs.map(t => (
					<button key={t} onClick={() => setTab(t)}
						className='flex-1 py-[9px] text-[11px] uppercase tracking-[0.08em] font-[600] cursor-pointer transition-all'
						style={{
							color: tab === t ? '#0fffc8' : '#4a5070',
							borderBottom: tab === t ? '2px solid #0fffc8' : '2px solid transparent',
							background: 'transparent',
						}}>
						{tabLabel(t)}
					</button>
				))}
			</div>

			{tab === 'chat' && (
				<>
					{/* Messages */}
					<div className='flex-1 overflow-y-auto p-[10px] flex flex-col gap-[8px] min-h-0'>
						{!isSpectator && state.activeVote && (
							<VotingPanel
								vote={state.activeVote}
								myId={myId}
								isGM={isGM}
								onCast={onCastVote}
								onClose={onCloseVote}
								onClear={onClearVote}
							/>
						)}
						{(isSpectator || isGM) && state.spectatorVote && (
							<VotingPanel
								vote={state.spectatorVote}
								myId={myId}
								isGM={isGM}
								onCast={onCastSpectatorVote}
								onClose={onCloseSpectatorVote}
								onClear={onClearSpectatorVote}
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

			{tab === 'notes' && (
				<div className='flex-1 flex flex-col min-h-0 overflow-hidden'>
					{/* Player dropdown */}
					<div className='flex-shrink-0 px-[10px] pt-[10px] pb-[8px]'
						style={{ borderBottom: '1px solid #151824' }}>
						<p className='text-[10px] uppercase tracking-[0.08em] mb-[6px]' style={{ color: '#4a5070' }}>
							Вставити гравця
						</p>
						<div className='flex flex-col gap-[4px] max-h-[120px] overflow-y-auto pr-[2px]'>
							{notesPlayers.length === 0 && (
								<p className='text-[11px]' style={{ color: 'rgba(100,140,220,0.3)' }}>Немає гравців</p>
							)}
							{notesPlayers.map(p => (
								<button
									key={p.userId}
									onClick={() => insertPlayer(p)}
									className='text-left rounded-[6px] px-[8px] py-[5px] text-[11px] cursor-pointer transition-all hover:brightness-125 truncate'
									style={{
										background: '#0f1120',
										border: '1px solid #1c1f35',
										color: p.isGamemaster ? 'rgba(15,255,200,0.5)' : '#7a80a0',
									}}>
									{p.name}{p.role ? <span style={{ color: '#4a5070' }}> ({p.role})</span> : null}
									{p.isGamemaster && <span style={{ color: 'rgba(15,255,200,0.4)', fontSize: '10px' }}> · GM</span>}
								</button>
							))}
						</div>
					</div>

					{/* Notes textarea */}
					<textarea
						ref={notesRef}
						value={notes}
						onChange={e => onNotesChange(e.target.value)}
						placeholder='Ваші нотатки під час гри...'
						className='flex-1 resize-none focus:outline-none p-[12px] text-[12px] leading-[1.7] min-h-0'
						style={{
							background: '#07080f',
							color: '#dde1f0',
							border: 'none',
							fontFamily: "'Segoe UI', sans-serif",
						}}
					/>
				</div>
			)}

			{/* Mod panel (GM only) */}
			{isGM && (
				<ModPanel
					state={state}
					onAnnounce={onAnnounce}
					onVoting={onVoting}
					onSpectatorVoting={onSpectatorVoting}
					onMuteAll={onMuteAll}
					onEndGame={onEndGame}
					onTimer={onTimer}
					onTimerStart={onTimerStart}
					onTimerStop={onTimerStop}
					onTimerClear={onTimerClear}
					onBreakout={onBreakout}
				/>
			)}
		</div>
	)
}
