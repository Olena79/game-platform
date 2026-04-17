import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMeRequest, AuthUser } from '../actions/auth'

const TOKEN_KEY = 'mindflow_token'

interface AuthContextType {
	user: AuthUser | null
	token: string | null
	isLoggedIn: boolean
	isLoading: boolean
	login: (token: string, user: AuthUser) => void
	logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser]       = useState<AuthUser | null>(null)
	const [token, setToken]     = useState<string | null>(localStorage.getItem(TOKEN_KEY))
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const saved = localStorage.getItem(TOKEN_KEY)
		if (!saved) {
			setIsLoading(false)
			return
		}
		getMeRequest(saved)
			.then(u => { setUser(u); setToken(saved) })
			.catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null) })
			.finally(() => setIsLoading(false))
	}, [])

	const login = (newToken: string, userData: AuthUser) => {
		localStorage.setItem(TOKEN_KEY, newToken)
		setToken(newToken)
		setUser(userData)
	}

	const logout = () => {
		localStorage.removeItem(TOKEN_KEY)
		setToken(null)
		setUser(null)
	}

	return (
		<AuthContext.Provider value={{ user, token, isLoggedIn: !!user, isLoading, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = (): AuthContextType => {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
	return ctx
}
