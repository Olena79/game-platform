import { useState, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export type RecordingStatus = 'idle' | 'prepared' | 'recording' | 'uploading' | 'done' | 'error'

export function useRecording(
	gameCode: string,
	gameTitle: string,
	authToken: string | null,
	onStatusChange?: (status: RecordingStatus) => void,
) {
	const [status, setStatusRaw] = useState<RecordingStatus>('idle')
	const [uploadProgress, setUploadProgress] = useState(0)
	const [shareLink, setShareLink] = useState('')
	const [errorMsg, setErrorMsg] = useState('')
	const streamRef = useRef<MediaStream | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const recordingIdRef = useRef('')

	const setStatus = useCallback((s: RecordingStatus) => {
		setStatusRaw(s)
		onStatusChange?.(s)
	}, [onStatusChange])

	const prepare = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: { width: 1920, height: 1080, frameRate: 30 } as MediaTrackConstraints,
				audio: true,
			})
			streamRef.current = stream
			stream.getTracks().forEach(t => {
				t.onended = () => {
					if (recorderRef.current?.state === 'recording') {
						recorderRef.current.stop()
					} else {
						setStatus('idle')
					}
				}
			})
			setStatus('prepared')
		} catch {
			setErrorMsg('Не вдалося отримати дозвіл на захоплення екрану')
			setStatus('error')
		}
	}, [setStatus])

	const uploadRecording = useCallback(async () => {
		const id = recordingIdRef.current
		if (!id) {
			setErrorMsg('Помилка: відсутній ідентифікатор запису')
			setStatus('error')
			return
		}
		setStatus('uploading')
		setUploadProgress(0)
		const blob = new Blob(chunksRef.current, { type: 'video/webm' })

		await new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest()
			xhr.upload.onprogress = e => {
				if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
			}
			xhr.open('PUT', `${API}/api/recordings/upload/${id}`)
			xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
			xhr.setRequestHeader('Content-Type', 'video/webm')
			xhr.onload = () => {
				if (xhr.status === 200) {
					try {
						const { shareLink } = JSON.parse(xhr.responseText)
						setShareLink(shareLink)
						setStatus('done')
					} catch { setStatus('done') }
					resolve()
				} else {
					reject(new Error(`HTTP ${xhr.status}`))
				}
			}
			xhr.onerror = () => reject(new Error('Network error'))
			xhr.send(blob)
		}).catch(() => {
			setErrorMsg('Помилка завантаження відео на Google Drive')
			setStatus('error')
		})

		streamRef.current?.getTracks().forEach(t => t.stop())
		streamRef.current = null
		chunksRef.current = []
	}, [authToken, setStatus])

	const start = useCallback(async () => {
		if (!streamRef.current || !authToken) return
		try {
			const resp = await fetch(`${API}/api/recordings/initiate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
				body: JSON.stringify({ gameCode, gameTitle }),
			})
			const { recordingId } = await resp.json()
			recordingIdRef.current = recordingId

			chunksRef.current = []
			const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
				? 'video/webm;codecs=vp9,opus'
				: 'video/webm'

			const recorder = new MediaRecorder(streamRef.current, {
				mimeType,
				videoBitsPerSecond: 4_000_000,
			})
			recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
			recorder.onstop = () => { uploadRecording() }
			recorder.start(10_000)
			recorderRef.current = recorder
			setStatus('recording')
		} catch {
			setErrorMsg('Не вдалося почати запис')
			setStatus('error')
		}
	}, [authToken, gameCode, gameTitle, setStatus, uploadRecording])

	const stop = useCallback(() => {
		if (recorderRef.current?.state === 'recording') {
			recorderRef.current.stop()
		}
	}, [])

	return { status, uploadProgress, shareLink, errorMsg, prepare, start, stop }
}
