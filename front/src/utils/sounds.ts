// Singleton AudioContext — browsers cap concurrent instances (~6–30).
// Re-creating one per beep() call exhausts the limit in long sessions.
let _ctx: AudioContext | null = null
function getCtx(): AudioContext {
	if (!_ctx || _ctx.state === 'closed') {
		_ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
	}
	if (_ctx.state === 'suspended') _ctx.resume()
	return _ctx
}

/**
 * Browsers (iPhone Safari above all) keep sound off until the person taps
 * the page, and a context made later, outside a tap, stays silent. So the
 * one shared context is woken by the first tap or key press — joining the
 * room is one — and every sound afterwards plays. A silent blip does the
 * waking on iOS.
 */
function unlockOnce() {
	try {
		const ctx = getCtx()
		const buf = ctx.createBuffer(1, 1, 22050)
		const src = ctx.createBufferSource()
		src.buffer = buf
		src.connect(ctx.destination)
		src.start(0)
	} catch { /* no audio here */ }
	for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(ev, unlockOnce, true)
}
if (typeof window !== 'undefined') {
	for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlockOnce, true)
}

function beep(freqs: number[], duration: number, gap = 0.09, volume = 0.32) {
	try {
		const ctx = getCtx()
		freqs.forEach((f, i) => {
			const osc  = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)
			osc.type = 'sine'
			const t = ctx.currentTime + i * (duration + gap)
			osc.frequency.setValueAtTime(f, t)
			gain.gain.setValueAtTime(volume, t)
			gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
			osc.start(t)
			osc.stop(t + duration)
		})
	} catch {}
}

export const sfx = {
	// Gentle two-tone "ting" — hand raised
	handRaise: () => beep([1047, 1319], 0.14, 0.06, 0.28),

	// Warm ascending fanfare — announcement appears
	announcement: () => beep([523, 659, 784], 0.18, 0.07, 0.3),

	// Clean double-tap — vote starts
	vote: () => beep([660, 880], 0.13, 0.1, 0.27),

	// Soft single ping — new public chat message
	chatMsg: () => beep([880], 0.09, 0, 0.18),

	// Rising two-note ding — direct message received
	dmMsg: () => beep([880, 1175], 0.09, 0.05, 0.24),

	// Timer started — two quick rising tones
	timerStart: () => beep([660, 880], 0.18, 0.07, 0.3),

	// 30 seconds left — three mid-low beeps
	timerWarning: () => beep([550, 550, 440], 0.15, 0.12, 0.34),

	// Time is up — a bell-like descending call, played twice so nobody
	// talking over it misses it
	timerEnd: () => {
		beep([988, 784, 659, 523], 0.32, 0.1, 0.45)
		setTimeout(() => beep([988, 784, 659, 523], 0.32, 0.1, 0.45), 1700)
	},
}
