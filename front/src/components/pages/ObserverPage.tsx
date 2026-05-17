import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import {
	LiveKitRoom as LKRoom,
	RoomAudioRenderer as LKAudioRenderer,
} from '@livekit/components-react'
const LiveKitRoom = LKRoom as React.ComponentType<any>
const RoomAudioRenderer = LKAudioRenderer as React.ComponentType<any>
import { useAuth } from '../../context/AuthContext'
import { useObserverRoom } from '../../hooks/useObserverRoom'
import { useRecording } from '../../hooks/useRecording'
import { ObserverView } from '../gameroom/ObserverView'

function ObserverInner({ gameCode }: { gameCode: string }) {
	const { t } = useTranslation()
	const { user, token: authToken } = useAuth()
	const {
		state, lk, error, connStatus,
		recordSignal, setRecordSignal,
		messages, sendStatus, sendChat, myId,
		startAnim, setStartAnim,
		endAnim, setEndAnim,
	} = useObserverRoom(gameCode)

	const gameTitle = state?.title ?? ''
	const recording = useRecording(gameCode, gameTitle, authToken ?? null, status => {
		sendStatus(status)
	})

	// React to record signals from GM
	useEffect(() => {
		if (!recordSignal) return
		if (recordSignal === 'start' && recording.status === 'prepared') {
			recording.start()
		} else if (recordSignal === 'stop' && recording.status === 'recording') {
			recording.stop()
		}
		setRecordSignal(null)
	}, [recordSignal]) // eslint-disable-line react-hooks/exhaustive-deps

	if (!user) {
		return (
			<div className='w-screen h-screen flex items-center justify-center' style={{ background: '#07080f' }}>
				<span style={{ color: 'rgba(100,140,220,0.6)', fontSize: '14px' }}>{t('room.auth_required')}</span>
			</div>
		)
	}

	if (error) {
		return (
			<div className='w-screen h-screen flex items-center justify-center flex-col gap-[10px]' style={{ background: '#07080f' }}>
				<span style={{ color: '#ff3850', fontSize: '14px' }}>{error}</span>
			</div>
		)
	}

	if (!lk || connStatus !== 'connected' || !state) {
		return (
			<div className='w-screen h-screen flex items-center justify-center flex-col gap-[14px]' style={{ background: '#07080f' }}>
				<div className='w-[8px] h-[8px] rounded-full pulse-dot-anim' style={{ background: '#0fffc8' }} />
				<span style={{ color: 'rgba(100,140,220,0.5)', fontSize: '13px' }}>
					{connStatus === 'failed' ? t('room.conn_error') : t('room.connecting')}
				</span>
			</div>
		)
	}

	return (
		<LiveKitRoom
			key={lk.roomName}
			token={lk.token}
			serverUrl={lk.url}
			connect={true}
			audio={false}
			video={false}
			style={{ height: '100vh', background: '#07080f' }}
		>
			<RoomAudioRenderer />
			<ObserverView
				state={state}
				myId={myId}
				messages={messages}
				onSendChat={sendChat}
				recordingStatus={recording.status}
				uploadProgress={recording.uploadProgress}
				shareLink={recording.shareLink}
				errorMsg={recording.errorMsg}
				onPrepare={recording.prepare}
				onStop={recording.stop}
				startAnim={startAnim}
				endAnim={endAnim}
				onStartAnimDone={() => setStartAnim(false)}
				onEndAnimDone={() => setEndAnim(false)}
			/>
		</LiveKitRoom>
	)
}

export const ObserverPage = () => {
	const { t } = useTranslation()
	const { code = '' } = useParams<{ code: string }>()
	const { isLoading } = useAuth()

	if (isLoading) {
		return (
			<div className='w-screen h-screen flex items-center justify-center' style={{ background: '#07080f' }}>
				<span style={{ color: 'rgba(100,140,220,0.3)', fontSize: '13px' }}>{t('room.loading')}</span>
			</div>
		)
	}

	return <ObserverInner gameCode={code} />
}
