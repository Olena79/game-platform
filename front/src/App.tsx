import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
// Google OAuth — requires: npm install @react-oauth/google
// Add VITE_GOOGLE_CLIENT_ID to front/.env
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { MobileBottomNav } from './components/layout/MobileBottomNav'
import { HomePage } from './components/pages/HomePage'
import { AuthPage } from './components/pages/AuthPage'
import { GamePage } from './components/pages/GamePage'
import { CreateGamePage } from './components/pages/CreateGamePage'
import { OurGamesPage } from './components/pages/OurGamesPage'
import { CommunityPage } from './components/pages/CommunityPage'
// import { AboutPage } from './components/pages/AboutPage'
import { GameRoomPage } from './components/pages/GameRoomPage'
import { ObserverPage } from './components/pages/ObserverPage'

const Stars = () => {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const container = ref.current
		if (!container) return

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
		svg.setAttribute('width', '100%')
		svg.setAttribute('height', '100%')
		svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'

		const colors = ['#fff', '#4af', '#c07fff', '#0fffc8', '#ff5fa0']
		for (let i = 0; i < 180; i++) {
			const ci = document.createElementNS(
				'http://www.w3.org/2000/svg',
				'circle',
			)
			const x = Math.random() * 100
			const y = Math.random() * 100
			const r = Math.random() * 1.2 + 0.2
			const col = colors[Math.floor(Math.random() * colors.length)]
			const dur = 2 + Math.random() * 4
			ci.setAttribute('cx', x + '%')
			ci.setAttribute('cy', y + '%')
			ci.setAttribute('r', String(r))
			ci.setAttribute('fill', col)
			ci.setAttribute('opacity', String(Math.random() * 0.6 + 0.1))
			ci.style.animation = `twinkle ${dur}s ease-in-out infinite`
			ci.style.animationDelay = Math.random() * 5 + 's'
			svg.appendChild(ci)
		}
		container.appendChild(svg)
		return () => {
			container.innerHTML = ''
		}
	}, [])

	return (
		<div
			ref={ref}
			className='stars-bg fixed inset-0 z-0 pointer-events-none overflow-hidden'
		/>
	)
}

const SiteLayout = () => (
	<div className='min-h-screen flex flex-col' style={{ color: 'var(--text-primary)' }}>
		<Stars />
		<div className='rainbow-line relative z-10' />
		<Header />
		<main className='flex-grow relative z-10 mobile-pb-nav md:pb-0'>
			<Routes>
				<Route path='/' element={<HomePage />} />
				<Route path='/auth' element={<AuthPage />} />
				<Route path='/game' element={<GamePage />} />
				<Route path='/games' element={<OurGamesPage />} />
				<Route path='/create-game' element={<CreateGamePage />} />
				<Route path='/create-game/:id' element={<CreateGamePage />} />
				<Route path='/community' element={<CommunityPage />} />
				{/* <Route path='/about' element={<AboutPage />} /> */}
			</Routes>
		</main>
		<Footer />
		<MobileBottomNav />
	</div>
)

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

const App = () => {
	const content = (
		<Router>
			<Routes>
				{/* Full-screen observer window — must be before /room/:code */}
				<Route path='/room/:code/observe' element={<ObserverPage />} />
				{/* Full-screen game room — no header/footer */}
				<Route path='/room/:code' element={<GameRoomPage />} />
				{/* All other pages */}
				<Route path='/*' element={<SiteLayout />} />
			</Routes>
		</Router>
	)
	if (!GOOGLE_CLIENT_ID) return content
	return (
		<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
			{content}
		</GoogleOAuthProvider>
	)
}

export default App
