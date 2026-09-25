import { Room, RoomEvent, Track, Participant } from 'livekit-client'

/**
 * Records the game room in the gamemaster's own browser.
 *
 * No screen capture: phones cannot do that at all. The browser already
 * receives every participant's camera and microphone through LiveKit, so the
 * recorder draws the cameras into a grid on a canvas, mixes the voices with
 * WebAudio, records that with MediaRecorder, and uploads it to the server in
 * fixed-size parts while the game runs. Parts are stored in the bucket as they
 * arrive, so a phone that dies mid-game still leaves a file behind.
 *
 * It lives outside the LiveKit room component on purpose: moving into a
 * breakout room swaps the LiveKit connection, and the recording carries on
 * with whatever room the gamemaster is in (attachRoom).
 *
 * The room tab has to stay open and in front: browsers slow down timers in
 * background tabs, and phones pause them altogether.
 */

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const TOKEN_KEY = 'mindflow_access_token'

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'done' | 'error'

export interface RecorderSnapshot {
	status: RecorderStatus
	/** Bytes the server has confirmed */
	uploadedBytes: number
	/** A reason, for 'error', or a warning while recording */
	message: string
	audioOnly: boolean
}

export interface RecorderCapabilities {
	/** MediaRecorder exists at all */
	canRecord: boolean
	/** The canvas can be turned into a video stream */
	canRecordVideo: boolean
	/** A phone or a small device: voice only is suggested */
	lowPower: boolean
}

export function recorderCapabilities(): RecorderCapabilities {
	const canRecord = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
		&& typeof (window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) !== 'undefined'
	const canRecordVideo = canRecord && typeof HTMLCanvasElement !== 'undefined'
		&& typeof HTMLCanvasElement.prototype.captureStream === 'function'
	const nav = navigator as Navigator & { deviceMemory?: number }
	const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
	const lowPower = mobile && ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 2)
	return { canRecord, canRecordVideo, lowPower }
}

const VIDEO_TYPES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function pickType(candidates: string[]): string | null {
	for (const type of candidates) {
		try { if (MediaRecorder.isTypeSupported(type)) return type } catch { /* keep looking */ }
	}
	return null
}

interface Source {
	track: MediaStreamTrack
	element: HTMLVideoElement | HTMLAudioElement
	audioNode?: MediaStreamAudioSourceNode
}

interface Tile {
	identity: string
	name: string
	video?: HTMLVideoElement
}

export interface RecorderOptions {
	/** The code the gamemaster opened the room with */
	code: string
	/** Hands back a fresh access token, or null when the session is over */
	refreshToken: () => Promise<string | null>
	onChange: (snapshot: RecorderSnapshot) => void
}

export class RoomRecorder {
	private opts: RecorderOptions
	private snap: RecorderSnapshot = { status: 'idle', uploadedBytes: 0, message: '', audioOnly: false }

	private room: Room | null = null
	private roomListener = () => this.resync()

	private container: HTMLDivElement | null = null
	private canvas: HTMLCanvasElement | null = null
	private ctx2d: CanvasRenderingContext2D | null = null
	private audioCtx: AudioContext | null = null
	private mixDestination: MediaStreamAudioDestinationNode | null = null
	private sources = new Map<string, Source>()   // by MediaStreamTrack id
	private tiles: Tile[] = []
	/** Someone is showing their screen: it takes the big part of the picture */
	private screen: Tile | null = null

	private recorder: MediaRecorder | null = null
	private drawTimer: number | null = null
	private resyncTimer: number | null = null
	private aliveTimer: number | null = null

	private recordingId = ''
	private partSize = 8 * 1024 * 1024
	private pending: Blob = new Blob()
	private nextPart = 1
	private chain: Promise<void> = Promise.resolve()
	private failed = false
	/** Resolves once the last part is on the server (or the upload gave up) */
	private finished: Promise<void> = Promise.resolve()
	private resolveFinished: () => void = () => undefined

	constructor(opts: RecorderOptions) {
		this.opts = opts
	}

	get snapshot(): RecorderSnapshot { return this.snap }
	get isActive(): boolean { return this.snap.status === 'starting' || this.snap.status === 'recording' || this.snap.status === 'stopping' }

	private set(patch: Partial<RecorderSnapshot>): void {
		this.snap = { ...this.snap, ...patch }
		this.opts.onChange(this.snap)
	}

	// ── The room being recorded ──────────────────────────────────────────────

	/** Follows the gamemaster from room to room (main room, breakouts). */
	attachRoom(room: Room | null): void {
		if (this.room === room) return
		if (this.room) {
			for (const event of ROOM_EVENTS) this.room.off(event, this.roomListener)
		}
		this.room = room
		if (room) {
			for (const event of ROOM_EVENTS) room.on(event, this.roomListener)
		}
		this.resync()
	}

	/** Makes the drawn tiles and the audio mix match who is in the room now. */
	private resync(): void {
		if (!this.isActive || !this.room) {
			if (!this.room) this.dropSources(new Set())
			return
		}
		const participants: Participant[] = [this.room.localParticipant, ...this.room.remoteParticipants.values()]
		const wanted = new Set<string>()
		const tiles: Tile[] = []
		let screen: Tile | null = null

		for (const p of participants) {
			let video: HTMLVideoElement | undefined
			let hasMedia = false
			for (const pub of p.trackPublications.values()) {
				const track = pub.track?.mediaStreamTrack
				if (!track || track.readyState === 'ended') continue
				if (pub.source === Track.Source.ScreenShare && !pub.isMuted && !this.snap.audioOnly) {
					wanted.add(track.id)
					if (!screen) screen = { identity: p.identity, name: p.name || p.identity, video: this.ensureSource(track, 'video').element as HTMLVideoElement }
				} else if (pub.source === Track.Source.Camera && !pub.isMuted && !this.snap.audioOnly) {
					wanted.add(track.id)
					video = this.ensureSource(track, 'video').element as HTMLVideoElement
					hasMedia = true
				} else if (pub.source === Track.Source.Microphone || pub.source === Track.Source.ScreenShareAudio) {
					wanted.add(track.id)
					this.ensureSource(track, 'audio')
					hasMedia = true
				}
			}
			// Spectators publish nothing and are not in the picture
			if (hasMedia || p === this.room.localParticipant) {
				tiles.push({ identity: p.identity, name: p.name || p.identity, video })
			}
		}
		this.dropSources(wanted)
		this.tiles = tiles
		this.screen = screen
	}

	private ensureSource(track: MediaStreamTrack, kind: 'video' | 'audio'): Source {
		const existing = this.sources.get(track.id)
		if (existing) return existing

		const stream = new MediaStream([track])
		const element = document.createElement(kind)
		element.muted = true          // the room already plays itself; this only feeds the recorder
		element.autoplay = true
		if (element instanceof HTMLVideoElement) element.playsInline = true
		element.srcObject = stream
		this.container?.appendChild(element)
		void element.play().catch(() => { /* autoplay policy: muted elements are allowed */ })

		const source: Source = { track, element }
		if (kind === 'audio' && this.audioCtx && this.mixDestination) {
			try {
				source.audioNode = this.audioCtx.createMediaStreamSource(stream)
				source.audioNode.connect(this.mixDestination)
			} catch (err) {
				console.warn('[recorder] could not mix a voice in:', err)
			}
		}
		this.sources.set(track.id, source)
		return source
	}

	private dropSources(keep: Set<string>): void {
		for (const [id, source] of this.sources) {
			if (keep.has(id)) continue
			try { source.audioNode?.disconnect() } catch { /* already gone */ }
			source.element.srcObject = null
			source.element.remove()
			this.sources.delete(id)
		}
	}

	// ── Drawing ──────────────────────────────────────────────────────────────

	private draw = (): void => {
		const ctx = this.ctx2d
		const canvas = this.canvas
		if (!ctx || !canvas) return
		const W = canvas.width
		const H = canvas.height
		ctx.fillStyle = '#07080f'
		ctx.fillRect(0, 0, W, H)

		const gap = 4
		if (this.screen) {
			// A shared screen gets most of the frame; cameras line up on the right
			const stripW = Math.round(W * 0.22)
			this.drawVideo(ctx, this.screen, gap, gap, W - stripW - gap * 3, H - gap * 2, 'contain')
			const n = this.tiles.length
			if (n > 0) {
				const th = Math.min((H - gap * (n + 1)) / n, stripW * 9 / 16)
				this.tiles.forEach((tile, i) => {
					this.drawTile(ctx, tile, W - stripW - gap, gap + i * (th + gap), stripW, th)
				})
			}
			return
		}

		const tiles = this.tiles
		const n = Math.max(tiles.length, 1)
		const cols = Math.ceil(Math.sqrt(n * (W / H) / (16 / 9)))
		const rows = Math.ceil(n / cols)
		const tw = (W - gap * (cols + 1)) / cols
		const th = (H - gap * (rows + 1)) / rows

		tiles.forEach((tile, i) => {
			const col = i % cols
			const row = Math.floor(i / cols)
			// Centre an incomplete last row
			const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols
			const offset = (cols - inRow) * (tw + gap) / 2
			this.drawTile(ctx, tile, gap + offset + col * (tw + gap), gap + row * (th + gap), tw, th)
		})
	}

	private drawTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, tw: number, th: number): void {
		ctx.fillStyle = '#10131f'
		ctx.fillRect(x, y, tw, th)
		if (!this.drawVideo(ctx, tile, x, y, tw, th, 'cover')) {
			ctx.fillStyle = '#0fffc8'
			ctx.font = `600 ${Math.round(th / 5)}px sans-serif`
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.fillText(initials(tile.name), x + tw / 2, y + th / 2)
		}

		// Name plate
		const fs = Math.max(11, Math.round(th / 16))
		ctx.font = `500 ${fs}px sans-serif`
		ctx.textAlign = 'left'
		ctx.textBaseline = 'bottom'
		const label = tile.name.length > 40 ? tile.name.slice(0, 39) + '…' : tile.name
		const lw = Math.min(ctx.measureText(label).width + fs, tw - 12)
		ctx.fillStyle = 'rgba(0,0,0,0.55)'
		ctx.fillRect(x + 6, y + th - fs * 1.8, lw, fs * 1.5)
		ctx.fillStyle = '#ffffff'
		ctx.fillText(label, x + 6 + fs / 2, y + th - fs * 0.5, tw - 12 - fs)
	}

	/** Draws a tile's video: 'cover' fills and crops, 'contain' shows all of it. */
	private drawVideo(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, w: number, h: number, fit: 'cover' | 'contain'): boolean {
		const v = tile.video
		if (!v || v.readyState < 2 || v.videoWidth === 0) return false
		if (fit === 'cover') {
			const scale = Math.max(w / v.videoWidth, h / v.videoHeight)
			const sw = w / scale
			const sh = h / scale
			ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, x, y, w, h)
		} else {
			const scale = Math.min(w / v.videoWidth, h / v.videoHeight)
			const dw = v.videoWidth * scale
			const dh = v.videoHeight * scale
			ctx.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
		}
		return true
	}

	// ── Start / stop ─────────────────────────────────────────────────────────

	/** Must be called from a click: phones only start audio from a user gesture. */
	async start(audioOnly: boolean): Promise<void> {
		if (this.isActive) return
		const caps = recorderCapabilities()
		if (!caps.canRecord) {
			this.set({ status: 'error', message: 'unsupported' })
			return
		}
		const voiceOnly = audioOnly || !caps.canRecordVideo
		this.failed = false
		this.pending = new Blob()
		this.nextPart = 1
		this.chain = Promise.resolve()
		this.set({ status: 'starting', uploadedBytes: 0, message: '', audioOnly: voiceOnly })

		try {
			// Audio first, inside the click: iOS allows it only there
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
			this.audioCtx = new AC()
			await this.audioCtx.resume().catch(() => undefined)
			this.mixDestination = this.audioCtx.createMediaStreamDestination()

			this.container = document.createElement('div')
			this.container.setAttribute('aria-hidden', 'true')
			Object.assign(this.container.style, {
				position: 'fixed', left: '0', top: '0', width: '1px', height: '1px',
				overflow: 'hidden', opacity: '0', pointerEvents: 'none', zIndex: '-1',
			})
			document.body.appendChild(this.container)

			const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
			const tracks: MediaStreamTrack[] = [...this.mixDestination.stream.getAudioTracks()]
			if (!voiceOnly) {
				this.canvas = document.createElement('canvas')
				this.canvas.width = mobile ? 854 : 1280
				this.canvas.height = mobile ? 480 : 720
				this.container.appendChild(this.canvas)
				this.ctx2d = this.canvas.getContext('2d')
				const fps = mobile ? 12 : 15
				const videoTrack = this.canvas.captureStream(fps).getVideoTracks()[0]
				if (videoTrack) tracks.unshift(videoTrack)
				this.drawTimer = window.setInterval(this.draw, Math.round(1000 / fps))
			}

			this.resync()
			// A safety net for anything the room events miss (a track replaced in place)
			this.resyncTimer = window.setInterval(() => this.resync(), 3000)

			const mimeType = voiceOnly ? pickType(AUDIO_TYPES) : pickType(VIDEO_TYPES)
			if (!mimeType) throw new Error('unsupported')

			const res = await this.api('/api/recordings/initiate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: this.opts.code, contentType: mimeType }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok || !data.recordingId) throw new Error(data.message || `HTTP ${res.status}`)
			this.recordingId = data.recordingId
			this.partSize = data.partSize || this.partSize

			const recorder = new MediaRecorder(new MediaStream(tracks), {
				mimeType,
				audioBitsPerSecond: 96_000,
				...(voiceOnly ? {} : { videoBitsPerSecond: mobile ? 800_000 : 1_500_000 }),
			})
			recorder.ondataavailable = e => {
				if (e.data.size === 0) return
				this.pending = new Blob([this.pending, e.data], { type: mimeType })
				this.enqueue(false)
			}
			recorder.onstop = () => { this.enqueue(true) }
			recorder.onerror = () => {
				this.set({ message: 'recorder_error' })
				void this.stop()
			}
			recorder.start(4000)
			this.recorder = recorder
			this.aliveTimer = window.setInterval(() => { void this.alive() }, 60_000)
			window.addEventListener('beforeunload', this.warnOnLeave)
			this.set({ status: 'recording' })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			console.error('[recorder] could not start:', err)
			this.teardown()
			this.set({ status: 'error', message })
		}
	}

	/**
	 * Finishes the file: the last part is uploaded and the server sends the
	 * link. Resolves only when that is done — the recorder hands over its last
	 * slice *after* stop() is called, so waiting on the queue alone returned
	 * before the file was complete.
	 */
	async stop(): Promise<void> {
		if (this.snap.status !== 'recording') return this.finished
		this.set({ status: 'stopping' })
		this.finished = new Promise<void>(resolve => { this.resolveFinished = resolve })
		if (this.recorder && this.recorder.state !== 'inactive') {
			this.recorder.stop()   // onstop → final part
		} else {
			this.enqueue(true)
		}
		return this.finished
	}

	/** Leaving the page: stop drawing, and let the server close what arrived. */
	dispose(): void {
		if (this.snap.status === 'recording') void this.stop()
		this.attachRoom(null)
	}

	private warnOnLeave = (e: BeforeUnloadEvent) => {
		if (this.snap.status !== 'recording' && this.snap.status !== 'stopping') return
		e.preventDefault()
		e.returnValue = ''
	}

	private teardown(): void {
		if (this.drawTimer) { clearInterval(this.drawTimer); this.drawTimer = null }
		if (this.resyncTimer) { clearInterval(this.resyncTimer); this.resyncTimer = null }
		if (this.aliveTimer) { clearInterval(this.aliveTimer); this.aliveTimer = null }
		window.removeEventListener('beforeunload', this.warnOnLeave)
		this.dropSources(new Set())
		this.tiles = []
		this.screen = null
		this.canvas?.remove()
		this.canvas = null
		this.ctx2d = null
		this.container?.remove()
		this.container = null
		void this.audioCtx?.close().catch(() => undefined)
		this.audioCtx = null
		this.mixDestination = null
		this.recorder = null
	}

	// ── Upload ───────────────────────────────────────────────────────────────

	private enqueue(final: boolean): void {
		this.chain = this.chain.then(() => this.flush(final)).catch(() => undefined)
	}

	private async flush(final: boolean): Promise<void> {
		if (this.failed) {
			if (final) this.resolveFinished()
			return
		}
		try {
			while (this.pending.size >= this.partSize) {
				const part = this.pending.slice(0, this.partSize)
				await this.sendPart(this.nextPart, part, false)
				this.pending = this.pending.slice(this.partSize)
				this.nextPart++
			}
			if (!final) return
			const last = this.pending
			await this.sendPart(this.nextPart, last, true)
			this.pending = new Blob()
			this.teardown()
			this.set({ status: 'done' })
			this.resolveFinished()
		} catch (err) {
			this.failed = true
			const message = err instanceof Error ? err.message : String(err)
			console.error('[recorder] upload stopped:', err)
			if (this.recorder && this.recorder.state !== 'inactive') {
				this.recorder.onstop = null
				try { this.recorder.stop() } catch { /* already stopped */ }
			}
			this.teardown()
			// What reached the server becomes a file on its own within minutes
			this.set({ status: 'error', message })
			this.resolveFinished()
		}
	}

	/**
	 * One part, retried through a bad connection. The server keeps the file
	 * open for three minutes of silence, so retrying longer than that is moot:
	 * it will have closed the file from the parts it has, and says so (409).
	 */
	private async sendPart(n: number, body: Blob, final: boolean): Promise<void> {
		const delays = [2000, 4000, 8000, 15000, 30000, 30000, 30000, 30000]
		for (let attempt = 0; ; attempt++) {
			let res: Response | null = null
			try {
				res = await this.api(`/api/recordings/${this.recordingId}/parts/${n}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/octet-stream', 'X-Final': final ? '1' : '0' },
					body,
				})
			} catch {
				res = null   // network down: retry
			}
			if (res?.ok) {
				const data = await res.json().catch(() => ({}))
				if (typeof data.bytes === 'number') this.set({ uploadedBytes: data.bytes })
				return
			}
			if (res && res.status === 409) throw new Error('closed_by_server')
			if (res && res.status >= 400 && res.status < 500 && res.status !== 429) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.message || `HTTP ${res.status}`)
			}
			if (attempt >= delays.length) throw new Error('network')
			this.set({ message: 'retrying' })
			await new Promise(r => setTimeout(r, delays[attempt]))
			this.set({ message: '' })
		}
	}

	private async alive(): Promise<void> {
		if (this.snap.status !== 'recording' || !this.recordingId) return
		try {
			const res = await this.api(`/api/recordings/${this.recordingId}/alive`, { method: 'POST' })
			if (res.status === 409 && !this.failed) {
				// The server closed it (we were silent too long): say so, stop cleanly
				this.failed = true
				if (this.recorder && this.recorder.state !== 'inactive') {
					this.recorder.onstop = null
					try { this.recorder.stop() } catch { /* already stopped */ }
				}
				this.teardown()
				this.set({ status: 'error', message: 'closed_by_server' })
				this.resolveFinished()
			}
		} catch { /* the next part will tell */ }
	}

	/** A request with a fresh token; one refresh and retry on 401. */
	private async api(path: string, init: RequestInit): Promise<Response> {
		const send = (token: string | null) => fetch(`${API}${path}`, {
			...init,
			headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token ?? ''}` },
		})
		let res = await send(readToken())
		if (res.status === 401) {
			const fresh = await this.opts.refreshToken()
			if (fresh) res = await send(fresh)
		}
		return res
	}
}

const ROOM_EVENTS = [
	RoomEvent.TrackSubscribed,
	RoomEvent.TrackUnsubscribed,
	RoomEvent.LocalTrackPublished,
	RoomEvent.LocalTrackUnpublished,
	RoomEvent.TrackMuted,
	RoomEvent.TrackUnmuted,
	RoomEvent.ParticipantConnected,
	RoomEvent.ParticipantDisconnected,
	RoomEvent.ParticipantNameChanged,
] as const

function readToken(): string | null {
	try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function initials(name: string): string {
	return name.split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}
