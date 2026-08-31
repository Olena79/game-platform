import React from 'react'
import ReactDOM from 'react-dom/client'
import { initializeSentry } from './config/sentry'

// Initialize Sentry FIRST, before anything else
initializeSentry()

import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

import './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider>
			<AuthProvider>
				<App />
			</AuthProvider>
		</ThemeProvider>
	</React.StrictMode>,
)
