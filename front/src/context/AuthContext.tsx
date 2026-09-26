import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { getMeRequest, AuthUser } from '../actions/auth'
import * as Sentry from '@sentry/react'

const ACCESS_TOKEN_KEY = 'mindflow_access_token'
const REFRESH_TOKEN_KEY = 'mindflow_refresh_token'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/** Refresh this long before the access token runs out */
const REFRESH_AHEAD_MS = 5 * 60 * 1000
/** After a network failure, try again this soon rather than signing out */
const RETRY_AFTER_ERROR_MS = 30 * 1000

interface AuthContextType {
	user: AuthUser | null
	token: string | null
	isLoggedIn: boolean
	isLoading: boolean
	login: (accessToken: string, refreshToken: string, user: AuthUser) => void
	logout: () => void
	/** Refreshes the access token now and returns it, or null if that failed */
	forceRefresh: () => Promise<string | null>
	/** The account changed (e.g. its name): show the new version */
	setUserData: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function readStorage(key: string): string | null {
	try { return localStorage.getItem(key) } catch { return null }
}

/** Milliseconds until the token's own expiry claim, or 0 if unreadable. */
function msUntilExpiry(accessToken: string): number {
	try {
		const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
		return payload.exp * 1000 - Date.now()
	} catch {
		return 0
	}
}

type RefreshOutcome = 'ok' | 'rejected' | 'network'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<AuthUser | null>(null)
	const [token, setToken] = useState<string | null>(readStorage(ACCESS_TOKEN_KEY))
	const [isLoading, setIsLoading] = useState(true)
	const refreshTimerRef = useRef<number | null>(null)
	// One refresh at a time per tab: the refresh token is single-use
	const inFlightRef = useRef<Promise<RefreshOutcome> | null>(null)

	/**
	 * Schedules the next refresh from the time the token actually has left.
	 *
	 * It used to count the token's whole lifetime from the moment the page
	 * loaded, so a reload with a half-spent token left the page on an expired
	 * one for up to 55 minutes — every request failing with 401.
	 */
	const scheduleRefresh = (accessToken: string, delayOverride?: number) => {
		if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
		const delay = delayOverride ?? Math.max(0, msUntilExpiry(accessToken) - REFRESH_AHEAD_MS)
		refreshTimerRef.current = window.setTimeout(() => { void runRefresh() }, delay)
	}

	const clearLocal = () => {
		try {
			localStorage.removeItem(ACCESS_TOKEN_KEY)
			localStorage.removeItem(REFRESH_TOKEN_KEY)
		} catch { /* ignore */ }
		setToken(null)
		setUser(null)
		if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
	}

	const doRefresh = async (): Promise<RefreshOutcome> => {
		const refreshToken = readStorage(REFRESH_TOKEN_KEY)
		if (!refreshToken) return 'rejected'
		let response: Response
		try {
			response = await fetch(`${API_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken }),
			})
		} catch (err) {
			Sentry.captureException(err, { tags: { context: 'token-refresh' } })
			return 'network'
		}
		if (response.status >= 500) return 'network'
		if (!response.ok) {
			// Another tab (the game room and its second window share storage)
			// may have spent this refresh token a moment ago and saved the new
			// pair: adopt it instead of treating the session as over.
			const current = readStorage(REFRESH_TOKEN_KEY)
			if (current && current !== refreshToken) {
				const access = readStorage(ACCESS_TOKEN_KEY)
				if (access && msUntilExpiry(access) > 0) {
					setToken(access)
					scheduleRefresh(access)
					return 'ok'
				}
			}
			return 'rejected'
		}
		const data = await response.json()
		try {
			localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
			localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
		} catch { /* private mode: the session lasts as long as the tab */ }
		setToken(data.accessToken)
		scheduleRefresh(data.accessToken)
		return 'ok'
	}

	/**
	 * A refresh whose failure is handled proportionately: a rejected refresh
	 * token ends this session here, a network hiccup is retried shortly.
	 *
	 * It used to call logout() on any error — and logout revokes the refresh
	 * tokens on the server, so a dropped Wi-Fi signal signed the person out of
	 * every device they had.
	 */
	const runRefresh = async (): Promise<RefreshOutcome> => {
		if (!inFlightRef.current) {
			inFlightRef.current = doRefresh().finally(() => { inFlightRef.current = null })
		}
		const outcome = await inFlightRef.current
		if (outcome === 'rejected') clearLocal()
		if (outcome === 'network') {
			const access = readStorage(ACCESS_TOKEN_KEY)
			if (access) scheduleRefresh(access, RETRY_AFTER_ERROR_MS)
		}
		return outcome
	}

	useEffect(() => {
		const savedAccessToken = readStorage(ACCESS_TOKEN_KEY)

		if (!savedAccessToken) {
			setIsLoading(false)
			return
		}

		const load = async () => {
			try {
				let access = savedAccessToken
				if (msUntilExpiry(access) <= 0) {
					if (await runRefresh() !== 'ok') return
					access = readStorage(ACCESS_TOKEN_KEY) ?? ''
				}
				setUser(await getMeRequest(access))
				setToken(access)
				scheduleRefresh(access)
			} catch {
				// Rejected (password changed, account gone) or unreachable: one
				// refresh decides which, without throwing the tokens away first.
				if (await runRefresh() === 'ok') {
					const access = readStorage(ACCESS_TOKEN_KEY)
					if (access) await getMeRequest(access).then(setUser).catch(() => undefined)
				}
			} finally {
				setIsLoading(false)
			}
		}
		void load()

		// Other tabs refresh too: follow their tokens instead of spending the
		// same single-use refresh token twice.
		const onStorage = (e: StorageEvent) => {
			if (e.key !== ACCESS_TOKEN_KEY) return
			if (e.newValue) {
				setToken(e.newValue)
				scheduleRefresh(e.newValue)
			} else {
				setToken(null)
				setUser(null)
				if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
			}
		}
		window.addEventListener('storage', onStorage)

		return () => {
			window.removeEventListener('storage', onStorage)
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const login = (accessToken: string, refreshToken: string, userData: AuthUser) => {
		try {
			localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
			localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
		} catch { /* ignore */ }
		setToken(accessToken)
		setUser(userData)
		scheduleRefresh(accessToken)
	}

	/** Signing out on purpose: the server revokes this account's refresh tokens. */
	const logout = () => {
		const accessToken = readStorage(ACCESS_TOKEN_KEY)
		if (accessToken) {
			fetch(`${API_URL}/api/auth/logout`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				keepalive: true,
			}).catch(() => { /* leaving anyway */ })
		}
		clearLocal()
	}

	/**
	 * Refresh on demand and hand back the new access token.
	 *
	 * Browsers throttle timers in background tabs, so the scheduled refresh can
	 * run late; the socket calls this when its handshake is refused.
	 */
	const forceRefresh = async (): Promise<string | null> => {
		const outcome = await runRefresh()
		return outcome === 'ok' ? readStorage(ACCESS_TOKEN_KEY) : null
	}

	return (
		<AuthContext.Provider value={{ user, token, isLoggedIn: !!user, isLoading, login, logout, forceRefresh, setUserData: setUser }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = (): AuthContextType => {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
	return ctx
}
