import React, { useState, useCallback, useEffect, useRef, Component, ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
	LiveKitRoom as LKRoom, RoomAudioRenderer as LKAudioRenderer,
	useLocalParticipant,
} from '@livekit/components-react'
const LiveKitRoom = LKRoom as React.ComponentType<any>
const RoomAudioRenderer = LKAudioRenderer as React.ComponentType<any>
import { useGameRoom } from '../../hooks/useGameRoom'
import { useAuth } from '../../context/AuthContext'
import { sfx } from '../../utils/sounds'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
import { AnnouncementBanner } from '../gameroom/AnnouncementBanner'
import { GameEndOverlay } from '../gameroom/GameEndOverlay'
import { GameStartOverlay } from '../gameroom/GameStartOverlay'
import { TimerFloatOverlay } from '../gameroom/TimerFloatOverlay'
import { SpeakerView } from '../gameroom/SpeakerView'
import { GridView } from '../gameroom/GridView'
import { ChatPanel } from '../gameroom/ChatPanel'
import { ImagePanel } from '../gameroom/ImagePanel'
import { CoinModal } from '../gameroom/CoinModal'
import { VotingModal } from '../gameroom/VotingModal'
import { TimerModal } from '../gameroom/TimerModal'
import { BreakoutModal } from '../gameroom/BreakoutModal'

type RoomHook = ReturnType<typeof useGameRoom>

class RoomErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
	state = { err: null }
	static getDerivedStateFromError(e: Error) { return { err: e.message } }
	render() {
		if (this.state.err) {
			return (
				<div className='w-screen h-screen flex items-center justify-center flex-col gap-3' style={{ background: '#07080f' }}>
					<span style={{ color: '#ff3850', fontSize: '14px' }}>Помилка: {this.state.err}</span>
				</div>
			)
		}
		return this.props.children
	}
}

// ── Inner room content (needs LiveKit context) ────────────────────────────────
function RoomContent({ room, gameCode }: { room: RoomHook; gameCode: string }) {
	const navigate = useNavigate()
	const { state, me, isGM, myId, endAnim, setEndAnim, startAnim, setStartAnim, playerReactions,
		breakoutInvite, setBreakoutInvite, joinBreakout, leaveBreakout,
		sendChat, react, raiseHand, setRole, startGame, endGame,
		transferCoins, payBank, setInfluence, muteAll,
		announce, setTimer, startTimer, stopTimer, clearTimer,
		createVote, castVote, closeVote, clearVote,
		createSpectatorVote, castSpectatorVote, closeSpectatorVote, clearSpectatorVote,
		createBreakout, inviteBreakout, endBreakout, showImage,
	} = room

	const isSpectator = me?.isSpectator ?? false

	const { token: authToken } = useAuth()
	const { localParticipant } = useLocalParticipant()
	const [view, setView]                 = useState<'speaker' | 'grid'>('speaker')
	const [micOn, setMicOn]               = useState(false)
	const [camOn, setCamOn]               = useState(false)
	const [showCoinModal, setShowCoin]    = useState(false)
	const [showVoteModal, setShowVote]    = useState(false)
	const [showTimerModal, setShowTimer]  = useState(false)
	const [showBreakout, setShowBreakout] = useState(false)
	const [showAnnounce, setShowAnnounce] = useState(false)
	const [showImgPicker, setShowImgPicker] = useState(false)
	const [showStopConfirm, setShowStopConfirm] = useState(false)
	const [showSpectatorVote, setShowSpectatorVote] = useState(false)
	const [notes, setNotes]               = useState('')

	// ── Sound effects ────────────────────────────────────────────────────────────
	const sfxInitRef        = useRef(false)
	const raisedHandsRef    = useRef<Set<string>>(new Set())
	const prevAnnouncRef    = useRef<string | null>(null)
	const prevVoteIdRef     = useRef<string | null>(null)

	useEffect(() => {
		if (!state) return
		if (!sfxInitRef.current) {
			// skip sounds on first load — just capture initial state
			sfxInitRef.current   = true
			raisedHandsRef.current   = new Set(state.players.filter(p => p.handRaised).map(p => p.userId))
			prevAnnouncRef.current   = state.announcement ?? null
			prevVoteIdRef.current    = state.activeVote?.id ?? null
			return
		}

		// Hand raise
		state.players.forEach(p => {
			if (p.handRaised && !raisedHandsRef.current.has(p.userId)) sfx.handRaise()
		})
		raisedHandsRef.current = new Set(state.players.filter(p => p.handRaised).map(p => p.userId))

		// Announcement appears
		if (state.announcement && !prevAnnouncRef.current) sfx.announcement()
		prevAnnouncRef.current = state.announcement ?? null

		// Vote appears
		const voteId = state.activeVote?.id ?? null
		if (voteId && voteId !== prevVoteIdRef.current) sfx.vote()
		prevVoteIdRef.current = voteId
	}, [state])

	const toggleMic = useCallback(async () => {
		if (!localParticipant) return
		const enabled = !micOn
		await localParticipant.setMicrophoneEnabled(enabled)
		setMicOn(enabled)
	}, [localParticipant, micOn])

	const toggleCam = useCallback(async () => {
		if (!localParticipant) return
		const enabled = !camOn
		await localParticipant.setCameraEnabled(enabled)
		setCamOn(enabled)
	}, [localParticipant, camOn])

	const handleLeave = () => navigate('/games')

	if (!state) {
		return (
			<div className='w-screen h-screen flex items-center justify-center flex-col gap-3' style={{ background: '#07080f' }}>
				<div className='w-[6px] h-[6px] rounded-full bg-[#0fffc8] pulse-dot-anim' />
				<span className='text-[12px]' style={{ color: 'rgba(100,140,220,0.3)' }}>Завантаження...</span>
			</div>
		)
	}

	const mainPlayers = state.players.filter(p => !p.breakoutRoomId)
	const imageToShow = state.shownImageUrl

	return (
		<div className='w-screen h-screen flex flex-col overflow-hidden' style={{ background: '#07080f', color: '#dde1f0', fontFamily: "'Segoe UI', sans-serif", fontSize: '13px' }}>
			<RoomAudioRenderer />

			{/* Announcement banner */}
			<AnnouncementBanner
				text={state.announcement ?? null}
				isGM={isGM}
				onClose={() => announce(null)}
			/>

			{/* Lobby / restart button */}
			{(state.status === 'lobby' || state.status === 'ended') && isGM && (
				<div className='flex-shrink-0 flex items-center justify-center gap-[10px] py-[8px] px-[16px]'
					style={{ background: 'rgba(15,255,200,0.06)', borderBottom: '1px solid rgba(15,255,200,0.12)' }}>
					<span className='text-[12px]' style={{ color: 'rgba(15,255,200,0.5)' }}>
						Гравців: {mainPlayers.filter(p => !p.isGamemaster).length}
					</span>
					<button onClick={startGame}
						className='px-[20px] py-[6px] rounded-[8px] text-[12px] font-[700] cursor-pointer transition-all hover:-translate-y-[1px]'
						style={{ background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.35)', color: '#0fffc8' }}>
						▶ Почати гру
					</button>
				</div>
			)}

			{/* Main content area */}
			<div className='flex-1 flex overflow-hidden min-h-0'>

				{/* Left / Main area */}
				<div className='flex-1 flex flex-col overflow-hidden min-w-0 relative'>

					{/* Floating timer overlay */}
					{state.timer && <TimerFloatOverlay timer={state.timer} />}

					{/* View switcher */}
					<div className='flex-shrink-0 flex items-center gap-[7px] px-[12px] py-[7px]'
						style={{ background: '#0b0d1a', borderBottom: '1px solid #151824' }}>
						<span className='text-[10px]' style={{ color: '#4a5070' }}>Вид:</span>
						{(['speaker', 'grid'] as const).map(v => (
							<button key={v} onClick={() => setView(v)}
								className='px-[12px] py-[4px] rounded-[6px] text-[11px] cursor-pointer transition-all'
								style={{
									background: view === v ? 'rgba(15,255,200,0.08)' : '#0f1120',
									border: view === v ? '1px solid rgba(15,255,200,0.3)' : '1px solid #1c1f35',
									color: view === v ? '#0fffc8' : '#4a5070',
								}}>
								{v === 'speaker' ? '▶ Спікер' : '⊞ Всі гравці'}
							</button>
						))}

						{/* Image toggle button (visible to all) */}
						{(imageToShow || (isGM && state.images.length > 0)) && (
							<button onClick={() => isGM ? setShowImgPicker(true) : showImage(imageToShow ? null : (state.images[0] ?? null))}
								className='ml-auto px-[10px] py-[4px] rounded-[6px] text-[10px] cursor-pointer transition-all'
								style={{
									background: imageToShow ? 'rgba(68,170,255,0.08)' : 'transparent',
									border: imageToShow ? '1px solid rgba(68,170,255,0.25)' : '1px solid transparent',
									color: 'rgba(68,170,255,0.5)',
								}}>
								🖼 Картинка
							</button>
						)}

						{/* Coin button (non-GM players) */}
						{!isGM && me && (
							<button onClick={() => setShowCoin(true)}
								className='px-[10px] py-[4px] rounded-[6px] text-[10px] cursor-pointer transition-all'
								style={{ background: 'rgba(200,168,48,0.06)', border: '1px solid rgba(200,168,48,0.2)', color: 'rgba(200,168,48,0.8)' }}>
								🪙 {me.coins}
							</button>
						)}
					</div>

					{/* View content */}
					{view === 'speaker' ? (
						<SpeakerView
							state={state}
							myId={myId}
							isGM={isGM}
							micOn={micOn}
							camOn={camOn}
							onToggleMic={toggleMic}
							onToggleCam={toggleCam}
							onReact={react}
							onRaiseHand={raiseHand}
							onLeave={handleLeave}
							imageUrl={imageToShow}
							images={state.images}
							onImageClose={() => showImage(null)}
							onChangeImage={url => showImage(url)}
							playerReactions={playerReactions}
						/>
					) : (
						<GridView
							state={state}
							myId={myId}
							isGM={isGM}
							micOn={micOn}
							camOn={camOn}
							onToggleMic={toggleMic}
							onToggleCam={toggleCam}
							onReact={react}
							onRaiseHand={raiseHand}
							onLeave={handleLeave}
							onSetRole={setRole}
							onSetInfluence={setInfluence}
							playerReactions={playerReactions}
						/>
					)}
				</div>

				{/* Right panel: Chat + Tools */}
				<div className='w-[255px] lg:w-[382px] flex-shrink-0 flex flex-col overflow-hidden min-h-0'>
					<ChatPanel
						state={state}
						myId={myId}
						isGM={isGM}
						isSpectator={isSpectator}
						notes={notes}
						onNotesChange={setNotes}
						onSendChat={sendChat}
						onCastVote={castVote}
						onCloseVote={closeVote}
						onClearVote={clearVote}
						onCastSpectatorVote={castSpectatorVote}
						onCloseSpectatorVote={closeSpectatorVote}
						onClearSpectatorVote={clearSpectatorVote}
						onAnnounce={() => setShowAnnounce(true)}
						onVoting={() => setShowVote(true)}
						onSpectatorVoting={() => setShowSpectatorVote(true)}
						onMuteAll={muteAll}
						onEndGame={() => setShowStopConfirm(true)}
						onTimer={() => setShowTimer(true)}
						onTimerStart={startTimer}
						onTimerStop={stopTimer}
						onTimerClear={clearTimer}
						onBreakout={() => setShowBreakout(true)}
					/>
				</div>
			</div>

			{/* Breakout invite */}
			{breakoutInvite && (
				<div className='fixed bottom-[20px] right-[20px] z-[90] rounded-[14px] p-[16px] w-[280px]'
					style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
					<p className='text-[13px] font-[600] mb-[6px]' style={{ color: 'rgba(220,230,255,0.9)' }}>
						🚪 Запрошення в кімнату
					</p>
					<p className='text-[12px] mb-[12px]' style={{ color: 'rgba(100,140,220,0.6)' }}>
						{breakoutInvite.roomName}
					</p>
					<div className='flex gap-[7px]'>
						<button onClick={() => setBreakoutInvite(null)}
							className='flex-1 py-[7px] rounded-[8px] text-[12px] cursor-pointer'
							style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.5)' }}>
							Відмова
						</button>
						<button onClick={() => joinBreakout(breakoutInvite.roomId)}
							className='flex-1 py-[7px] rounded-[8px] text-[12px] font-[600] cursor-pointer'
							style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
							Увійти
						</button>
					</div>
				</div>
			)}

			{/* Start overlay */}
			{startAnim && <GameStartOverlay onDone={() => setStartAnim(false)} />}

			{/* End overlay */}
			{endAnim && <GameEndOverlay onDone={() => setEndAnim(false)} />}

			{/* Modals */}
			{showCoinModal && me && (
				<CoinModal
					me={me}
					players={state.players}
					onTransfer={transferCoins}
					onPayBank={payBank}
					onClose={() => setShowCoin(false)}
				/>
			)}

			{showVoteModal && (
				<VotingModal
					onCreate={createVote}
					onClose={() => setShowVote(false)}
				/>
			)}

			{showTimerModal && (
				<TimerModal
					onSet={(label, secs) => { setTimer(label, secs) }}
					onClose={() => setShowTimer(false)}
				/>
			)}

			{showBreakout && (
				<BreakoutModal
					breakoutRooms={state.breakoutRooms}
					players={state.players}
					images={state.images}
					myId={myId}
					onCreate={createBreakout}
					onInvite={inviteBreakout}
					onEnd={endBreakout}
					onClose={() => setShowBreakout(false)}
				/>
			)}

			{/* Announcement editor (GM) */}
			{showAnnounce && (
				<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.75)' }}>
					<div className='w-[340px] rounded-[18px] p-[22px] flex flex-col gap-[14px]'
						style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}>
						<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>📢 Оголошення</h3>
						<textarea
							placeholder='Текст оголошення...'
							defaultValue={state.announcement ?? ''}
							id='announce-input'
							rows={3}
							className='w-full rounded-[10px] px-[12px] py-[9px] text-[13px] resize-none focus:outline-none'
							style={{ background: '#060e24', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(180,200,255,0.9)' }}
						/>
						<div className='flex gap-[8px]'>
							<button onClick={() => setShowAnnounce(false)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.5)' }}>
								Скасувати
							</button>
							<button onClick={() => {
								const el = document.getElementById('announce-input') as HTMLTextAreaElement
								announce(el?.value || null)
								setShowAnnounce(false)
							}}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer'
								style={{ background: 'rgba(200,168,48,0.1)', border: '1px solid rgba(200,168,48,0.3)', color: '#c8a830' }}>
								Опублікувати
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Image picker (GM) */}
			{showImgPicker && (
				<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.75)' }}>
					<div className='w-[360px] rounded-[18px] p-[22px] flex flex-col gap-[14px]'
						style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}>
						<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>🖼 Картинка для залу</h3>
						<div className='grid grid-cols-3 gap-[7px]'>
							{[state.coverImage, ...state.images].filter(Boolean).map((url, i) => (
								<button key={i} onClick={() => { showImage(url); setShowImgPicker(false) }}
									className='aspect-video rounded-[8px] overflow-hidden cursor-pointer transition-all'
									style={{ border: url === imageToShow ? '2px solid #0fffc8' : '2px solid rgba(68,170,255,0.15)' }}>
									<img src={url} alt='' className='w-full h-full object-cover' />
								</button>
							))}
						</div>
						<div className='flex gap-[8px]'>
							{imageToShow && (
								<button onClick={() => { showImage(null); setShowImgPicker(false) }}
									className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
									style={{ background: 'rgba(255,95,160,0.06)', border: '1px solid rgba(255,95,160,0.18)', color: 'rgba(255,95,160,0.7)' }}>
									Сховати картинку
								</button>
							)}
							<button onClick={() => setShowImgPicker(false)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.5)' }}>
								Закрити
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Stop game confirm modal */}
			{showStopConfirm && (
				<div className='fixed inset-0 z-[80] flex items-center justify-center' style={{ background: 'rgba(7,8,15,0.82)' }}>
					<div className='w-[320px] rounded-[18px] p-[22px] flex flex-col gap-[16px]'
						style={{ background: '#0b0d1a', border: '1px solid rgba(255,56,80,0.2)' }}>
						<h3 className='text-[15px] font-[700]' style={{ color: 'rgba(220,230,255,0.9)' }}>Зупинити гру?</h3>
						<p className='text-[13px]' style={{ color: 'rgba(100,140,220,0.6)' }}>
							Гру буде завершено для всіх учасників. Нотатки буде надіслано на вашу пошту.
						</p>
						<div className='flex gap-[8px]'>
							<button onClick={() => setShowStopConfirm(false)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.5)' }}>
								Скасувати
							</button>
							<button onClick={async () => {
								setShowStopConfirm(false)
								if (notes.trim() && authToken) {
									try {
										await fetch(`${API}/api/games/send-notes`, {
											method: 'POST',
											headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
											body: JSON.stringify({ notes: notes.trim(), gameTitle: state.title, gameCode }),
										})
									} catch (err) { console.error('[send-notes]', err) }
								}
								endGame()
							}}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer'
								style={{ background: 'rgba(255,56,80,0.1)', border: '1px solid rgba(255,56,80,0.3)', color: '#ff3850' }}>
								Зупинити
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Spectator vote modal (GM only) */}
			{showSpectatorVote && (
				<VotingModal
					onCreate={(q, opts, anon, multi) => { createSpectatorVote(q, opts, anon, multi); setShowSpectatorVote(false) }}
					onClose={() => setShowSpectatorVote(false)}
				/>
			)}
		</div>
	)
}

// ── Page wrapper with LiveKit provider ────────────────────────────────────────
function GameRoomInner() {
	const { code = '' } = useParams<{ code: string }>()
	const { user, isLoading } = useAuth()
	const room = useGameRoom(code)
	const { lk, lkBreakout, inBreakout, error, connStatus } = room

	const activeLk = inBreakout ? lkBreakout : lk

	if (isLoading) {
		return (
			<div className='w-screen h-screen flex items-center justify-center' style={{ background: '#07080f' }}>
				<span style={{ color: 'rgba(100,140,220,0.3)', fontSize: '13px' }}>Завантаження...</span>
			</div>
		)
	}

	if (!user) {
		return (
			<div className='w-screen h-screen flex items-center justify-center' style={{ background: '#07080f' }}>
				<span style={{ color: 'rgba(100,140,220,0.6)', fontSize: '14px' }}>Потрібна авторизація</span>
			</div>
		)
	}

	if (error) {
		return (
			<div className='w-screen h-screen flex items-center justify-center flex-col gap-[10px]' style={{ background: '#07080f' }}>
				<span className='text-[15px] font-[600]' style={{ color: '#ff3850' }}>Кімнату не знайдено</span>
				<span className='text-[12px]' style={{ color: 'rgba(100,140,220,0.4)' }}>Код: {code}</span>
			</div>
		)
	}

	if (!activeLk) {
		const msg = connStatus === 'failed'
			? 'Не вдалося підключитися до сервера'
			: connStatus === 'connected'
				? 'Отримання токена LiveKit...'
				: 'Підключення до сервера...'
		return (
			<div className='w-screen h-screen flex items-center justify-center flex-col gap-[14px]' style={{ background: '#07080f' }}>
				<div className='w-[8px] h-[8px] rounded-full pulse-dot-anim' style={{ background: connStatus === 'failed' ? '#ff3850' : '#0fffc8' }} />
				<span style={{ color: connStatus === 'failed' ? '#ff3850' : 'rgba(100,140,220,0.7)', fontSize: '13px' }}>{msg}</span>
				<span style={{ color: 'rgba(100,140,220,0.3)', fontSize: '11px' }}>Код кімнати: {code}</span>
			</div>
		)
	}

	return (
		<LiveKitRoom
			key={activeLk.roomName}
			token={activeLk.token}
			serverUrl={activeLk.url}
			connect={true}
			audio={false}
			video={false}
			style={{ height: '100vh', background: '#07080f' }}
		>
			<RoomContent room={room} gameCode={code} />
		</LiveKitRoom>
	)
}

export const GameRoomPage = () => (
	<RoomErrorBoundary>
		<GameRoomInner />
	</RoomErrorBoundary>
)
