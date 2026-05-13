import React, { useRef, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import type { GameRoomState, RoomPlayer, ChatMessage } from './types'
import { VotingPanel } from './VotingPanel'
import { ModPanel } from './ModPanel'

interface Props {
	state: GameRoomState
	myId: string
	isGM: boolean
	isSpectator: boolean
	notes: string
	onNotesChange: (v: string) => void
	onSendChat: (text: string, recipients?: string[]) => void
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
	onOpenObserver?: () => void
	onRecordStart?: () => void
	onRecordStop?: () => void
	recordStatus?: string
	showMod?: boolean
	privateChats?: Record<string, ChatMessage[]>
	unreadDMs?: Record<string, number>
	onMarkDMRead?: (convKey: string) => void
}

export const ChatPanel = ({
	state, myId, isGM, isSpectator,
	notes, onNotesChange,
	onSendChat, onCastVote, onCloseVote, onClearVote,
	onCastSpectatorVote, onCloseSpectatorVote, onClearSpectatorVote,
	onAnnounce, onVoting, onSpectatorVoting, onMuteAll, onEndGame,
	onTimer, onTimerStart, onTimerStop, onTimerClear, onBreakout,
	onOpenObserver, onRecordStart, onRecordStop, recordStatus = '',
	showMod = true,
	privateChats, unreadDMs, onMarkDMRead,
}: Props) => {
	const [tab, setTab]   = useState<string>('chat')
	const [text, setText] = useState('')
	const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
	const [recipientMenuOpen, setRecipientMenuOpen]   = useState(false)
	const [openedDMConvs, setOpenedDMConvs]           = useState<string[]>([])
	const endRef   = useRef<HTMLDivElement>(null)
	const notesRef = useRef<HTMLTextAreaElement>(null)

	const isDMTab = tab !== 'chat' && tab !== 'spectatorChat' && tab !== 'scenario' && tab !== 'notes'
	const allDMKeys = [...new Set([...openedDMConvs, ...Object.keys(privateChats ?? {})])]

	const getDMLabel = (convKey: string) =>
		convKey.split('|')
			.map(id => state.players.find(p => p.userId === id)?.name?.split(' ')[0] ?? '…')
			.join(', ')

	const isSpectatorTab = tab === 'spectatorChat'
	// Messages visible in each main chat tab
	const playerChatMsgs = state.messages.filter(m => !m.spectatorChat)
	const spectatorChatMsgs = state.messages.filter(m => m.spectatorChat === true)
	const activeChatMsgs = isSpectatorTab ? spectatorChatMsgs : playerChatMsgs
	// Whether the current user can type in the current tab
	const canWriteInTab = isDMTab || (isSpectatorTab ? isSpectator : !isSpectator)

	// Players available as private message recipients (non-spectators, not self)
	const recipientOptions = state.players.filter(p => p.connected && !p.isSpectator && p.userId !== myId)
	const selectedNames = selectedRecipients
		.map(id => state.players.find(p => p.userId === id)?.name?.split(' ')[0] ?? '')
		.filter(Boolean)
	const toLabel = selectedRecipients.length === 0 ? 'Всі' : selectedNames.join(', ')
	const isPrivateMode = !isSpectator && selectedRecipients.length > 0

	const activeMsgsLen = isDMTab
		? ((privateChats ?? {})[tab] ?? []).length
		: activeChatMsgs.length

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [activeMsgsLen])

	// Auto-mark DM as read when viewing it or when new messages arrive
	useEffect(() => {
		if (isDMTab && onMarkDMRead) onMarkDMRead(tab)
	}, [tab, activeMsgsLen]) // eslint-disable-line react-hooks/exhaustive-deps

	const send = () => {
		const t = text.trim()
		if (!t) return
		if (isDMTab) {
			onSendChat(t, tab.split('|'))
		} else {
			onSendChat(t, isSpectator ? [] : selectedRecipients)
			if (!isSpectator && selectedRecipients.length > 0) {
				const convKey = [...selectedRecipients].sort().join('|')
				setOpenedDMConvs(prev => prev.includes(convKey) ? prev : [...prev, convKey])
				setTab(convKey)
				setSelectedRecipients([])
			}
		}
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

	const notesPlayers = state.players.filter(p => p.connected)

	const tabBtnStyle = (isActive: boolean) => ({
		color: isActive ? '#0fffc8' : '#7a88b0',
		borderBottom: isActive ? '2px solid #0fffc8' : '2px solid transparent',
		background: 'transparent' as const,
	})

	return (
		<div
			className='flex flex-col h-full'
			style={{ background: '#0b0d1a', borderLeft: '1px solid #151824' }}
		>
			{/* Tab headers */}
			<div className='flex-shrink-0 flex overflow-x-auto' style={{ borderBottom: '1px solid #151824' }}>
				<button onClick={() => setTab('chat')}
					className='flex-shrink-0 px-[12px] py-[9px] text-[11px] uppercase tracking-[0.08em] font-[600] cursor-pointer transition-all whitespace-nowrap'
					style={tabBtnStyle(tab === 'chat')}>
					Гравці
				</button>
				<button onClick={() => setTab('spectatorChat')}
					className='flex-shrink-0 px-[12px] py-[9px] text-[11px] uppercase tracking-[0.08em] font-[600] cursor-pointer transition-all whitespace-nowrap flex items-center gap-[5px]'
					style={tabBtnStyle(tab === 'spectatorChat')}>
					Глядачі
					{spectatorChatMsgs.length > 0 && tab !== 'spectatorChat' && (
						<span className='text-[9px] font-[800] px-[5px] py-[1px] rounded-full'
							style={{ background: 'rgba(74,80,112,0.4)', color: '#7a80a0', minWidth: '16px', textAlign: 'center' }}>
							{spectatorChatMsgs.length}
						</span>
					)}
				</button>
				{allDMKeys.map(convKey => {
					const unread = (unreadDMs ?? {})[convKey] ?? 0
					return (
						<button key={convKey}
							onClick={() => { setTab(convKey); if (onMarkDMRead) onMarkDMRead(convKey) }}
							className='flex-shrink-0 px-[12px] py-[9px] text-[11px] font-[600] cursor-pointer transition-all whitespace-nowrap flex items-center gap-[5px]'
							style={tabBtnStyle(tab === convKey)}>
							🔒 {getDMLabel(convKey)}
							{unread > 0 && (
								<span className='text-[9px] font-[800] px-[5px] py-[1px] rounded-full'
									style={{ background: '#ff3850', color: '#fff', minWidth: '16px', textAlign: 'center' }}>
									{unread}
								</span>
							)}
						</button>
					)
				})}
				{isGM && (
					<>
						<button onClick={() => setTab('scenario')}
							className='flex-shrink-0 px-[12px] py-[9px] text-[11px] uppercase tracking-[0.08em] font-[600] cursor-pointer transition-all whitespace-nowrap'
							style={tabBtnStyle(tab === 'scenario')}>
							Сценарій
						</button>
						<button onClick={() => setTab('notes')}
							className='flex-shrink-0 px-[12px] py-[9px] text-[11px] uppercase tracking-[0.08em] font-[600] cursor-pointer transition-all whitespace-nowrap'
							style={tabBtnStyle(tab === 'notes')}>
							Нотатки
						</button>
					</>
				)}
			</div>

			{/* DM conversation tab */}
			{isDMTab && (
				<>
					<div className='flex-1 overflow-y-auto overflow-x-hidden p-[10px] flex flex-col gap-[8px] min-h-0'>
						{((privateChats ?? {})[tab] ?? []).length === 0 && (
							<p className='text-[12px] text-center pt-[20px]' style={{ color: 'rgba(140,170,255,0.52)' }}>
								Почніть розмову...
							</p>
						)}
						{((privateChats ?? {})[tab] ?? []).map((msg: ChatMessage) => (
							<div key={msg.id} className='flex flex-col gap-[2px]'>
								<div className='text-[12px] font-[700]' style={{ color: msgColor(msg.userId) }}>
									{msg.name}
								</div>
								<div className='text-[13px] leading-[1.5] break-words' style={{ color: '#9eaac8', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
									{msg.text}
								</div>
							</div>
						))}
						<div ref={endRef} />
					</div>
					<div className='flex-shrink-0 flex gap-[6px] p-[10px]' style={{ borderTop: '1px solid #151824' }}>
						<input
							value={text}
							onChange={e => setText(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
							placeholder='Написати приватно...'
							className='flex-1 rounded-[6px] px-[10px] py-[7px] text-[13px] focus:outline-none'
							style={{
								background: 'rgba(15,255,200,0.03)',
								border: '1px solid rgba(15,255,200,0.15)',
								color: '#e0e8ff',
							}}
						/>
						<button onClick={send}
							className='w-[30px] h-[30px] rounded-[6px] flex items-center justify-center cursor-pointer transition-all'
							style={{
								background: 'rgba(15,255,200,0.12)',
								border: '1px solid rgba(15,255,200,0.4)',
								color: '#0fffc8',
							}}>
							<Send size={13} strokeWidth={2} />
						</button>
					</div>
				</>
			)}

			{(tab === 'chat' || tab === 'spectatorChat') && (
				<>
					{/* Messages */}
					<div className='flex-1 overflow-y-auto overflow-x-hidden p-[10px] flex flex-col gap-[8px] min-h-0'>
						{/* Player vote — only in Гравці tab */}
						{tab === 'chat' && !isSpectator && state.activeVote && (
							<VotingPanel
								vote={state.activeVote}
								myId={myId}
								isGM={isGM}
								onCast={onCastVote}
								onClose={onCloseVote}
								onClear={onClearVote}
							/>
						)}
						{/* Spectator vote — in Глядачі tab (and for GM anywhere) */}
						{(tab === 'spectatorChat' || isGM) && state.spectatorVote && (
							<VotingPanel
								vote={state.spectatorVote}
								myId={myId}
								isGM={isGM}
								onCast={onCastSpectatorVote}
								onClose={onCloseSpectatorVote}
								onClear={onClearSpectatorVote}
							/>
						)}
						{activeChatMsgs.map(msg => (
							<div key={msg.id} className='flex flex-col gap-[2px]'>
								<div className='text-[12px] font-[700]' style={{ color: msgColor(msg.userId) }}>
									{msg.name}
								</div>
								<div className='text-[13px] leading-[1.5] break-words' style={{ color: '#9eaac8', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
									{msg.text}
								</div>
							</div>
						))}
						<div ref={endRef} />
					</div>

					{/* Recipient selector — only in Гравці tab for non-spectators */}
					{tab === 'chat' && !isSpectator && (
						<div className='flex-shrink-0 flex items-center gap-[6px] px-[10px] py-[5px] relative'
							style={{ borderTop: '1px solid #151824', background: '#0b0d1a' }}>
							<span className='text-[11px] uppercase tracking-[0.06em] flex-shrink-0'
								style={{ color: '#7a88b0' }}>
								Кому:
							</span>
							<button
								onClick={() => setRecipientMenuOpen(v => !v)}
								className='flex items-center gap-[4px] px-[8px] py-[2px] rounded-[6px] text-[11px] cursor-pointer transition-all truncate'
								style={{
									maxWidth: '160px',
									background: isPrivateMode ? 'rgba(15,255,200,0.06)' : '#0f1120',
									border: isPrivateMode ? '1px solid rgba(15,255,200,0.2)' : '1px solid #1c1f35',
									color: isPrivateMode ? '#0fffc8' : '#9aabb0',
								}}>
								{toLabel} ▾
							</button>

							{/* Dropdown */}
							{recipientMenuOpen && (
								<>
									<div className='fixed inset-0 z-[8]' onClick={() => setRecipientMenuOpen(false)} />
									<div className='absolute bottom-[calc(100%+4px)] left-0 z-[9] rounded-[10px] min-w-[190px] max-h-[220px] overflow-y-auto'
										style={{ background: '#0f1120', border: '1px solid #1c1f35', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
										<button
											onClick={() => { setSelectedRecipients([]); setRecipientMenuOpen(false) }}
											className='w-full text-left px-[12px] py-[7px] text-[12px] cursor-pointer transition-all hover:brightness-125 flex items-center gap-[8px]'
											style={{ color: selectedRecipients.length === 0 ? '#0fffc8' : '#9aabb0', borderBottom: '1px solid #151824', background: 'transparent' }}>
											<span className='flex-shrink-0 w-[14px] h-[14px] rounded-[3px] flex items-center justify-center text-[9px]'
												style={{
													background: selectedRecipients.length === 0 ? 'rgba(15,255,200,0.1)' : '#1a1a2e',
													border: selectedRecipients.length === 0 ? '1px solid rgba(15,255,200,0.3)' : '1px solid #2a2a3e',
												}}>
												{selectedRecipients.length === 0 && '✓'}
											</span>
											Всі (публічне)
										</button>
										{recipientOptions.map(p => {
											const sel = selectedRecipients.includes(p.userId)
											return (
												<button key={p.userId}
													onClick={() => setSelectedRecipients(prev =>
														sel ? prev.filter(id => id !== p.userId) : [...prev, p.userId]
													)}
													className='w-full text-left px-[12px] py-[7px] text-[12px] cursor-pointer transition-all hover:brightness-125 flex items-center gap-[8px]'
													style={{ color: sel ? '#0fffc8' : '#9aabb0', background: 'transparent' }}>
													<span className='flex-shrink-0 w-[14px] h-[14px] rounded-[3px] flex items-center justify-center text-[9px]'
														style={{
															background: sel ? 'rgba(15,255,200,0.1)' : '#1a1a2e',
															border: sel ? '1px solid rgba(15,255,200,0.3)' : '1px solid #2a2a3e',
														}}>
														{sel && '✓'}
													</span>
													{p.name.split(' ')[0]}
													{p.isGamemaster && (
														<span style={{ color: '#7a88b0', fontSize: '10px' }}>GM</span>
													)}
												</button>
											)
										})}
										{recipientOptions.length === 0 && (
											<p className='px-[12px] py-[8px] text-[12px]' style={{ color: 'rgba(140,170,255,0.55)' }}>
												Немає гравців
											</p>
										)}
									</div>
								</>
							)}
						</div>
					)}

					{/* Input — shown only when user can write in this tab */}
					{canWriteInTab ? (
						<div className='flex-shrink-0 flex gap-[6px] p-[10px]' style={{ borderTop: '1px solid #151824' }}>
							<input
								value={text}
								onChange={e => setText(e.target.value)}
								onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
								placeholder={isPrivateMode ? 'Написати приватно...' : 'Написати...'}
								className='flex-1 rounded-[6px] px-[10px] py-[7px] text-[13px] focus:outline-none'
								style={{
									background: isPrivateMode ? 'rgba(15,255,200,0.03)' : '#0f1120',
									border: isPrivateMode ? '1px solid rgba(15,255,200,0.15)' : '1px solid #1c1f35',
									color: '#dde1f0',
								}}
							/>
							<button onClick={send}
								className='w-[30px] h-[30px] rounded-[6px] flex items-center justify-center cursor-pointer transition-all'
								style={{
									background: isPrivateMode ? 'rgba(15,255,200,0.12)' : 'rgba(15,255,200,0.1)',
									border: isPrivateMode ? '1px solid rgba(15,255,200,0.4)' : '1px solid rgba(15,255,200,0.25)',
									color: '#0fffc8',
								}}>
								<Send size={13} strokeWidth={2} />
							</button>
						</div>
					) : (
						<div className='flex-shrink-0 px-[10px] py-[8px] flex items-center gap-[6px]'
							style={{ borderTop: '1px solid #151824' }}>
							<span className='text-[12px]' style={{ color: 'rgba(130,145,195,0.75)' }}>
								👁 Тільки перегляд
							</span>
						</div>
					)}
				</>
			)}

			{tab === 'scenario' && (
				<div className='flex-1 overflow-y-auto p-[12px]'>
					{state.scenario
						? <p className='text-[13px] leading-[1.75]' style={{ color: '#9eaac8', whiteSpace: 'pre-wrap' }}>
								{state.scenario}
							</p>
						: <p className='text-[13px] text-center pt-[20px]' style={{ color: 'rgba(140,170,255,0.52)' }}>
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
						<p className='text-[11px] uppercase tracking-[0.08em] mb-[6px]' style={{ color: '#7a88b0' }}>
							Вставити гравця
						</p>
						<div className='flex flex-col gap-[4px] max-h-[120px] overflow-y-auto pr-[2px]'>
							{notesPlayers.length === 0 && (
								<p className='text-[12px]' style={{ color: 'rgba(140,170,255,0.52)' }}>Немає гравців</p>
							)}
							{notesPlayers.map(p => (
								<button
									key={p.userId}
									onClick={() => insertPlayer(p)}
									className='text-left rounded-[6px] px-[8px] py-[5px] text-[12px] cursor-pointer transition-all hover:brightness-125 truncate'
									style={{
										background: '#0f1120',
										border: '1px solid #1c1f35',
										color: p.isGamemaster ? 'rgba(15,255,200,0.82)' : '#9eaac8',
									}}>
									{p.name}{p.role ? <span style={{ color: '#7a88b0' }}> ({p.role})</span> : null}
									{p.isGamemaster && <span style={{ color: 'rgba(15,255,200,0.75)', fontSize: '11px' }}> · GM</span>}
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
						className='flex-1 resize-none focus:outline-none p-[12px] text-[13px] leading-[1.75] min-h-0'
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
			{isGM && showMod && (
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
					onOpenObserver={onOpenObserver ?? (() => {})}
					onRecordStart={onRecordStart ?? (() => {})}
					onRecordStop={onRecordStop ?? (() => {})}
					recordStatus={recordStatus}
				/>
			)}
		</div>
	)
}
