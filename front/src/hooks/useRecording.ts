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
	/** Bytes already accepted by the server — shown live while recording */
	const [uploadedBytes, setUploadedBytes] = useState(0)
	const [shareLink, setShareLink] = useState('')
	const [errorMsg, setErrorMsg] = useState('')
	const [localFile, setLocalFile] = useState<{ url: string; name: string } | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	/** Only used in local mode, when Drive was unreachable at start */
	const localChunksRef = useRef<Blob[]>([])
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

	// ── Chunked upload ────────────────────────────────────────────────────────
	// Data leaves the browser while the game is still running. Nothing but the
	// current chunk is ever held in memory, so a long session can't grow until
	// the tab dies, and whatever already reached Drive survives a crash.

	/** Drive requires every chunk but the last to be a multiple of 256 KiB. */
	const CHUNK_UNIT = 256 * 1024
	/** Flush once this much has piled up (~8 MiB ≈ 16 s at 4 Mbps). */
	const CHUNK_TARGET = 32 * CHUNK_UNIT

	const pendingRef = useRef<Blob>(new Blob())
	const offsetRef = useRef(0)
	const chainRef = useRef<Promise<void>>(Promise.resolve())
	const localModeRef = useRef(false)
	const abortedRef = useRef(false)

	const postChunk = useCallback(async (body: Blob, offset: number, final: boolean) => {
		const id = recordingIdRef.current
		const resp = await fetch(`${API}/api/recordings/chunk/${id}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${authToken}`,
				'Content-Type': 'application/octet-stream',
				'X-Chunk-Offset': String(offset),
				'X-Chunk-Final': final ? '1' : '0',
			},
			body,
		})
		const data = await resp.json().catch(() => ({}))
		if (!resp.ok) {
			const err = new Error(data?.reason || data?.message || `HTTP ${resp.status}`)
			;(err as Error & { expected?: number }).expected = data?.expected
			throw err
		}
		return data as { complete?: boolean; shareLink?: string; bytes?: number }
	}, [authToken])

	/** One chunk, with retries — a flaky minute of wifi shouldn't end a game. */
	const postChunkWithRetry = useCallback(async (body: Blob, offset: number, final: boolean) => {
		const delays = [2000, 5000, 10000]
		for (let attempt = 0; ; attempt++) {
			try {
				return await postChunk(body, offset, final)
			} catch (err) {
				if (attempt >= delays.length) throw err
				console.warn(`[recording] chunk retry ${attempt + 1}:`, err)
				await new Promise(r => setTimeout(r, delays[attempt]))
			}
		}
	}, [postChunk])

	const flush = useCallback(async (final: boolean) => {
		if (abortedRef.current || localModeRef.current) return
		try {
			// Non-final: send only whole 256 KiB blocks and keep the remainder
			while (!final && pendingRef.current.size >= CHUNK_TARGET) {
				const blocks = Math.floor(pendingRef.current.size / CHUNK_UNIT)
				const size = blocks * CHUNK_UNIT
				const body = pendingRef.current.slice(0, size)
				await postChunkWithRetry(body, offsetRef.current, false)
				pendingRef.current = pendingRef.current.slice(size)
				offsetRef.current += size
				setUploadedBytes(offsetRef.current)
			}
			if (!final) return

			setStatus('uploading')
			const body = pendingRef.current
			const res = await postChunkWithRetry(body, offsetRef.current, true)
			pendingRef.current = new Blob()
			offsetRef.current += body.size
			setUploadedBytes(offsetRef.current)
			if (res.shareLink) setShareLink(res.shareLink)
			setStatus('done')
		} catch (err) {
			abortedRef.current = true
			const reason = err instanceof Error ? err.message : String(err)
			console.error('[recording] upload aborted:', err)
			// Bytes already in Drive are closed into a playable file by the
			// server once it stops hearing from us, so the game isn't lost.
			setErrorMsg(i18n.t('room.observer.err_upload_partial', {
				reason,
				mb: Math.round(offsetRef.current / 1048576),
			}))
			setStatus('error')
		}
	}, [postChunkWithRetry, setStatus])

	const enqueueFlush = useCallback((final: boolean) => {
		chainRef.current = chainRef.current.then(() => flush(final)).catch(() => undefined)
		return chainRef.current
	}, [flush])

	const start = useCallback(async () => {
		if (!streamRef.current || !authToken) return

		pendingRef.current = new Blob()
		offsetRef.current = 0
		localChunksRef.current = []
		localModeRef.current = false
		abortedRef.current = false
		setUploadedBytes(0)
		setErrorMsg('')

		// Open the Drive session first. If storage is unavailable we still
		// record — locally — rather than leaving the GM with nothing.
		try {
			const resp = await fetch(`${API}/api/recordings/initiate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
				body: JSON.stringify({ gameCode, gameTitle }),
			})
			const data = await resp.json().catch(() => ({}))
			if (!resp.ok || !data?.recordingId) {
				throw new Error(data?.reason || data?.message || `HTTP ${resp.status}`)
			}
			recordingIdRef.current = data.recordingId
		} catch (err) {
			console.error('[recording] initiate failed, recording locally:', err)
			localModeRef.current = true
			setErrorMsg(i18n.t('room.observer.err_local_mode', {
				reason: err instanceof Error ? err.message : String(err),
			}))
		}

		try {
			const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
				? 'video/webm;codecs=vp9,opus'
				: 'video/webm'

			const recorder = new MediaRecorder(streamRef.current, {
				mimeType,
				videoBitsPerSecond: 4_000_000,
			})
			recorder.ondataavailable = e => {
				if (e.data.size === 0) return
				if (localModeRef.current) {
					localChunksRef.current.push(e.data)
					return
				}
				pendingRef.current = new Blob([pendingRef.current, e.data])
				enqueueFlush(false)
			}
			recorder.onstop = () => {
				streamRef.current?.getTracks().forEach(t => t.stop())
				streamRef.current = null
				if (localModeRef.current) {
					offerLocalFile(new Blob(localChunksRef.current, { type: 'video/webm' }))
					localChunksRef.current = []
					setStatus('error')   // saved, but not to Drive
					return
				}
				enqueueFlush(true)
			}
			// 5 s slices: small enough to keep memory flat, large enough that
			// the upload isn't one request per second.
			recorder.start(5_000)
			recorderRef.current = recorder
			setStatus('recording')
		} catch (err) {
			console.error('[recording] start failed:', err)
			setErrorMsg(i18n.t('room.observer.err_start'))
			setStatus('error')
		}
	}, [authToken, enqueueFlush, gameCode, gameTitle, offerLocalFile, setStatus])

	const stop = useCallback(() => {
		// Tracks are released in onstop, once the recorder has flushed its last
		// slice — cutting the stream here would drop those final seconds.
		if (recorderRef.current?.state === 'recording') {
			recorderRef.current.stop()
		}
	}, [])

	return { status, uploadedBytes, shareLink, errorMsg, localFile, prepare, start, stop }
}
