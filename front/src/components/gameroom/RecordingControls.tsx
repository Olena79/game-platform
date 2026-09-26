import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Video, Mic, Info } from 'lucide-react'
import type { RecorderSnapshot } from '../../recording/RoomRecorder'
import { recorderCapabilities } from '../../recording/RoomRecorder'

export interface RecordingControlsProps {
	/** 'browser': this device records; 'egress': LiveKit records on its servers */
	mode: 'browser' | 'egress'
	/** Someone is recording this room (from the room state) */
	roomIsRecording: boolean
	snapshot: RecorderSnapshot
	onBrowserStart: (audioOnly: boolean) => void
	onBrowserStop: () => void
	egressStatus: string
	egressError: string
	onEgressStart: () => void
	onEgressStop: () => void
}

const DISCLAIMER_KEY = 'gos-recording-explained-v1'

function explainedBefore(): boolean {
	try { return localStorage.getItem(DISCLAIMER_KEY) === '1' } catch { return false }
}

function mb(bytes: number): string {
	return (bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)
}

/**
 * The gamemaster's recording controls.
 *
 * Recording in the browser costs the club nothing but asks something of the
 * device, so the first time a gamemaster presses "record" on a device they
 * are told plainly what that means — before, not after a lost recording.
 */
export const RecordingControls = (p: RecordingControlsProps) => {
	const { t } = useTranslation()
	const caps = recorderCapabilities()
	const [audioOnly, setAudioOnly] = useState(caps.lowPower || !caps.canRecordVideo)
	const [explaining, setExplaining] = useState(false)

	const browser = p.mode === 'browser'
	const s = p.snapshot

	// Status in one place, whichever way the room is recorded
	let isRecording: boolean
	let busy: boolean
	let label: string
	let tone: 'idle' | 'rec' | 'ok' | 'err'
	let detail = ''

	if (browser) {
		isRecording = s.status === 'recording'
		busy = s.status === 'starting' || s.status === 'stopping'
		if (s.status === 'recording') {
			label = t(s.audioOnly ? 'room.mod.rec_active_audio' : 'room.mod.rec_active')
			tone = 'rec'
			detail = t('room.mod.rec_uploaded', { mb: mb(s.uploadedBytes) })
			if (s.message === 'retrying') detail = t('room.mod.rec_retrying')
		} else if (s.status === 'starting') { label = t('room.mod.rec_starting'); tone = 'idle' }
		else if (s.status === 'stopping') { label = t('room.mod.rec_stopping'); tone = 'idle' }
		else if (s.status === 'done') { label = t('room.mod.rec_saved'); tone = 'ok' }
		else if (s.status === 'error') {
			label = t('room.mod.rec_error'); tone = 'err'
			detail = s.message === 'unsupported' ? t('room.mod.rec_err_unsupported')
				// Nothing reached the server: there will be no file, so no link either
				: (s.message === 'closed_by_server' || s.message === 'network') && s.uploadedBytes === 0 ? t('room.mod.rec_err_nothing')
				: s.message === 'closed_by_server' || s.message === 'network' ? t('room.mod.rec_err_interrupted')
				: s.message
		} else if (p.roomIsRecording) {
			// Recording from before a reload, or from another tab of this GM
			label = t('room.mod.rec_elsewhere'); tone = 'rec'
		} else { label = t('room.mod.rec_idle'); tone = 'idle' }
	} else {
		isRecording = p.roomIsRecording || p.egressStatus === 'recording'
		busy = !isRecording && (p.egressStatus === 'starting' || p.egressStatus === 'stopping')
		if (isRecording) { label = t('room.mod.rec_active'); tone = 'rec' }
		else if (p.egressStatus === 'starting') { label = t('room.mod.rec_starting'); tone = 'idle' }
		else if (p.egressStatus === 'stopping') { label = t('room.mod.rec_stopping'); tone = 'idle' }
		else if (p.egressStatus === 'done') { label = t('room.mod.rec_saved'); tone = 'ok' }
		else if (p.egressStatus === 'error') { label = t('room.mod.rec_error'); tone = 'err'; detail = p.egressError }
		else { label = t('room.mod.rec_idle'); tone = 'idle' }
	}

	const start = () => {
		if (browser) p.onBrowserStart(audioOnly)
		else p.onEgressStart()
	}
	const onStartClick = () => {
		if (browser && !explainedBefore()) { setExplaining(true); return }
		start()
	}
	const acceptAndStart = () => {
		try { localStorage.setItem(DISCLAIMER_KEY, '1') } catch { /* shown again next time */ }
		setExplaining(false)
		// Still inside the click: phones start audio only from a user gesture
		start()
	}

	const colors = {
		idle: { bg: 'rgba(15,255,200,0.06)', border: '1px solid rgba(15,255,200,0.2)', fg: '#0fffc8' },
		rec:  { bg: 'rgba(255,56,80,0.08)', border: '1px solid rgba(255,56,80,0.25)', fg: '#ff3850' },
		ok:   { bg: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', fg: '#0fffc8' },
		err:  { bg: 'rgba(255,56,80,0.06)', border: '1px solid rgba(255,56,80,0.2)', fg: 'rgba(255,120,140,0.95)' },
	}[tone]

	const canStart = browser ? caps.canRecord && !isRecording && !busy : !isRecording && !busy

	return (
		<div className='flex flex-col gap-[5px]'>
			<div className='flex items-center gap-[6px] px-[8px] py-[5px] rounded-[8px]'
				style={{ background: colors.bg, border: colors.border }}>
				{browser && (isRecording ? s.audioOnly : audioOnly)
					? <Mic size={12} style={{ color: colors.fg }} />
					: <Video size={12} style={{ color: colors.fg }} />}
				<span className='text-[12px] font-[500]' style={{ color: colors.fg }}>{label}</span>
			</div>
			{detail && (
				<span className='text-[11px] leading-[1.35]' style={{ color: tone === 'err' ? 'rgba(255,120,140,0.9)' : '#7a88b0' }}>{detail}</span>
			)}

			{browser && !isRecording && !busy && caps.canRecordVideo && (
				<label className='flex items-center gap-[6px] text-[11px] cursor-pointer select-none' style={{ color: '#9aa4c8' }}>
					<input type='checkbox' checked={audioOnly} onChange={e => setAudioOnly(e.target.checked)} />
					{t('room.mod.rec_audio_only')}
				</label>
			)}

			<div className='grid grid-cols-2 gap-[5px]'>
				<button
					onClick={onStartClick}
					disabled={!canStart}
					className='rounded-[8px] p-[7px] cursor-pointer flex items-center justify-center gap-[4px] transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed'
					style={{ background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.25)', color: '#0fffc8' }}>
					<span className='text-[11px]'>{t('room.mod.rec_start')}</span>
				</button>
				<button
					onClick={browser ? p.onBrowserStop : p.onEgressStop}
					disabled={!isRecording}
					className='rounded-[8px] p-[7px] cursor-pointer flex items-center justify-center gap-[4px] transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed'
					style={{ background: 'rgba(255,56,80,0.08)', border: '1px solid rgba(255,56,80,0.25)', color: '#ff3850' }}>
					<span className='text-[11px]'>{t('room.mod.rec_stop')}</span>
				</button>
			</div>

			<button onClick={() => setExplaining(true)}
				className='flex items-center gap-[5px] text-[11px] leading-[1.35] text-left cursor-pointer hover:underline'
				style={{ color: '#7a88b0' }}>
				<Info size={11} className='flex-shrink-0' />
				{t(browser ? 'room.mod.rec_hint_browser' : 'room.mod.rec_hint')}
			</button>

			{explaining && (
				<RecordingExplainer
					onClose={() => setExplaining(false)}
					onAccept={canStart ? acceptAndStart : undefined}
				/>
			)}
		</div>
	)
}

/** What recording in the browser asks of the device — said before it matters. */
export const RecordingExplainer = ({ onClose, onAccept }: { onClose: () => void; onAccept?: () => void }) => {
	const { t } = useTranslation()
	const points = t('recording_info.points', { returnObjects: true }) as Array<{ title: string; text: string }>
	return (
		<div className='room-modal-overlay z-[120]' onClick={onClose}>
			<div className='w-full max-w-[460px] max-h-[88dvh] overflow-y-auto rounded-[18px] p-[22px] flex flex-col gap-[14px]'
				style={{ background: '#0b0d1a', border: '1px solid rgba(68,170,255,0.18)' }}
				onClick={e => e.stopPropagation()}>
				<h3 className='text-[16px] font-[700]' style={{ color: 'rgba(220,230,255,0.95)' }}>{t('recording_info.title')}</h3>
				<p className='text-[13px] leading-[1.5]' style={{ color: 'rgba(160,175,220,0.85)' }}>{t('recording_info.lead')}</p>
				<ul className='flex flex-col gap-[10px]'>
					{Array.isArray(points) && points.map(pt => (
						<li key={pt.title} className='rounded-[10px] px-[12px] py-[9px]' style={{ background: 'rgba(15,17,32,0.7)', border: '1px solid #1c1f35' }}>
							<div className='text-[13px] font-[600] mb-[2px]' style={{ color: '#0fffc8' }}>{pt.title}</div>
							<div className='text-[12px] leading-[1.45]' style={{ color: 'rgba(170,182,220,0.9)' }}>{pt.text}</div>
						</li>
					))}
				</ul>
				<div className='flex gap-[8px]'>
					<button onClick={onClose}
						className='flex-1 py-[9px] rounded-[9px] text-[12px] cursor-pointer'
						style={{ background: 'rgba(15,17,32,0.5)', border: '1px solid rgba(68,170,255,0.12)', color: 'rgba(100,140,220,0.7)' }}>
						{t(onAccept ? 'room.cancel' : 'recording_info.close')}
					</button>
					{onAccept && (
						<button onClick={onAccept}
							className='flex-1 py-[9px] rounded-[9px] text-[12px] font-[600] cursor-pointer'
							style={{ background: 'rgba(15,255,200,0.1)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
							{t('recording_info.accept')}
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
