// src/App.tsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { HomePage } from './components/pages/HomePage'
import { AuthPage } from './components/pages/AuthPage'

const App = () => {
	return (
		<Router>
			<div className='min-h-screen flex flex-col bg-slate-950 text-slate-200'>
				<Header />

				<main className='flex-grow container mx-auto px-4'>
					<Routes>
						<Route path='/' element={<HomePage />} />
						<Route path='/auth' element={<AuthPage />} />
						{/* Добавим заглушку для игры, чтобы не было пустоты */}
						<Route
							path='/game'
							element={<div className='py-20 text-center'>Ігрове поле</div>}
						/>
					</Routes>
				</main>

				<Footer />
			</div>
		</Router>
	)
}

export default App
