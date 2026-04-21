function beep(freqs: number[], duration: number, gap = 0.09, volume = 0.32) {
	try {
		const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
}
