import React, { useEffect, useRef } from 'react'

export const StarField = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const resize = () => {
			canvas.width = window.innerWidth
			canvas.height = window.innerHeight
		}
		resize()
		window.addEventListener('resize', resize)

		// Deterministic stars
		const stars = Array.from({ length: 220 }, (_, i) => ({
			xPct: ((i * 7919 + 31) % 997) / 9.97,
			yPct: ((i * 6271 + 17) % 991) / 9.91,
			r:    0.3 + (i % 4) * 0.35,
			phase: (i * 2.618) % (Math.PI * 2),
			speed: 0.006 + (i % 9) * 0.0025,
		}))

		let animId: number
		let frame = 0

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			stars.forEach(s => {
				const a = 0.2 + 0.65 * (0.5 + 0.5 * Math.sin(frame * s.speed + s.phase))
				ctx.beginPath()
				ctx.arc(s.xPct / 100 * canvas.width, s.yPct / 100 * canvas.height, s.r, 0, Math.PI * 2)
				ctx.fillStyle = `rgba(255,255,255,${a})`
				ctx.fill()
			})
			frame++
			animId = requestAnimationFrame(draw)
		}

		draw()
		return () => {
			cancelAnimationFrame(animId)
			window.removeEventListener('resize', resize)
		}
	}, [])

	return <canvas ref={canvasRef} className='absolute inset-0 w-full h-full pointer-events-none' />
}
