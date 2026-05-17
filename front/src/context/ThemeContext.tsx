import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeCtx {
	theme: Theme
	isDark: boolean
	toggleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx>({
	theme: 'dark',
	isDark: true,
	toggleTheme: () => {},
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [theme, setTheme] = useState<Theme>(() => {
		const stored = localStorage.getItem('theme')
		if (stored === 'light' || stored === 'dark') return stored
		return 'light'
	})

	useEffect(() => {
		const root = document.documentElement
		root.classList.remove('dark', 'light')
		root.classList.add(theme)
		localStorage.setItem('theme', theme)
	}, [theme])

	const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

	return (
		<ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}

export const useTheme = () => useContext(ThemeContext)
