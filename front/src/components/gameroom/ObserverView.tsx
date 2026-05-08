import React, { useState, useRef, useEffect } from 'react'
import { Send, ChevronRight, ChevronLeft } from 'lucide-react'
import type { GameRoomState, ChatMessage } from './types'
import { SpeakerView } from './SpeakerView'
import { GameStartOverlay } from './GameStartOverlay'
import { GameEndOverlay } from './GameEndOverlay'
import type { RecordingStatus } from '../../hooks/useRecording'

interface Props {
	state: GameRoomState
	myId: string
	messages: ChatMessage[]
	onSendChat: (text: string) => void
	recordingStatus: RecordingStatus
	uploadProgress: number
	shareLink: string
	errorMsg: string
	onPrepare: () => void
	onStop: () => void
	startAnim: boolean
	endAnim: boolean
	onStartAnimDone: () => void
	onEndAnimDone: () => void
}

export const ObserverView = ({
	state, myId, messages, onSendChat,
	recordingStatus, uploadProgress, shareLink, errorMsg,
	onPrepare, onStop,
	startAnim, endAnim, onStartAnimDone, onEndAnimDone,
}: Props) => {
	const [chatOpen, setChatOpen] = useState(false)
	const [chatInput, setChatInput] = useState('')
	const chatEndRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages.length])

	const submit = () => {
		const t = chatInput.trim()
		if (!t) return
		onSendChat(t)
		setChatInput('')
	}

	const isRecording = recordingStatus === 'recording'
	const isUploading = recordingStatus === 'uploading'
	const isDone      = recordingStatus === 'done'
	const isPrepared  = recordingStatus === 'prepared'
	const isError     = recordingStatus === 'error'

	return (
		<div className='flex flex-col h-screen w-screen overflow-hidden' style={{ background: '#07080f', color: '#dde1f0' }}>

			{/* ── Recording bar ── */}
			<div className='flex-shrink-0 flex items-center gap-[10px] px-[14px] py-[6px]'
				style={{ background: '#0b0d1a', borderBottom: '1px solid #151824', minHeight: '38px' }}>

				{/* Status dot + label */}
				<span style={{ color: isRecording ? '#ff3850' : 'rgba(74,80,112,0.7)', fontSize: '11px', letterSpacing: '0.04em' }}>
					{isRecording ? '● Запис' : isUploading ? '↑ Завантаження' : isDone ? '✓ Збережено' : isPrepared ? '◎ Готовий' : isError ? '✕ Помилка' : '○ Спостерігач'}
				</span>

				{/* Upload progress bar */}
				{isUploading && (
					<div className='flex items-center gap-[6px]'>
						<div className='w-[80px] h-[3px] rounded-full overflow-hidden' style={{ background: 'rgba(15,255,200,0.15)' }}>
							<div className='h-full rounded-full transition-all' style={{ width: `${uploadProgress}%`, background: '#0fffc8' }} />
						</div>
						<span className='text-[10px]' style={{ color: '#0fffc8' }}>{uploadProgress}%</span>
					</div>
				)}

				{/* Share link */}
				{isDone && shareLink && (
					<a href={shareLink} target='_blank' rel='noreferrer'
						className='text-[11px] underline' style={{ color: '#0fffc8' }}>
						Переглянути →
					</a>
				)}

				{/* Error */}
				{isError && <span className='text-[11px]' style={{ color: '#ff3850' }}>{errorMsg}</span>}

				<div className='flex-1' />

				{/* Action buttons */}
				{(recordingStatus === 'idle' || isError) && (
					<button onClick={onPrepare}
						className='px-[12px] py-[4px] rounded-[6px] text-[11px] font-[600] cursor-pointer transition-all hover:brightness-125'
						style={{ background: 'rgba(180,130,255,0.1)', border: '1px solid rgba(180,130,255,0.3)', color: '#c07fff' }}>
						Підготувати запис
					</button>
				)}
				{isPrepared && (
					<span className='text-[11px] italic' style={{ color: 'rgba(200,168,48,0.7)' }}>
						Очікую сигнал від ІМ...
					</span>
				)}
				{isRecording && (
					<button onClick={onStop}
						className='px-[12px] py-[4px] rounded-[6px] text-[11px] font-[600] cursor-pointer transition-all hover:brightness-125'
						style={{ background: 'rgba(255,56,80,0.1)', border: '1px solid rgba(255,56,80,0.3)', color: '#ff3850' }}>
						■ Зупинити запис
					</button>
				)}

				{/* Chat toggle */}
				<button onClick={() => setChatOpen(p => !p)}
					className='ml-[4px] p-[4px] rounded-[6px] cursor-pointer transition-all hover:brightness-125'
					style={{ background: chatOpen ? 'rgba(68,170,255,0.1)' : 'transparent', border: '1px solid rgba(68,170,255,0.15)', color: 'rgba(68,170,255,0.6)' }}>
					{chatOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
				</button>
			</div>

			{/* ── Main content ── */}
			<div className='flex flex-1 overflow-hidden min-h-0'>

				{/* Speaker view — full area */}
				<div className='flex-1 flex flex-col overflow-hidden min-w-0'>
					<SpeakerView
						state={state}
						myId={myId}
						isGM={false}
						isSpectator={true}
						isMobile={false}
						micOn={false}
						camOn={false}
						onToggleMic={() => {}}
						onToggleCam={() => {}}
						onReact={() => {}}
						onRaiseHand={() => {}}
						onLeave={() => window.close()}
						imageUrl={state.shownImageUrl ?? null}
						images={state.images ?? []}
						onImageClose={() => {}}
						onChangeImage={() => {}}
						playerReactions={{}}
						onMutePlayer={() => {}}
					/>
				</div>

				{/* Chat panel — collapsible */}
				{chatOpen && (
					<div className='flex-shrink-0 w-[240px] flex flex-col overflow-hidden min-h-0'
						style={{ borderLeft: '1px solid #151824' }}>
						<div className='flex-shrink-0 px-[12px] py-[8px]'
							style={{ background: '#0b0d1a', borderBottom: '1px solid #151824' }}>
							<span className='text-[10px] uppercase tracking-[0.1em]' style={{ color: '#4a5070' }}>Чат</span>
						</div>
						<div className='flex-1 overflow-y-auto px-[10px] py-[8px] flex flex-col gap-[6px]'
							style={{ overscrollBehavior: 'contain' }}>
							{messages.map(m => (
								<div key={m.id} className='flex flex-col gap-[1px]'>
									<span className='text-[10px] font-[600]' style={{ color: 'rgba(100,140,220,0.55)' }}>{m.name}</span>
									<span className='text-[12px] leading-[1.4]' style={{ color: 'rgba(220,230,255,0.8)', wordBreak: 'break-word' }}>{m.text}</span>
								</div>
							))}
							<div ref={chatEndRef} />
						</div>
						<div className='flex-shrink-0 flex gap-[6px] p-[8px]' style={{ borderTop: '1px solid #151824' }}>
							<input
								value={chatInput}
								onChange={e => setChatInput(e.target.value)}
								onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
								placeholder='Повідомлення...'
								className='flex-1 rounded-[8px] px-[10px] py-[6px] text-[12px] focus:outline-none'
								style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.15)', color: 'rgba(180,200,255,0.85)' }}
							/>
							<button onClick={submit}
								className='p-[7px] rounded-[8px] cursor-pointer transition-all hover:brightness-125'
								style={{ background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.2)', color: '#0fffc8' }}>
								<Send size={14} />
							</button>
						</div>
					</div>
				)}
			</div>

			{startAnim && <GameStartOverlay onDone={onStartAnimDone} />}
			{endAnim && <GameEndOverlay onDone={onEndAnimDone} />}
		</div>
	)
}
