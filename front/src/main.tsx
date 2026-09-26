import React from 'react'
import ReactDOM from 'react-dom/client'
import { initializeSentry } from './config/sentry'

// Initialize Sentry FIRST, before anything else
initializeSentry()

import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { AdminProvider } from './context/AdminContext'
import { ThemeProvider } from './context/ThemeContext'

import './i18n'
import { reloadForNewVersion } from './utils/lazyPage'

// Vite's own signal that a file of the old build is gone (after a redeploy)
window.addEventListener('vite:preloadError', event => {
	if (reloadForNewVersion()) event.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider>
			<AuthProvider>
				<AdminProvider>
					<App />
				</AdminProvider>
			</AuthProvider>
		</ThemeProvider>
	</React.StrictMode>,
)
