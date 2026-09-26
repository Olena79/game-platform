import { useEffect, useRef } from 'react'

export interface CoinsMoved {
	/** A user id, or 'bank' — the gamemaster's bank */
	from: string
	to: string
	amount: number
}

/**
 * How many coins fly: the sum should be felt, not just the fact.
 * Up to 25 → 3, up to 50 → 6, up to 100 → 10; above that the bank comes
 * down — 24 coins up to 500, 32 beyond. Capped, so a burst of transfers
 * stays light.
 */
export function coinsFor(amount: number): number {
	if (amount <= 25) return 3
	if (amount <= 50) return 6
	if (amount <= 100) return 10
	if (amount <= 500) return 24
	return 32
}

/** Above this the coins pour: bigger, wider, faster one after another */
export const POUR_FROM = 100

const MAX_COINS_ON_SCREEN = 120

/**
 * Where a participant is on screen: a tile marked data-coin-anchor, visible
 * and not scrolled away (the speaker strip scrolls, the grid pages). 'bank'
 * is the gamemaster's tile. Null when they are nowhere to be seen.
 */
function anchorPoint(id: string, gamemasterId: string | null): { x: number; y: number } | null {
	const key = id === 'bank' ? gamemasterId : id
	if (!key) return null
	const nodes = document.querySelectorAll<HTMLElement>(`[data-coin-anchor="${CSS.escape(key)}"]`)
	for (const el of nodes) {
		const r = el.getBoundingClientRect()
		if (r.width === 0 || r.height === 0) continue
		const x = r.left + r.width / 2
		const y = r.top + r.height / 2
		if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
		// Clipped by a scrolling strip? Then something else is on top there
		const hit = document.elementFromPoint(x, y)
		if (hit && !el.contains(hit) && !hit.closest('[data-coin-layer]')) continue
		return { x, y }
	}
	return null
}

/**
 * Coins flying between players (and the bank), and the ⚡ flash when the
 * gamemaster gives or takes influence — seen by everyone in the room.
 * Plain DOM and the Web Animations API on transform/opacity — composited by
 * the GPU, nothing re-renders, pointer events pass through. Someone who is
 * off screen is replaced by the top (sender) or bottom (receiver) edge; with
 * reduced motion only the "+N" appears.
 */
export const CoinFlights = ({ gamemasterId }: { gamemasterId: string | null }) => {
	const layerRef = useRef<HTMLDivElement>(null)
	const gmRef = useRef(gamemasterId)
	gmRef.current = gamemasterId

	useEffect(() => {
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

		const onMoved = (e: Event) => {
			const layer = layerRef.current
			if (!layer) return
			const { from, to, amount } = (e as CustomEvent<CoinsMoved>).detail
			const src = anchorPoint(from, gmRef.current) ?? { x: innerWidth / 2, y: -30 }
			const dst = anchorPoint(to, gmRef.current) ?? { x: innerWidth / 2, y: innerHeight + 30 }
			const dstVisible = dst.y <= innerHeight

			if (!reduced) {
				const count = Math.min(coinsFor(amount), Math.max(0, MAX_COINS_ON_SCREEN - layer.childElementCount))
				const big = amount > POUR_FROM
				for (let i = 0; i < count; i++) flyCoin(layer, src, dst, i, count, big)
			}
			if (dstVisible) showAmount(layer, dst, amount, reduced ? 0 : 700 + coinsFor(amount) * 25)
		}

		// Influence given or taken by the gamemaster: a ⚡ flash on the tile
		const onInfluence = (e: Event) => {
			const layer = layerRef.current
			if (!layer) return
			const { userId, delta } = (e as CustomEvent<{ userId: string; delta: number }>).detail
			const at = anchorPoint(userId, gmRef.current)
			if (!at) return   // not on this screen: nothing to point at
			if (delta > 0) {
				if (!reduced) influenceBurst(layer, at)
				showLabel(layer, at, `+${delta} ⚡`, '#c9a6ff', 'rgba(170,110,255,0.8)', reduced ? 0 : 150)
			} else {
				showLabel(layer, at, `${delta} ⚡`, 'rgba(190,190,215,0.85)', 'rgba(0,0,0,0.6)', 0)
			}
		}

		window.addEventListener('gos:coins-moved', onMoved)
		window.addEventListener('gos:influence-changed', onInfluence)
		return () => {
			window.removeEventListener('gos:coins-moved', onMoved)
			window.removeEventListener('gos:influence-changed', onInfluence)
		}
	}, [])

	return <div ref={layerRef} data-coin-layer='' className='fixed inset-0 pointer-events-none overflow-hidden' style={{ zIndex: 70 }} aria-hidden='true' />
}

function flyCoin(layer: HTMLElement, src: { x: number; y: number }, dst: { x: number; y: number }, i: number, count: number, big: boolean) {
	const coin = document.createElement('div')
	const size = big ? 20 + Math.random() * 10 : 18 + Math.random() * 6
	coin.textContent = '🪙'
	coin.style.cssText = `position:absolute;left:0;top:0;font-size:${size}px;line-height:1;will-change:transform,opacity;filter:drop-shadow(0 0 6px rgba(255,200,60,0.55))`
	layer.appendChild(coin)

	// A little scatter at both ends, and an arc that bulges sideways
	const spread = big ? 60 : 26
	const sx = src.x + (Math.random() - 0.5) * spread
	const sy = src.y + (Math.random() - 0.5) * spread
	const ex = dst.x + (Math.random() - 0.5) * spread * 0.6
	const ey = dst.y + (Math.random() - 0.5) * spread * 0.6
	const dist = Math.hypot(ex - sx, ey - sy)
	const lift = Math.min(160, 50 + dist * 0.25) * (Math.random() * 0.6 + 0.7)
	const mx = (sx + ex) / 2 + (Math.random() - 0.5) * lift
	const my = Math.min(sy, ey) - lift
	const spin = (Math.random() - 0.5) * 540
	const half = size / 2

	const duration = 750 + Math.random() * 350
	// "The bank comes down": a big sum pours out over a longer moment
	const delay = i * (big ? 35 : count > 6 ? 45 : 70)

	const anim = coin.animate([
		{ transform: `translate(${sx - half}px, ${sy - half}px) scale(0.4) rotate(0deg)`, opacity: 0 },
		{ transform: `translate(${sx - half}px, ${sy - half}px) scale(1) rotate(0deg)`, opacity: 1, offset: 0.08 },
		{ transform: `translate(${mx - half}px, ${my - half}px) scale(1.15) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
		{ transform: `translate(${ex - half}px, ${ey - half}px) scale(0.8) rotate(${spin}deg)`, opacity: 1, offset: 0.92 },
		{ transform: `translate(${ex - half}px, ${ey - half}px) scale(0.3) rotate(${spin}deg)`, opacity: 0 },
	], { duration, delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'backwards' })
	anim.onfinish = () => coin.remove()
	anim.oncancel = () => coin.remove()
}

function showAmount(layer: HTMLElement, at: { x: number; y: number }, amount: number, delay: number) {
	showLabel(layer, at, `+${amount}`, '#ffd45a', 'rgba(255,190,40,0.7)', delay)
}

/**
 * Influence: a glowing ring spreads from the tile and a few ⚡ sparks fly
 * out — short, so a GM pressing "+" several times reads as several pulses.
 */
function influenceBurst(layer: HTMLElement, at: { x: number; y: number }) {
	const ring = document.createElement('div')
	ring.style.cssText = 'position:absolute;left:0;top:0;width:60px;height:60px;border-radius:50%;border:3px solid rgba(180,120,255,0.9);box-shadow:0 0 18px rgba(170,110,255,0.8),inset 0 0 12px rgba(170,110,255,0.5);will-change:transform,opacity'
	layer.appendChild(ring)
	const r = ring.animate([
		{ transform: `translate(${at.x - 30}px, ${at.y - 30}px) scale(0.3)`, opacity: 0.95 },
		{ transform: `translate(${at.x - 30}px, ${at.y - 30}px) scale(2.2)`, opacity: 0 },
	], { duration: 750, easing: 'ease-out' })
	r.onfinish = () => ring.remove()
	r.oncancel = () => ring.remove()

	const sparks = 6
	for (let i = 0; i < sparks; i++) {
		const spark = document.createElement('div')
		spark.textContent = '⚡'
		spark.style.cssText = 'position:absolute;left:0;top:0;font-size:18px;line-height:1;filter:drop-shadow(0 0 6px rgba(190,130,255,0.9));will-change:transform,opacity'
		layer.appendChild(spark)
		const angle = (i / sparks) * Math.PI * 2 + Math.random() * 0.5
		const dist = 45 + Math.random() * 25
		const x0 = at.x - 9, y0 = at.y - 9
		const a = spark.animate([
			{ transform: `translate(${x0}px, ${y0}px) scale(0.3)`, opacity: 0 },
			{ transform: `translate(${x0 + Math.cos(angle) * dist * 0.5}px, ${y0 + Math.sin(angle) * dist * 0.5}px) scale(1.2)`, opacity: 1, offset: 0.35 },
			{ transform: `translate(${x0 + Math.cos(angle) * dist}px, ${y0 + Math.sin(angle) * dist}px) scale(0.6)`, opacity: 0 },
		], { duration: 700, delay: i * 25, easing: 'ease-out', fill: 'backwards' })
		a.onfinish = () => spark.remove()
		a.oncancel = () => spark.remove()
	}
}

function showLabel(layer: HTMLElement, at: { x: number; y: number }, text: string, color: string, glow: string, delay: number) {
	const label = document.createElement('div')
	label.textContent = text
	label.style.cssText = `position:absolute;left:0;top:0;font-weight:800;font-size:20px;color:${color};text-shadow:0 0 10px ${glow},0 2px 6px rgba(0,0,0,0.8);white-space:nowrap;will-change:transform,opacity`
	layer.appendChild(label)
	const x = at.x - 20
	const anim = label.animate([
		{ transform: `translate(${x}px, ${at.y - 10}px) scale(0.6)`, opacity: 0 },
		{ transform: `translate(${x}px, ${at.y - 30}px) scale(1.15)`, opacity: 1, offset: 0.2 },
		{ transform: `translate(${x}px, ${at.y - 45}px) scale(1)`, opacity: 1, offset: 0.7 },
		{ transform: `translate(${x}px, ${at.y - 70}px) scale(0.9)`, opacity: 0 },
	], { duration: 1400, delay, easing: 'ease-out', fill: 'backwards' })
	anim.onfinish = () => label.remove()
	anim.oncancel = () => label.remove()
}
