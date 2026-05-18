import React, {
	useState,
	useCallback,
	useEffect,
	useRef,
	useMemo,
	Component,
	ReactNode,
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
	LiveKitRoom as LKRoom,
	RoomAudioRenderer as LKAudioRenderer,
	useLocalParticipant,
	useConnectionState,
	useRoomContext,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
const LiveKitRoom = LKRoom as React.ComponentType<any>
const RoomAudioRenderer = LKAudioRenderer as React.ComponentType<any>
import { useGameRoom } from '../../hooks/useGameRoom'
import { useAuth } from '../../context/AuthContext'
import { sfx } from '../../utils/sounds'
import { useMockParticipants } from '../../hooks/useMockParticipants'
import { DevToolbar } from '../gameroom/DevToolbar'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
import { AnnouncementBanner } from '../gameroom/AnnouncementBanner'
import { GameEndOverlay } from '../gameroom/GameEndOverlay'
import { GameStartOverlay } from '../gameroom/GameStartOverlay'
import { TimerFloatOverlay } from '../gameroom/TimerFloatOverlay'
import { SpeakerView } from '../gameroom/SpeakerView'
import { GridView } from '../gameroom/GridView'
import { ChatPanel } from '../gameroom/ChatPanel'
import { ChevronRight, Mic, MicOff, Video, VideoOff, PhoneOff, Smile, MessageSquare, Settings, CircleDollarSign, ScreenShare, ScreenShareOff } from 'lucide-react'
import { CoinModal } from '../gameroom/CoinModal'
import { VotingModal } from '../gameroom/VotingModal'
import { TimerModal } from '../gameroom/TimerModal'
import { BreakoutModal } from '../gameroom/BreakoutModal'
import { ModPanel } from '../gameroom/ModPanel'
import { PreJoinScreen } from '../gameroom/PreJoinScreen'
import { NEON_ICONS, NeonRaiseHand } from '../gameroom/NeonReactionIcon'
import { useTranslation } from 'react-i18next'

type RoomHook = ReturnType<typeof useGameRoom>

function ErrorDisplay({ message }: { message: string }) {
	const { t } = useTranslation()
	return (
		<div
			className='w-screen h-screen flex items-center justify-center flex-col gap-3'
			style={{ background: '#07080f' }}
		>
			<span style={{ color: '#ff3850', fontSize: '14px' }}>
				{t('room.error_prefix')} {message}
			</span>
		</div>
	)
}

class RoomErrorBoundary extends Component<
	{ children: ReactNode },
	{ err: string | null }
> {
	state = { err: null }
	static getDerivedStateFromError(e: Error) {
		return { err: e.message }
	}
	render() {
		if (this.state.err) {
			return <ErrorDisplay message={this.state.err} />
		}
		return this.props.children
	}
}

const MOBILE_REACTIONS = ['👍', '❤️', '😂', '🔥', '🤔', '😢', '😡']

const ROOM_INACTIVE = 'rgba(200,215,255,0.9)'
const ROOM_ACTIVE = '#0fffc8'

// Audio constraints passed both to LiveKitRoom options and to every
// setMicrophoneEnabled(true) call so old devices (e.g. Meizu M6 Note)
// can't silently ignore echoCancellation from the room-level defaults.
const AUDIO_CAPTURE_OPTS = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
}

// webAudioMix routes all remote audio through a shared WebAudio AudioContext,
// giving the browser's built-in AEC a consistent reference signal to cancel.
const LK_ROOM_OPTS = {
	audioCaptureDefaults: AUDIO_CAPTURE_OPTS,
	webAudioMix: true,
}

function MobileBarBtn({ icon, label, active, onClick, badge = 0 }: {
	icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number
}) {
	return (
		<button
			onClick={onClick}
			className='flex flex-col items-center justify-center gap-[5px] cursor-pointer transition-all flex-1 h-full'
			style={{ color: active ? ROOM_ACTIVE : ROOM_INACTIVE, background: active ? 'rgba(15,255,200,0.1)' : 'transparent' }}
		>
			<div className='relative' style={{ color: active ? ROOM_ACTIVE : ROOM_INACTIVE }}>
				{icon}
				{badge > 0 && (
					<span className='absolute flex items-center justify-center rounded-full font-[800]'
						style={{
							top: '-6px', right: '-8px',
							minWidth: '16px', height: '16px',
							padding: '0 3px',
							background: '#ff3850', color: '#fff', fontSize: '10px',
						}}>
						{badge > 9 ? '9+' : badge}
					</span>
				)}
			</div>
			<span className='text-[13px] font-[500] uppercase tracking-[0.05em]'>{label}</span>
		</button>
	)
}

// ── Inner room content (needs LiveKit context) ────────────────────────────────
function RoomContent({ room, gameCode, initMic, initCam }: {
	room: RoomHook; gameCode: string
	initMic: boolean; initCam: boolean
}) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const {
		state,
		me,
		isGM,
		myId,
		endAnim,
		setEndAnim,
		startAnim,
		setStartAnim,
		playerReactions,
		privateChats,
		unreadDMs,
		markDMRead,
		shouldMute,
		clearMuteSignal,
		newPublicMsgSignal,
		inBreakout,
		breakoutInvite,
		setBreakoutInvite,
		joinBreakout,
		leaveBreakout,
		sendChat,
		react,
		raiseHand,
		setRole,
		startGame,
		endGame,
		transferCoins,
		payBank,
		setInfluence,
		muteAll,
		mutePlayer,
		announce,
		setTimer,
		startTimer,
		stopTimer,
		clearTimer,
		createVote,
		castVote,
		closeVote,
		clearVote,
		createSpectatorVote,
		castSpectatorVote,
		closeSpectatorVote,
		clearSpectatorVote,
		createBreakout,
		inviteBreakout,
		endBreakout,
		showImage,
		isSpectatorJoin,
		recordStatus,
		recordControl,
		recordingActive,
	} = room

	const isSpectator = (me?.isSpectator ?? false) || isSpectatorJoin

	const {
		isDev, mockPlayers, mockSpeakingId, mockCount, mocksByRoom,
		addMockPlayers, moveAllMocksToRoom, clearMocksInRoom, clearMockPlayers,
	} = useMockParticipants()

	const handleOpenObserver = () => {
		window.open(`/room/${gameCode}/observe`, 'observer', 'width=1280,height=720,menubar=no,toolbar=no')
	}

	// Resolve timer and image for the current room context.
	// When in a breakout room, read from that room's own timer/image; otherwise main room.
	const activeBreakoutRoom = (state && inBreakout)
		? state.breakoutRooms.find(r => r.id === inBreakout) ?? null
		: null
	const activeTimer = (activeBreakoutRoom
		? (activeBreakoutRoom.timer ?? null)
		: (state?.timer ?? null)) ?? null
	const activeShownImageUrl = (activeBreakoutRoom
		? (activeBreakoutRoom.shownImageUrl ?? null)
		: (state?.shownImageUrl ?? null)) ?? null

	const { token: authToken } = useAuth()
	const lkRoom = useRoomContext()
	const { localParticipant } = useLocalParticipant()
	const [view, setView] = useState<'speaker' | 'grid'>('speaker')
	const [panelOpen, setPanelOpen] = useState(true)
	const [localImageHidden, setLocalImageHidden] = useState(false)
	const [micOn, setMicOn] = useState(initMic)
	const [camOn, setCamOn] = useState(initCam)
	const [screenOn, setScreenOn] = useState(false)
	const [showCoinModal, setShowCoin] = useState(false)
	const [showVoteModal, setShowVote] = useState(false)
	const [showTimerModal, setShowTimer] = useState(false)
	const [showBreakout, setShowBreakout] = useState(false)
	const [showAnnounce, setShowAnnounce] = useState(false)
	const [showImgPicker, setShowImgPicker] = useState(false)
	const [showStopConfirm, setShowStopConfirm] = useState(false)
	const [showSpectatorVote, setShowSpectatorVote] = useState(false)
	const [notes, setNotes] = useState('')
	const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
	const [mobilePanelOpen, setMobilePanelOpen] = useState<'media' | 'emoji' | 'chat' | 'settings' | null>(null)

	// ── Mobile resize detection ──────────────────────────────────────────────────
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>
		const handler = () => {
			clearTimeout(timer)
			timer = setTimeout(() => {
				const mobile = window.innerWidth < 768
				setIsMobile(mobile)
				if (!mobile) setMobilePanelOpen(null)
			}, 150)
		}
		window.addEventListener('resize', handler)
		return () => { window.removeEventListener('resize', handler); clearTimeout(timer) }
	}, [])

	// ── AudioContext unlock (mobile browsers require a user gesture) ──────────────
	useEffect(() => {
		const unlock = () => { lkRoom.startAudio() }
		document.addEventListener('click', unlock, { once: true })
		document.addEventListener('touchend', unlock, { once: true })
		return () => {
			document.removeEventListener('click', unlock)
			document.removeEventListener('touchend', unlock)
		}
	}, [lkRoom])

	// ── Unread chat counter ───────────────────────────────────────────────────────
	const [unreadChat, setUnreadChat] = useState(0)
	const chatVisible = (!isMobile && panelOpen) || (isMobile && mobilePanelOpen === 'chat')

	useEffect(() => {
		// Skip initial mount (signal === 0 means no message yet)
		if (newPublicMsgSignal === 0) return
		if (!chatVisible) setUnreadChat(prev => prev + 1)
	}, [newPublicMsgSignal]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (chatVisible) setUnreadChat(0)
	}, [chatVisible])

	// ── Wake Lock — prevent screen sleep ────────────────────────────────────────
	useEffect(() => {
		let wakeLock: any = null
		const acquire = async () => {
			try {
				if ('wakeLock' in navigator) {
					wakeLock = await (navigator as any).wakeLock.request('screen')
				}
			} catch {
				/* browser may deny on battery saver mode */
			}
		}
		acquire()
		const reacquire = () => {
			if (document.visibilityState === 'visible') acquire()
		}
		document.addEventListener('visibilitychange', reacquire)
		return () => {
			document.removeEventListener('visibilitychange', reacquire)
			if (wakeLock) wakeLock.release().catch(() => {})
		}
	}, [])

	// ── Sound effects ────────────────────────────────────────────────────────────
	const sfxInitRef = useRef(false)
	const raisedHandsRef = useRef<Set<string>>(new Set())
	const prevAnnouncRef = useRef<string | null>(null)
	const prevVoteIdRef = useRef<string | null>(null)

	useEffect(() => {
		if (!state) return
		if (!sfxInitRef.current) {
			// skip sounds on first load — just capture initial state
			sfxInitRef.current = true
			raisedHandsRef.current = new Set(
				state.players.filter(p => p.handRaised).map(p => p.userId),
			)
			prevAnnouncRef.current = state.announcement ?? null
			prevVoteIdRef.current = state.activeVote?.id ?? null
			return
		}

		// Hand raise
		state.players.forEach(p => {
			if (p.handRaised && !raisedHandsRef.current.has(p.userId)) sfx.handRaise()
		})
		raisedHandsRef.current = new Set(
			state.players.filter(p => p.handRaised).map(p => p.userId),
		)

		// Announcement appears
		if (state.announcement && !prevAnnouncRef.current) sfx.announcement()
		prevAnnouncRef.current = state.announcement ?? null

		// Vote appears
		const voteId = state.activeVote?.id ?? null
		if (voteId && voteId !== prevVoteIdRef.current) sfx.vote()
		prevVoteIdRef.current = voteId
	}, [state])

	// Mute All: GM can force-disable all participants' mics
	const connectionState = useConnectionState()
	useEffect(() => {
		if (!shouldMute || isSpectator || !localParticipant) return
		if (connectionState !== ConnectionState.Connected) return
		localParticipant.setMicrophoneEnabled(false)
		setMicOn(false)
		clearMuteSignal()
	}, [shouldMute, connectionState]) // eslint-disable-line react-hooks/exhaustive-deps

	// Apply pre-join media preferences once the LiveKit connection is fully established.
	// localParticipant exists before ConnectionState.Connected, so gating on connection
	// state is the only reliable way to ensure setMicrophoneEnabled actually publishes.
	const autoMediaRef = useRef(false)
	useEffect(() => {
		if (connectionState !== ConnectionState.Connected || isSpectator || autoMediaRef.current) return
		autoMediaRef.current = true
		if (initMic) {
			localParticipant?.setMicrophoneEnabled(true, AUDIO_CAPTURE_OPTS).catch(() => setMicOn(false))
		}
		if (initCam) {
			localParticipant?.setCameraEnabled(true).catch(() => setCamOn(false))
		}
	}, [connectionState]) // eslint-disable-line react-hooks/exhaustive-deps

	const toggleMic = useCallback(async () => {
		if (!localParticipant) return
		// Read actual track state from LiveKit, not from potentially-stale React state.
		// This prevents desync when the user clicks rapidly or when the track was
		// muted externally (e.g. by GM's mute-all).
		const enabled = !localParticipant.isMicrophoneEnabled
		try {
			await localParticipant.setMicrophoneEnabled(enabled, enabled ? AUDIO_CAPTURE_OPTS : undefined)
			setMicOn(enabled)
		} catch {
			setMicOn(localParticipant.isMicrophoneEnabled)
		}
	}, [localParticipant])

	const toggleCam = useCallback(async () => {
		if (!localParticipant) return
		const enabled = !localParticipant.isCameraEnabled
		try {
			await localParticipant.setCameraEnabled(enabled)
			setCamOn(enabled)
		} catch {
			setCamOn(localParticipant.isCameraEnabled)
		}
	}, [localParticipant])

	const toggleScreen = useCallback(async () => {
		if (!localParticipant) return
		const enabled = !screenOn
		try {
			await localParticipant.setScreenShareEnabled(enabled)
			setScreenOn(enabled)
		} catch {
			// user cancelled the screen picker dialog
		}
	}, [localParticipant, screenOn])

	useEffect(() => { setLocalImageHidden(false) }, [activeShownImageUrl])

	const handleLeave = () => navigate('/games')

	if (!state) {
		return (
			<div
				className='w-screen h-screen flex items-center justify-center flex-col gap-3'
				style={{ background: '#07080f' }}
			>
				<div className='w-[6px] h-[6px] rounded-full bg-[#0fffc8] pulse-dot-anim' />
				<span
					className='text-[12px]'
					style={{ color: 'rgba(100,140,220,0.3)' }}
				>
					{t('room.loading')}
				</span>
			</div>
		)
	}

	const mainPlayers = state.players.filter(p => !p.breakoutRoomId)
	const imageToShow = !isGM && localImageHidden ? null : activeShownImageUrl
	// State with room-scoped timer/image for panel components (ChatPanel, ModPanel).
	// Memoized to avoid re-rendering panels on every state update that doesn't affect them.
	const panelState = useMemo(
		() => ({ ...state, timer: activeTimer, shownImageUrl: activeShownImageUrl }),
		[state, activeTimer, activeShownImageUrl],
	)

	return (
		<div
			className='w-screen h-screen flex flex-col overflow-hidden'
			style={{
				background: '#07080f',
				color: '#dde1f0',
				fontFamily: "'Segoe UI', sans-serif",
				fontSize: '14px',
			}}
		>
			<RoomAudioRenderer />

			{/* Announcement banner */}
			<AnnouncementBanner
				text={state.announcement ?? null}
				isGM={isGM}
				onClose={() => announce(null)}
			/>

			{/* Recording active banner */}
			{recordingActive && (
				<div className='flex-shrink-0 flex items-center justify-center gap-[8px] py-[5px] px-[16px]'
					style={{ background: 'rgba(255,56,80,0.12)', borderBottom: '1px solid rgba(255,56,80,0.25)' }}>
					<span style={{ color: '#ff3850', fontSize: '11px' }}>●</span>
					<span style={{ color: 'rgba(255,56,80,0.9)', fontSize: '12px', fontWeight: 600 }}>
						{t('room.recording_active')}
					</span>
				</div>
			)}

			{/* Lobby / restart button */}
			{(state.status === 'lobby' || state.status === 'ended') && isGM && (
				<div
					className='flex-shrink-0 flex items-center justify-center gap-[10px] py-[8px] px-[16px]'
					style={{
						background: 'rgba(15,255,200,0.06)',
						borderBottom: '1px solid rgba(15,255,200,0.12)',
					}}
				>
					<span
						className='text-[12px]'
						style={{ color: 'rgba(15,255,200,0.5)' }}
					>
						{t('room.player_count')}{mainPlayers.filter(p => !p.isGamemaster).length}
					</span>
					<button
						onClick={startGame}
						className='px-[20px] py-[6px] rounded-[8px] text-[12px] font-[700] cursor-pointer transition-all hover:-translate-y-[1px]'
						style={{
							background: 'rgba(15,255,200,0.12)',
							border: '1px solid rgba(15,255,200,0.35)',
							color: '#0fffc8',
						}}
					>
						{t('room.start_game')}
					</button>
				</div>
			)}

			{/* Main content area */}
			<div className='flex-1 flex overflow-hidden min-h-0'>
				{/* Left / Main area */}
				<div className='flex-1 flex flex-col overflow-hidden min-w-0 relative'>
					{/* Floating timer overlay — uses current room's timer */}
					{activeTimer && <TimerFloatOverlay timer={activeTimer} />}

					{/* View switcher */}
					<div
						className='flex-shrink-0 flex items-center gap-[8px] px-[12px] py-[8px]'
						style={{ background: '#0b0d1a', borderBottom: '1px solid #151824' }}
					>
						<span className='text-[12px] font-[500]' style={{ color: '#8892b8' }}>
							{t('room.view_label')}
						</span>
						{(['speaker', 'grid'] as const).map(v => (
							<button
								key={v}
								onClick={() => setView(v)}
								className='px-[14px] py-[6px] rounded-[7px] text-[13px] font-[500] cursor-pointer transition-all'
								style={{
									background: view === v ? 'rgba(15,255,200,0.1)' : '#0f1120',
									border:
										view === v
											? '1px solid rgba(15,255,200,0.35)'
											: '1px solid rgba(120,135,185,0.38)',
									color: view === v ? '#0fffc8' : '#9aabcc',
								}}
							>
								{v === 'speaker' ? t('room.view_speaker') : t('room.view_grid')}
							</button>
						))}

						{/* GM breakout room indicator — shown when GM has entered a breakout */}
						{isGM && inBreakout && (
							<div className='flex items-center gap-[6px] px-[9px] py-[3px] rounded-[7px]'
								style={{ background: 'rgba(15,255,200,0.06)', border: '1px solid rgba(15,255,200,0.2)' }}>
								<span className='text-[11px]' style={{ color: 'rgba(15,255,200,0.8)' }}>
									🚪 {state.breakoutRooms.find(r => r.id === inBreakout)?.name ?? '...'}
								</span>
								<button
									onClick={leaveBreakout}
									className='text-[10px] px-[6px] py-[1px] rounded-[4px] cursor-pointer transition-all hover:brightness-125'
									style={{ background: 'rgba(255,95,160,0.08)', border: '1px solid rgba(255,95,160,0.25)', color: 'rgba(255,95,160,0.85)' }}>
									{t('room.leave_breakout')}
								</button>
							</div>
						)}

						{/* Image toggle button — GM always sees it; others only when an image is shown */}
						{(activeShownImageUrl || isGM) && (
							<button
								onClick={() =>
									isGM
										? setShowImgPicker(true)
										: setLocalImageHidden(v => !v)
								}
								className='ml-auto px-[10px] py-[4px] rounded-[6px] text-[10px] cursor-pointer transition-all'
								style={{
									background: imageToShow
										? 'rgba(68,170,255,0.08)'
										: 'transparent',
									border: imageToShow
										? '1px solid rgba(68,170,255,0.25)'
										: '1px solid transparent',
									color: 'rgba(68,170,255,0.5)',
								}}
							>
								{t('room.image_btn')}
							</button>
						)}

						{/* Coin button (non-GM players) */}
						{!isGM && me && (
							<button
								onClick={() => setShowCoin(true)}
								className='flex items-center gap-[4px] px-[10px] py-[4px] rounded-[6px] text-[10px] cursor-pointer transition-all'
								style={{
									background: 'rgba(200,168,48,0.06)',
									border: '1px solid rgba(200,168,48,0.2)',
									color: 'rgba(200,168,48,0.8)',
								}}
							>
								<CircleDollarSign size={11} /> {me.coins}
							</button>
						)}
						{/* Bank button (GM only) */}
						{isGM && state.coinsPerPlayer > 0 && (
							<button
								onClick={() => setShowCoin(true)}
								className='px-[10px] py-[4px] rounded-[6px] text-[10px] cursor-pointer transition-all'
								style={{
									background: 'rgba(200,168,48,0.06)',
									border: '1px solid rgba(200,168,48,0.2)',
									color: 'rgba(200,168,48,0.8)',
								}}
							>
								🏦 {state.bankCoins}
							</button>
						)}

						{/* DEV ONLY — mock participant testing toolbar */}
						{isDev && (
							<DevToolbar
								mockCount={mockCount}
								mocksByRoom={mocksByRoom}
								breakoutRooms={state.breakoutRooms.map(r => ({ id: r.id, name: r.name }))}
								onAdd={addMockPlayers}
								onMoveAll={moveAllMocksToRoom}
								onClearRoom={clearMocksInRoom}
								onClearAll={clearMockPlayers}
							/>
						)}
					</div>

					{/* View content */}
					{view === 'speaker' ? (
						<SpeakerView
							state={state}
							myId={myId}
							isGM={isGM}
							isSpectator={isSpectator}
							isMobile={isMobile}
							micOn={micOn}
							camOn={camOn}
							screenOn={screenOn}
							onToggleMic={toggleMic}
							onToggleCam={toggleCam}
							onToggleScreen={toggleScreen}
							onReact={react}
							onRaiseHand={raiseHand}
							onLeave={handleLeave}
							imageUrl={imageToShow}
							images={state.images}
							onImageClose={() => showImage(null)}
							onChangeImage={url => showImage(url)}
							playerReactions={playerReactions}
							onMutePlayer={mutePlayer}
							mockPlayers={mockPlayers}
							mockSpeakingId={mockSpeakingId}
							inBreakout={inBreakout}
						/>
					) : (
						<GridView
							state={state}
							myId={myId}
							isGM={isGM}
							isSpectator={isSpectator}
							isMobile={isMobile}
							micOn={micOn}
							camOn={camOn}
							screenOn={screenOn}
							onToggleMic={toggleMic}
							onToggleCam={toggleCam}
							onToggleScreen={toggleScreen}
							onReact={react}
							onRaiseHand={raiseHand}
							onLeave={handleLeave}
							onSetRole={setRole}
							onSetInfluence={setInfluence}
							onMutePlayer={mutePlayer}
							playerReactions={playerReactions}
							mockPlayers={mockPlayers}
							mockSpeakingId={mockSpeakingId}
							inBreakout={inBreakout}
						/>
					)}
				</div>

				{/* Collapse toggle — desktop only */}
				{!isMobile && (
					<button
						onClick={() => setPanelOpen(v => !v)}
						title={panelOpen ? t('room.close_chat') : t('room.open_chat')}
						className='flex-shrink-0 w-[28px] flex flex-col items-center justify-center gap-[5px] cursor-pointer transition-all hover:brightness-125'
						style={{
							background: unreadChat > 0 && !panelOpen ? 'rgba(255,56,80,0.06)' : '#0b0d1a',
							borderLeft: '1px solid #1c2035',
							color: unreadChat > 0 && !panelOpen ? '#ff5870' : 'rgba(100,170,255,0.9)',
						}}
					>
						{panelOpen ? <ChevronRight size={16} /> : <MessageSquare size={16} />}
						{unreadChat > 0 && !panelOpen && (
							<span className='flex items-center justify-center rounded-full font-[800]'
								style={{
									minWidth: '18px', height: '18px', padding: '0 3px',
									background: '#ff3850', color: '#fff', fontSize: '10px',
								}}>
								{unreadChat > 9 ? '9+' : unreadChat}
							</span>
						)}
					</button>
				)}

				{/* Right panel: Chat + Tools — desktop only */}
				{panelOpen && !isMobile && (
					<div className='flex-shrink-0 w-[239px] lg:w-[366px] flex flex-col overflow-hidden min-h-0'>
						<ChatPanel
							state={panelState}
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
							onOpenObserver={handleOpenObserver}
							onRecordStart={() => recordControl('start')}
							onRecordStop={() => recordControl('stop')}
							recordStatus={recordStatus}
							privateChats={privateChats}
							unreadDMs={unreadDMs}
							onMarkDMRead={markDMRead}
						/>
					</div>
				)}
			</div>

			{/* Mobile bottom bar */}
			{isMobile && (
				<div className='flex-shrink-0 flex items-stretch'
					style={{
						height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
						paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						background: '#0d1228',
						borderTop: '1px solid rgba(15,255,200,0.28)',
						boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
						position: 'relative',
						zIndex: 60,
					}}>
					<MobileBarBtn
						icon={<Mic size={22} />}
						label={t('room.bar_media')}
						active={mobilePanelOpen === 'media'}
						onClick={() => setMobilePanelOpen(mobilePanelOpen === 'media' ? null : 'media')}
					/>
					<MobileBarBtn
						icon={<Smile size={22} />}
						label={t('room.bar_emoji')}
						active={mobilePanelOpen === 'emoji'}
						onClick={() => setMobilePanelOpen(mobilePanelOpen === 'emoji' ? null : 'emoji')}
					/>
					<MobileBarBtn
						icon={<MessageSquare size={22} />}
						label={t('room.bar_chat')}
						active={mobilePanelOpen === 'chat'}
						onClick={() => setMobilePanelOpen(mobilePanelOpen === 'chat' ? null : 'chat')}
						badge={mobilePanelOpen !== 'chat' ? unreadChat : 0}
					/>
					{isGM && (
						<MobileBarBtn
							icon={<Settings size={22} />}
							label={t('room.bar_panel')}
							active={mobilePanelOpen === 'settings'}
							onClick={() => setMobilePanelOpen(mobilePanelOpen === 'settings' ? null : 'settings')}
						/>
					)}
				</div>
			)}

			{/* Mobile panels */}
			{isMobile && mobilePanelOpen && (
				<>
					<style>{'@keyframes slideUpPanel{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}'}</style>
					<div className='fixed inset-0 z-[54]' style={{ background: 'rgba(0,0,0,0.35)' }} onClick={() => setMobilePanelOpen(null)} />
					{mobilePanelOpen === 'media' && (
						<div className='fixed left-0 right-0 z-[55] flex items-center justify-around px-[16px] py-[12px]'
							style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', background: '#0d1228', borderTop: '1px solid rgba(15,255,200,0.2)', animation: 'slideUpPanel 0.18s ease-out' }}>
							{!isSpectator && (
								<button onClick={toggleMic}
									className='flex flex-col items-center gap-[6px] rounded-[12px] px-[20px] py-[10px] cursor-pointer transition-all'
									style={micOn ? { background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' } : { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }}>
									{micOn ? <Mic size={22} /> : <MicOff size={22} />}
									<span className='text-[11px]'>{t('room.mic_label')}</span>
								</button>
							)}
							{!isSpectator && (
								<button onClick={toggleCam}
									className='flex flex-col items-center gap-[6px] rounded-[12px] px-[20px] py-[10px] cursor-pointer transition-all'
									style={camOn ? { background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' } : { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }}>
									{camOn ? <Video size={22} /> : <VideoOff size={22} />}
									<span className='text-[11px]'>{t('room.cam_label')}</span>
								</button>
							)}
							{!isSpectator && (
								<button onClick={toggleScreen}
									className='flex flex-col items-center gap-[6px] rounded-[12px] px-[20px] py-[10px] cursor-pointer transition-all'
									style={screenOn ? { background: 'rgba(68,170,255,0.08)', border: '1px solid rgba(68,170,255,0.3)', color: '#44aaff' } : { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }}>
									{screenOn ? <ScreenShareOff size={22} /> : <ScreenShare size={22} />}
									<span className='text-[11px]'>{t('room.screen_label')}</span>
								</button>
							)}
							<button onClick={handleLeave}
								className='flex flex-col items-center gap-[6px] rounded-[12px] px-[20px] py-[10px] cursor-pointer transition-all'
								style={{ background: 'rgba(255,56,80,0.08)', border: '1px solid rgba(255,56,80,0.25)', color: '#ff3850' }}>
								<PhoneOff size={22} />
								<span className='text-[11px]'>{t('room.leave_label')}</span>
							</button>
						</div>
					)}
					{mobilePanelOpen === 'emoji' && (
						<div className='fixed left-0 right-0 z-[55] flex flex-wrap items-center justify-center gap-[4px] px-[12px] py-[10px]'
							style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', background: '#0d1228', borderTop: '1px solid rgba(15,255,200,0.2)', animation: 'slideUpPanel 0.18s ease-out' }}>
							{MOBILE_REACTIONS.map(emoji => (
								<button key={emoji} onClick={() => react(emoji)}
									className='flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110'
									style={{ width: '46px', height: '46px', background: 'transparent', borderRadius: '10px' }}>
									{React.createElement(NEON_ICONS[emoji] ?? NEON_ICONS['👍'], { size: 32 })}
								</button>
							))}
							{!isSpectator && me && (
								<button onClick={() => raiseHand(!(me.handRaised ?? false))}
									className='flex flex-col items-center justify-center cursor-pointer transition-all'
									style={{ width: '46px', height: '46px', background: (me.handRaised ?? false) ? 'rgba(200,168,48,0.08)' : 'transparent', borderRadius: '10px' }}>
									<NeonRaiseHand size={32} active={me.handRaised ?? false} />
								</button>
							)}
						</div>
					)}
					{mobilePanelOpen === 'chat' && (
						<div className='fixed left-0 right-0 z-[55] flex flex-col'
							style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', height: '72vh', background: '#0d1228', borderTop: '1px solid rgba(15,255,200,0.2)', animation: 'slideUpPanel 0.18s ease-out' }}>
							<ChatPanel
								state={panelState} myId={myId} isGM={isGM} isSpectator={isSpectator}
								notes={notes} onNotesChange={setNotes}
								onSendChat={sendChat} onCastVote={castVote} onCloseVote={closeVote} onClearVote={clearVote}
								onCastSpectatorVote={castSpectatorVote} onCloseSpectatorVote={closeSpectatorVote} onClearSpectatorVote={clearSpectatorVote}
								onAnnounce={() => setShowAnnounce(true)} onVoting={() => setShowVote(true)} onSpectatorVoting={() => setShowSpectatorVote(true)}
								onMuteAll={muteAll} onEndGame={() => setShowStopConfirm(true)} onTimer={() => setShowTimer(true)}
								onTimerStart={startTimer} onTimerStop={stopTimer} onTimerClear={clearTimer} onBreakout={() => setShowBreakout(true)}
								showMod={false}
								privateChats={privateChats}
								unreadDMs={unreadDMs}
								onMarkDMRead={markDMRead}
							/>
						</div>
					)}
					{mobilePanelOpen === 'settings' && isGM && (
						<div className='fixed left-0 right-0 z-[55]'
							style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', background: '#0d1228', borderTop: '1px solid rgba(15,255,200,0.2)', animation: 'slideUpPanel 0.18s ease-out' }}>
							<ModPanel
								state={panelState}
								onAnnounce={() => { setShowAnnounce(true); setMobilePanelOpen(null) }}
								onVoting={() => { setShowVote(true); setMobilePanelOpen(null) }}
								onSpectatorVoting={() => { setShowSpectatorVote(true); setMobilePanelOpen(null) }}
								onMuteAll={muteAll}
								onEndGame={() => { setShowStopConfirm(true); setMobilePanelOpen(null) }}
								onTimer={() => { setShowTimer(true); setMobilePanelOpen(null) }}
								onTimerStart={startTimer}
								onTimerStop={stopTimer}
								onTimerClear={clearTimer}
								onBreakout={() => { setShowBreakout(true); setMobilePanelOpen(null) }}
								onOpenObserver={handleOpenObserver}
								onRecordStart={() => recordControl('start')}
								onRecordStop={() => recordControl('stop')}
								recordStatus={recordStatus}
							/>
						</div>
					)}
				</>
			)}

			{/* Breakout invite */}
			{breakoutInvite && (
				<div
					className='fixed bottom-[20px] right-[20px] z-[90] rounded-[14px] p-[16px] w-[280px]'
					style={{
						background: '#0b0d1a',
						border: '1px solid rgba(68,170,255,0.25)',
						boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
					}}
				>
					<p
						className='text-[13px] font-[600] mb-[6px]'
						style={{ color: 'rgba(220,230,255,0.9)' }}
					>
						{t('room.breakout_invite_title')}
					</p>
					<p
						className='text-[12px] mb-[12px]'
						style={{ color: 'rgba(100,140,220,0.6)' }}
					>
						{breakoutInvite.roomName}
					</p>
					<div className='flex gap-[7px]'>
						<button
							onClick={() => setBreakoutInvite(null)}
							className='flex-1 py-[7px] rounded-[8px] text-[12px] cursor-pointer'
							style={{
								background: 'rgba(15,17,32,0.5)',
								border: '1px solid rgba(68,170,255,0.12)',
								color: 'rgba(100,140,220,0.5)',
							}}
						>
							{t('room.breakout_decline')}
						</button>
						<button
							onClick={() => joinBreakout(breakoutInvite.roomId)}
							className='flex-1 py-[7px] rounded-[8px] text-[12px] font-[600] cursor-pointer'
							style={{
								background: 'rgba(15,255,200,0.1)',
								border: '1px solid rgba(15,255,200,0.3)',
								color: '#0fffc8',
							}}
						>
							{t('room.breakout_join')}
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
				<VotingModal onCreate={createVote} onClose={() => setShowVote(false)} />
			)}

			{showTimerModal && (
				<TimerModal
					onSet={(label, secs) => {
						setTimer(label, secs)
					}}
					onClose={() => setShowTimer(false)}
				/>
			)}

			{showBreakout && (
				<BreakoutModal
					breakoutRooms={state.breakoutRooms}
					players={state.players}
					images={state.images}
					myId={myId}
					inBreakout={inBreakout}
					onCreate={createBreakout}
					onInvite={inviteBreakout}
					onJoin={roomId => { joinBreakout(roomId); setShowBreakout(false) }}
					onEnd={endBreakout}
					onClose={() => setShowBreakout(false)}
				/>
			)}

			{/* Announcement editor (GM) */}
			{showAnnounce && (
				<div
					className='fixed inset-0 z-[80] flex items-center justify-center'
					style={{ background: 'rgba(7,8,15,0.75)' }}
				>
					<div
						className='w-[340px] rounded-[18px] p-[22px] flex flex-col gap-[14px]'
						style={{
							background: '#0b0d1a',
							border: '1px solid rgba(68,170,255,0.18)',
						}}
					>
						<h3
							className='text-[15px] font-[700]'
							style={{ color: 'rgba(220,230,255,0.9)' }}
						>
							{t('room.announce_title')}
						</h3>
						<textarea
							placeholder={t('room.announce_placeholder')}
							defaultValue={state.announcement ?? ''}
							id='announce-input'
							rows={3}
							className='w-full rounded-[10px] px-[12px] py-[9px] text-[13px] resize-none focus:outline-none'
							style={{
								background: '#060e24',
								border: '1px solid rgba(68,170,255,0.2)',
								color: 'rgba(180,200,255,0.9)',
							}}
						/>
						<div className='flex gap-[8px]'>
							<button
								onClick={() => setShowAnnounce(false)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{
									background: 'rgba(15,17,32,0.5)',
									border: '1px solid rgba(68,170,255,0.12)',
									color: 'rgba(100,140,220,0.5)',
								}}
							>
								{t('room.cancel')}
							</button>
							<button
								onClick={() => {
									const el = document.getElementById(
										'announce-input',
									) as HTMLTextAreaElement
									announce(el?.value || null)
									setShowAnnounce(false)
								}}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer'
								style={{
									background: 'rgba(200,168,48,0.1)',
									border: '1px solid rgba(200,168,48,0.3)',
									color: '#c8a830',
								}}
							>
								{t('room.publish')}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Image picker (GM) */}
			{showImgPicker && (
				<div
					className='fixed inset-0 z-[80] flex items-center justify-center'
					style={{ background: 'rgba(7,8,15,0.75)' }}
				>
					<div
						className='w-[360px] rounded-[18px] p-[22px] flex flex-col gap-[14px]'
						style={{
							background: '#0b0d1a',
							border: '1px solid rgba(68,170,255,0.18)',
						}}
					>
						<h3
							className='text-[15px] font-[700]'
							style={{ color: 'rgba(220,230,255,0.9)' }}
						>
							{t('room.image_picker_title')}
						</h3>
						<div className='grid grid-cols-3 gap-[7px]'>
							{[state.coverImage, ...state.images]
								.filter(Boolean)
								.map((url, i) => (
									<button
										key={i}
										onClick={() => {
											showImage(url)
											setShowImgPicker(false)
										}}
										className='aspect-video rounded-[8px] overflow-hidden cursor-pointer transition-all'
										style={{
											border:
												url === imageToShow
													? '2px solid #0fffc8'
													: '2px solid rgba(68,170,255,0.15)',
										}}
									>
										<img
											src={url}
											alt=''
											className='w-full h-full object-cover'
										/>
									</button>
								))}
						</div>
						<div className='flex gap-[8px]'>
							{imageToShow && (
								<button
									onClick={() => {
										showImage(null)
										setShowImgPicker(false)
									}}
									className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
									style={{
										background: 'rgba(255,95,160,0.06)',
										border: '1px solid rgba(255,95,160,0.18)',
										color: 'rgba(255,95,160,0.7)',
									}}
								>
									{t('room.hide_image')}
								</button>
							)}
							<button
								onClick={() => setShowImgPicker(false)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{
									background: 'rgba(15,17,32,0.5)',
									border: '1px solid rgba(68,170,255,0.12)',
									color: 'rgba(100,140,220,0.5)',
								}}
							>
								{t('room.close')}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Stop game confirm modal */}
			{showStopConfirm && (
				<div
					className='fixed inset-0 z-[80] flex items-center justify-center'
					style={{ background: 'rgba(7,8,15,0.82)' }}
				>
					<div
						className='w-[320px] rounded-[18px] p-[22px] flex flex-col gap-[16px]'
						style={{
							background: '#0b0d1a',
							border: '1px solid rgba(255,56,80,0.2)',
						}}
					>
						<h3
							className='text-[15px] font-[700]'
							style={{ color: 'rgba(220,230,255,0.9)' }}
						>
							{t('room.stop_confirm_title')}
						</h3>
						<p
							className='text-[13px]'
							style={{ color: 'rgba(100,140,220,0.6)' }}
						>
							{t('room.stop_confirm_msg')}
						</p>
						<div className='flex gap-[8px]'>
							<button
								onClick={() => setShowStopConfirm(false)}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
								style={{
									background: 'rgba(15,17,32,0.5)',
									border: '1px solid rgba(68,170,255,0.12)',
									color: 'rgba(100,140,220,0.5)',
								}}
							>
								{t('room.cancel')}
							</button>
							<button
								onClick={async () => {
									setShowStopConfirm(false)
									if (notes.trim() && authToken) {
										try {
											await fetch(`${API}/api/games/send-notes`, {
												method: 'POST',
												headers: {
													'Content-Type': 'application/json',
													Authorization: `Bearer ${authToken}`,
												},
												body: JSON.stringify({
													notes: notes.trim(),
													gameTitle: state.title,
													gameCode,
												}),
											})
										} catch (err) {
											console.error('[send-notes]', err)
										}
									}
									endGame()
								}}
								className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer'
								style={{
									background: 'rgba(255,56,80,0.1)',
									border: '1px solid rgba(255,56,80,0.3)',
									color: '#ff3850',
								}}
							>
								{t('room.stop_confirm_yes')}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Spectator vote modal (GM only) */}
			{showSpectatorVote && (
				<VotingModal
					onCreate={(q, opts, anon, multi) => {
						createSpectatorVote(q, opts, anon, multi)
						setShowSpectatorVote(false)
					}}
					onClose={() => setShowSpectatorVote(false)}
				/>
			)}
		</div>
	)
}

// ── Page wrapper with LiveKit provider ────────────────────────────────────────
function GameRoomInner() {
	const { t } = useTranslation()
	const { code = '' } = useParams<{ code: string }>()
	const { user, isLoading } = useAuth()
	const room = useGameRoom(code)
	const { lk, lkBreakout, inBreakout, error, connStatus } = room

	const activeLk = inBreakout ? lkBreakout : lk

	// Pre-join screen — shown once before the first LiveKit connection.
	// The user selects their mic/cam preferences here; those choices seed
	// the UI state inside RoomContent so it's always in sync with the actual tracks.
	const [preJoinDone, setPreJoinDone] = useState(false)
	const [initMic, setInitMic] = useState(false)
	const [initCam, setInitCam] = useState(false)

	if (isLoading) {
		return (
			<div
				className='w-screen h-screen flex items-center justify-center'
				style={{ background: '#07080f' }}
			>
				<span style={{ color: 'rgba(100,140,220,0.3)', fontSize: '13px' }}>
					{t('room.loading')}
				</span>
			</div>
		)
	}

	if (!user) {
		return (
			<div
				className='w-screen h-screen flex items-center justify-center'
				style={{ background: '#07080f' }}
			>
				<span style={{ color: 'rgba(100,140,220,0.6)', fontSize: '14px' }}>
					{t('room.auth_required')}
				</span>
			</div>
		)
	}

	if (error) {
		return (
			<div
				className='w-screen h-screen flex items-center justify-center flex-col gap-[10px]'
				style={{ background: '#07080f' }}
			>
				<span className='text-[15px] font-[600]' style={{ color: '#ff3850' }}>
					{t('room.not_found')}
				</span>
				<span
					className='text-[12px]'
					style={{ color: 'rgba(100,140,220,0.4)' }}
				>
					Код: {code}
				</span>
			</div>
		)
	}

	if (!activeLk) {
		const msg =
			connStatus === 'failed'
				? t('room.conn_failed')
				: connStatus === 'connected'
					? t('room.getting_token')
					: t('room.connecting_server')
		return (
			<div
				className='w-screen h-screen flex items-center justify-center flex-col gap-[14px]'
				style={{ background: '#07080f' }}
			>
				<div
					className='w-[8px] h-[8px] rounded-full pulse-dot-anim'
					style={{
						background: connStatus === 'failed' ? '#ff3850' : '#0fffc8',
					}}
				/>
				<span
					style={{
						color:
							connStatus === 'failed' ? '#ff3850' : 'rgba(100,140,220,0.7)',
						fontSize: '13px',
					}}
				>
					{msg}
				</span>
				<span style={{ color: 'rgba(100,140,220,0.3)', fontSize: '11px' }}>
					{t('room.room_code')}{code}
				</span>
			</div>
		)
	}

	// Show pre-join once — before LiveKit connects for the first time.
	// Breakout room switches (inBreakout changes) skip pre-join since preJoinDone stays true.
	if (!preJoinDone) {
		const userName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.name || ''
		return (
			<PreJoinScreen
				roomTitle={room.state?.title ?? ''}
				userName={userName}
				onJoin={(mic, cam) => {
					setInitMic(mic)
					setInitCam(cam)
					setPreJoinDone(true)
				}}
			/>
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
			options={LK_ROOM_OPTS}
			style={{ height: '100vh', background: '#07080f' }}
		>
			<RoomContent room={room} gameCode={code} initMic={initMic} initCam={initCam} />
		</LiveKitRoom>
	)
}

export const GameRoomPage = () => (
	<RoomErrorBoundary>
		<GameRoomInner />
	</RoomErrorBoundary>
)
