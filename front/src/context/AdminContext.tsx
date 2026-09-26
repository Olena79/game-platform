import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const STORAGE_KEY = 'gos-admin-session'

interface AdminSession { token: string; expiresAt: number }

interface AdminContextType {
	/** An admin session is open in this tab */
	active: boolean
	expiresAt: number | null
	open: (session: AdminSession) => void
	close: () => Promise<void>
	/** fetch against /api/admin with both tokens; a lapsed session closes itself */
	adminFetch: (path: string, init?: RequestInit) => Promise<Response>
}

const AdminContext = createContext<AdminContextType | null>(null)

function read(): AdminSession | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const s = JSON.parse(raw) as AdminSession
		return s.expiresAt > Date.now() ? s : null
	} catch { return null }
}

function write(s: AdminSession | null): void {
	try {
		if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
		else sessionStorage.removeItem(STORAGE_KEY)
	} catch { /* the session then lasts only while the page is open */ }
}

/**
 * The administrator's session. Kept in sessionStorage — this tab only, gone
 * when it closes — and worth nothing without the account's own sign-in: the
 * server checks both, and that the session was opened by this account.
 */
export const AdminProvider = ({ children }: { children: ReactNode }) => {
	const { token, isLoggedIn } = useAuth()
	const [session, setSession] = useState<AdminSession | null>(() => read())

	const open = useCallback((s: AdminSession) => { write(s); setSession(s) }, [])
	const drop = useCallback(() => { write(null); setSession(null) }, [])

	// Signing out of the account ends the admin session too
	useEffect(() => { if (!isLoggedIn && session) drop() }, [isLoggedIn, session, drop])

	// Lapses on its own after an hour
	useEffect(() => {
		if (!session) return
		const id = setTimeout(drop, Math.max(0, session.expiresAt - Date.now()))
		return () => clearTimeout(id)
	}, [session, drop])

	const adminFetch = useCallback(async (path: string, init: RequestInit = {}) => {
		const res = await fetch(`${API_URL}/api/admin${path}`, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(session ? { 'X-Admin-Token': session.token } : {}),
				...(init.headers ?? {}),
			},
		})
		if (res.status === 401 && session) {
			const body = await res.clone().json().catch(() => ({}))
			if (body?.message === 'ADMIN_SESSION_REQUIRED') drop()
		}
		return res
	}, [token, session, drop])

	const close = useCallback(async () => {
		await adminFetch('/logout', { method: 'POST' }).catch(() => undefined)
		drop()
	}, [adminFetch, drop])

	return (
		<AdminContext.Provider value={{ active: !!session, expiresAt: session?.expiresAt ?? null, open, close, adminFetch }}>
			{children}
		</AdminContext.Provider>
	)
}

export const useAdmin = (): AdminContextType => {
	const ctx = useContext(AdminContext)
	if (!ctx) throw new Error('useAdmin must be used inside AdminProvider')
	return ctx
}
