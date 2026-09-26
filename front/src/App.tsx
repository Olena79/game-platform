import React, { Suspense, useEffect, useRef } from 'react'
import { lazyPage } from './utils/lazyPage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RequireAuth } from './components/RequireAuth'
import { ResetPasswordPage } from './components/pages/ResetPasswordPage'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { MobileBottomNav } from './components/layout/MobileBottomNav'
import { HomePage } from './components/pages/HomePage'
import { AuthPage } from './components/pages/AuthPage'
import { GamePage } from './components/pages/GamePage'
import { OurGamesPage } from './components/pages/OurGamesPage'

// The game room carries LiveKit and most of the bundle; the site pages load
// without it, and the room without the site's heavier pages.
const AccountPage = lazyPage(() => import('./components/pages/AccountPage'), 'AccountPage')
const CreateGamePage = lazyPage(() => import('./components/pages/CreateGamePage'), 'CreateGamePage')
const CommunityPage = lazyPage(() => import('./components/pages/CommunityPage'), 'CommunityPage')
const GameRoomPage = lazyPage(() => import('./components/pages/GameRoomPage'), 'GameRoomPage')
const PrivacyPolicyPage = lazyPage(() => import('./components/pages/PrivacyPolicyPage'), 'PrivacyPolicyPage')
const AdminPage = lazyPage(() => import('./components/pages/AdminPage'), 'AdminPage')
const TermsOfServicePage = lazyPage(() => import('./components/pages/TermsOfServicePage'), 'TermsOfServicePage')

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

const PageFallback = () => <div className='w-full min-h-[50vh]' />

const SiteLayout = () => (
	<div className='min-h-screen flex flex-col' style={{ color: 'var(--text-primary)' }}>
		<Stars />
		<div className='rainbow-line relative z-10' />
		<Header />
		<main className='flex-grow relative z-10 mobile-pb-nav md:pb-0'>
			<Suspense fallback={<PageFallback />}>
			<Routes>
				<Route path='/' element={<HomePage />} />
				<Route path='/auth' element={<AuthPage />} />
				<Route path='/auth/reset' element={<ResetPasswordPage />} />
				<Route path='/account' element={<RequireAuth><AccountPage /></RequireAuth>} />
				<Route path='/game' element={<GamePage />} />
				<Route path='/games' element={<OurGamesPage />} />
				<Route path='/create-game' element={<RequireAuth><CreateGamePage /></RequireAuth>} />
				<Route path='/create-game/:id' element={<RequireAuth><CreateGamePage /></RequireAuth>} />
				<Route path='/community' element={<CommunityPage />} />
				<Route path='/privacy-policy' element={<PrivacyPolicyPage />} />
				<Route path='/terms-of-service' element={<TermsOfServicePage />} />
				<Route path='/admin' element={<RequireAuth><AdminPage /></RequireAuth>} />
				{/* <Route path='/about' element={<AboutPage />} /> */}
			</Routes>
			</Suspense>
		</main>
		<Footer />
		<MobileBottomNav />
	</div>
)

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

const App = () => {
	const content = (
		<ErrorBoundary>
			<Router>
				<Routes>
					<Route path='/room/:code' element={
						<Suspense fallback={<div className='w-screen h-screen' style={{ background: '#07080f' }} />}>
							<GameRoomPage />
						</Suspense>
					} />
					<Route path='/*' element={<SiteLayout />} />
				</Routes>
			</Router>
		</ErrorBoundary>
	)
	if (!GOOGLE_CLIENT_ID) return content
	return (
		<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
			{content}
		</GoogleOAuthProvider>
	)
}

export default App
