import { useState, useRef, useCallback, useEffect } from 'react'
import i18n from '../i18n'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

const screenCaptureSupported = () =>
	typeof navigator.mediaDevices?.getDisplayMedia === 'function'

// Only Chromium can capture audio along with the screen. Safari rejects the
// whole call when audio is requested and Firefox has never supported it, so
// asking for it there turns a working capture into a failed one.
const supportsScreenAudio = () => {
	const ua = navigator.userAgent
	return /Chrome|Chromium|Edg\//.test(ua) && !/Firefox|FxiOS/.test(ua)
}

/** Turns a getDisplayMedia rejection into something the GM can act on. */
function captureErrorMessage(err: unknown): string {
	const name = (err as DOMException)?.name ?? 'Error'
	switch (name) {
		case 'NotAllowedError':
			// Cancelled in the picker, or blocked by the OS (macOS screen recording)
			return i18n.t('room.observer.err_denied')
		case 'NotFoundError':
		case 'AbortError':
			return i18n.t('room.observer.err_no_source')
		case 'NotReadableError':
			return i18n.t('room.observer.err_busy')
		case 'NotSupportedError':
		case 'TypeError':
			return i18n.t('room.observer.err_unsupported')
		default:
			return i18n.t('room.observer.err_capture', { name })
	}
}

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
	const [localFile, setLocalFile] = useState<{ url: string; name: string } | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const recordingIdRef = useRef('')

	// Release the fallback object URL when the observer window goes away
	const localUrlRef = useRef<string | null>(null)
	useEffect(() => () => {
		if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current)
	}, [])

	const setStatus = useCallback((s: RecordingStatus) => {
		setStatusRaw(s)
		onStatusChange?.(s)
	}, [onStatusChange])

	const prepare = useCallback(async () => {
		if (!screenCaptureSupported()) {
			// Mobile browsers have no screen capture at all — say so instead of
			// reporting it as a refused permission.
			setErrorMsg(i18n.t('room.observer.err_unsupported'))
			setStatus('error')
			return
		}
		try {
			setErrorMsg('')
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: { width: 1920, height: 1080, frameRate: 30 } as MediaTrackConstraints,
				audio: supportsScreenAudio(),
			})
			streamRef.current = stream
			// Only the video track ends the session: an audio track the browser
			// never really opened would otherwise cancel a healthy capture.
			stream.getVideoTracks().forEach(t => {
				t.onended = () => {
					if (recorderRef.current?.state === 'recording') {
						recorderRef.current.stop()
					} else {
						setStatus('idle')
					}
				}
			})
			setStatus('prepared')
		} catch (err) {
			console.warn('[recording] getDisplayMedia failed:', err)
			setErrorMsg(captureErrorMessage(err))
			setStatus('error')
		}
	}, [setStatus])

	// Last resort when Drive refuses the upload: hand the GM the file itself,
	// so a finished recording is never lost to a server-side problem.
	const offerLocalFile = useCallback((blob: Blob) => {
		try {
			if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current)
			const url = URL.createObjectURL(blob)
			localUrlRef.current = url
			const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
			setLocalFile({ url, name: `${gameCode}-${stamp}.webm` })
		} catch (err) {
			console.warn('[recording] could not offer local file:', err)
		}
	}, [gameCode])

	const uploadRecording = useCallback(async () => {
		const blob = new Blob(chunksRef.current, { type: 'video/webm' })
		const id = recordingIdRef.current

		const fail = (msg: string) => {
			setErrorMsg(msg)
			offerLocalFile(blob)
			setStatus('error')
		}

		if (!id) {
			fail(i18n.t('room.observer.err_no_id'))
			return
		}
		setStatus('uploading')
		setUploadProgress(0)

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
					// The server explains why Drive refused it — pass that on
					let reason = `HTTP ${xhr.status}`
					try {
						const body = JSON.parse(xhr.responseText)
						if (body?.reason) reason = body.reason
						else if (body?.message) reason = body.message
					} catch { /* non-JSON error body */ }
					reject(new Error(reason))
				}
			}
			xhr.onerror = () => reject(new Error(i18n.t('room.observer.err_network')))
			xhr.send(blob)
		}).catch((err: Error) => {
			console.error('[recording] upload failed:', err)
			fail(i18n.t('room.observer.err_upload', { reason: err.message }))
		})

		streamRef.current?.getTracks().forEach(t => t.stop())
		streamRef.current = null
		chunksRef.current = []
	}, [authToken, offerLocalFile, setStatus])

	const start = useCallback(async () => {
		if (!streamRef.current || !authToken) return
		try {
			const resp = await fetch(`${API}/api/recordings/initiate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
				body: JSON.stringify({ gameCode, gameTitle }),
			})
			if (!resp.ok) throw new Error(`initiate HTTP ${resp.status}`)
			const { recordingId } = await resp.json()
			if (!recordingId) throw new Error('initiate returned no id')
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
		} catch (err) {
			console.error('[recording] start failed:', err)
			setErrorMsg(i18n.t('room.observer.err_start'))
			setStatus('error')
		}
	}, [authToken, gameCode, gameTitle, setStatus, uploadRecording])

	const stop = useCallback(() => {
		if (recorderRef.current?.state === 'recording') {
			recorderRef.current.stop()
		}
	}, [])

	return { status, uploadProgress, shareLink, errorMsg, localFile, prepare, start, stop }
}
