import React, { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, ArrowRight } from 'lucide-react'

interface Props {
	roomTitle: string
	userName: string
	onJoin: (micOn: boolean, camOn: boolean) => void
}

export function PreJoinScreen({ roomTitle, userName, onJoin }: Props) {
	const [micOn, setMicOn] = useState(true)
	const [camOn, setCamOn] = useState(false)
	const [camAvailable, setCamAvailable] = useState(true)
	const videoRef = useRef<HTMLVideoElement>(null)
	const streamRef = useRef<MediaStream | null>(null)

	const stopStream = () => {
		streamRef.current?.getTracks().forEach(t => t.stop())
		streamRef.current = null
	}

	const startCam = async () => {
		try {
			const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
			stopStream()
			streamRef.current = s
			if (videoRef.current) videoRef.current.srcObject = s
			setCamOn(true)
			setCamAvailable(true)
		} catch {
			setCamAvailable(false)
			setCamOn(false)
		}
	}

	const stopCam = () => {
		stopStream()
		if (videoRef.current) videoRef.current.srcObject = null
		setCamOn(false)
	}

	useEffect(() => {
		startCam()
		return () => stopStream()
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const toggleCam = () => { if (camOn) stopCam(); else startCam() }

	const handleJoin = () => {
		// Release camera tracks before LiveKit takes over
		stopStream()
		if (videoRef.current) videoRef.current.srcObject = null
		onJoin(micOn, camOn)
	}

	const initials = userName
		.split(' ')
		.map(w => w[0] ?? '')
		.join('')
		.toUpperCase()
		.slice(0, 2) || '??'

	return (
		<div
			className='w-screen h-screen flex items-center justify-center px-[16px]'
			style={{ background: '#07080f' }}
		>
			<div className='flex flex-col items-center gap-[24px] w-full max-w-[440px]'>

				{/* Room label */}
				<div className='text-center'>
					<p className='text-[11px] uppercase tracking-[0.1em] mb-[5px]'
						style={{ color: 'rgba(100,140,220,0.45)' }}>
						Підключення до кімнати
					</p>
					<h2 className='text-[19px] font-[700]'
						style={{ color: 'rgba(220,230,255,0.92)' }}>
						{roomTitle || '—'}
					</h2>
				</div>

				{/* Camera preview box */}
				<div
					className='relative w-full rounded-[16px] overflow-hidden'
					style={{ aspectRatio: '4/3', background: '#0d1228', border: '1px solid #1c2035' }}
				>
					<video
						ref={videoRef}
						autoPlay
						muted
						playsInline
						className='absolute inset-0 w-full h-full object-cover'
						style={{ display: camOn ? 'block' : 'none', transform: 'scaleX(-1)' }}
					/>

					{!camOn && (
						<div className='absolute inset-0 flex flex-col items-center justify-center gap-[10px]'>
							<div
								className='w-[64px] h-[64px] rounded-full flex items-center justify-center text-[22px] font-[700]'
								style={{
									background: 'rgba(68,170,255,0.12)',
									border: '1px solid rgba(68,170,255,0.25)',
									color: 'rgba(68,170,255,0.9)',
								}}
							>
								{initials}
							</div>
							<span className='text-[12px]' style={{ color: 'rgba(100,140,220,0.4)' }}>
								{!camAvailable ? 'Камера недоступна' : 'Камера вимкнена'}
							</span>
						</div>
					)}

					{/* Name tag */}
					<div className='absolute bottom-[10px] left-[12px]'>
						<span
							className='text-[12px] px-[8px] py-[2px] rounded-[5px]'
							style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(220,230,255,0.8)' }}
						>
							{userName}
						</span>
					</div>
				</div>

				{/* Mic / Cam toggles */}
				<div className='flex gap-[12px]'>
					<button
						onClick={() => setMicOn(v => !v)}
						className='flex flex-col items-center gap-[6px] px-[28px] py-[12px] rounded-[14px] cursor-pointer transition-all'
						style={micOn
							? { background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }
							: { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }}
					>
						{micOn ? <Mic size={24} strokeWidth={1.8} /> : <MicOff size={24} strokeWidth={1.8} />}
						<span className='text-[11px] font-[500]'>
							{micOn ? 'Мікрофон увімк.' : 'Мікрофон вимк.'}
						</span>
					</button>

					<button
						onClick={toggleCam}
						disabled={!camAvailable && !camOn}
						className='flex flex-col items-center gap-[6px] px-[28px] py-[12px] rounded-[14px] cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed'
						style={camOn
							? { background: 'rgba(15,255,200,0.08)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }
							: { background: '#0f1120', border: '1px solid #1c1f35', color: '#7a80a0' }}
					>
						{camOn ? <Video size={24} strokeWidth={1.8} /> : <VideoOff size={24} strokeWidth={1.8} />}
						<span className='text-[11px] font-[500]'>
							{camOn ? 'Камера увімк.' : 'Камера вимк.'}
						</span>
					</button>
				</div>

				{/* Enter button */}
				<button
					onClick={handleJoin}
					className='flex items-center gap-[10px] px-[36px] py-[13px] rounded-[14px] text-[15px] font-[700] cursor-pointer transition-all hover:-translate-y-[1px]'
					style={{
						background: 'rgba(15,255,200,0.12)',
						border: '1px solid rgba(15,255,200,0.38)',
						color: '#0fffc8',
						boxShadow: '0 4px 20px rgba(15,255,200,0.07)',
					}}
				>
					Увійти в кімнату
					<ArrowRight size={16} strokeWidth={2.5} />
				</button>

				<p className='text-[11px]' style={{ color: 'rgba(100,140,220,0.28)' }}>
					Налаштування медіа збережуться при вході
				</p>
			</div>
		</div>
	)
}
