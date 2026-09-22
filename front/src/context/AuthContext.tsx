import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { getMeRequest, AuthUser } from '../actions/auth'
import * as Sentry from '@sentry/react'

const ACCESS_TOKEN_KEY = 'mindflow_access_token'
const REFRESH_TOKEN_KEY = 'mindflow_refresh_token'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface AuthContextType {
	user: AuthUser | null
	token: string | null
	isLoggedIn: boolean
	isLoading: boolean
	login: (accessToken: string, refreshToken: string, user: AuthUser) => void
	logout: () => void
	/** Refreshes the access token now and returns it, or null if that failed */
	forceRefresh: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<AuthUser | null>(null)
	const [token, setToken] = useState<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
	const [isLoading, setIsLoading] = useState(true)
	const refreshIntervalRef = useRef<number | null>(null)

	// Auto-refresh token 5 minutes before expiry
	const setupTokenRefresh = (accessToken: string) => {
		try {
			const payload = JSON.parse(atob(accessToken.split('.')[1]))
			const expiresIn = (payload.exp - payload.iat) * 1000
			const refreshBefore = 5 * 60 * 1000 // 5 minutes

			if (refreshIntervalRef.current) clearTimeout(refreshIntervalRef.current)

			refreshIntervalRef.current = setTimeout(() => {
				const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
				if (refreshToken) {
					refreshAccessToken(refreshToken).catch(() => {
						logout()
					})
				}
			}, expiresIn - refreshBefore)
		} catch (err) {
			Sentry.captureException(err, { tags: { context: 'token-refresh-setup' } })
		}
	}

	const refreshAccessToken = async (refreshToken: string): Promise<boolean> => {
		try {
			const response = await fetch(`${API_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken }),
			})

			if (!response.ok) {
				logout()
				return false
			}

			const data = await response.json()
			localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
			localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
			setToken(data.accessToken)

			setupTokenRefresh(data.accessToken)
			return true
		} catch (err) {
			Sentry.captureException(err, { tags: { context: 'token-refresh' } })
			logout()
			return false
		}
	}

	useEffect(() => {
		const savedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
		const savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

		if (!savedAccessToken) {
			setIsLoading(false)
			return
		}

		getMeRequest(savedAccessToken)
			.then(u => {
				setUser(u)
				setToken(savedAccessToken)
				setupTokenRefresh(savedAccessToken)
			})
			.catch(() => {
				// Try to refresh if access token expired
				if (savedRefreshToken) {
					refreshAccessToken(savedRefreshToken).then(success => {
						if (success) {
							getMeRequest(localStorage.getItem(ACCESS_TOKEN_KEY)!).then(setUser)
						}
					})
				} else {
					localStorage.removeItem(ACCESS_TOKEN_KEY)
					localStorage.removeItem(REFRESH_TOKEN_KEY)
					setToken(null)
				}
			})
			.finally(() => setIsLoading(false))

		return () => {
			if (refreshIntervalRef.current) clearTimeout(refreshIntervalRef.current)
		}
	}, [])

	const login = (accessToken: string, refreshToken: string, userData: AuthUser) => {
		localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
		localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
		setToken(accessToken)
		setUser(userData)
		setupTokenRefresh(accessToken)
	}

	const logout = () => {
		// Tell the server as well: refresh tokens live for 30 days, and
		// clearing localStorage alone left them valid for all of it.
		const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
		const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
		if (accessToken) {
			fetch(`${API_URL}/api/auth/logout`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ refreshToken }),
				keepalive: true,
			}).catch(() => { /* leaving anyway */ })
		}
		localStorage.removeItem(ACCESS_TOKEN_KEY)
		localStorage.removeItem(REFRESH_TOKEN_KEY)
		setToken(null)
		setUser(null)
		if (refreshIntervalRef.current) clearTimeout(refreshIntervalRef.current)
	}

	/**
	 * Refresh on demand and hand back the new access token.
	 *
	 * The scheduled refresh is a setTimeout, and browsers throttle timers in
	 * background tabs — which is exactly where the observer window sits for a
	 * whole game. When that timer runs late the socket starts reconnecting
	 * with a dead token and never recovers on its own.
	 */
	const forceRefresh = async (): Promise<string | null> => {
		const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
		if (!refreshToken) { logout(); return null }
		const ok = await refreshAccessToken(refreshToken)
		return ok ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
	}

	return (
		<AuthContext.Provider value={{ user, token, isLoggedIn: !!user, isLoading, login, logout, forceRefresh }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = (): AuthContextType => {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
	return ctx
}
