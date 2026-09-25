import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'gamesofsenses_bot'
const REFETCH_AFTER_MS = 10 * 60 * 1000

/**
 * The link that connects this account to the Telegram bot.
 *
 * It carries a short-lived, single-use token rather than the account id: an
 * id is easy to come by, and the bot would happily attach a stranger's chat
 * to that account and start forwarding its game codes, notes and recordings.
 * The token is 32 url-safe characters — Telegram drops a `start` parameter
 * longer than 64 or with any other character, which is why the old JWT link
 * never connected anyone.
 *
 * The token lasts 15 minutes. A new one replaces the old on the server, so it
 * is fetched again only when the one in hand is getting old — not on every
 * focus, which would void a link the person had just opened in Telegram.
 */
export function useTelegramLink(enabled = true): string {
	const { token: authToken } = useAuth()
	const [linkToken, setLinkToken] = useState('')
	const fetchedAtRef = useRef(0)

	const fetchToken = useCallback(() => {
		if (!enabled || !authToken) return
		if (fetchedAtRef.current && Date.now() - fetchedAtRef.current < REFETCH_AFTER_MS) return
		fetchedAtRef.current = Date.now()
		fetch(`${API}/api/telegram/link-token`, { headers: { Authorization: `Bearer ${authToken}` } })
			.then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then(d => setLinkToken(d.token ?? ''))
			.catch(err => {
				fetchedAtRef.current = 0
				console.warn('[telegram] could not get a link token:', err)
			})
	}, [authToken, enabled])

	useEffect(() => {
		fetchToken()
		const onFocus = () => fetchToken()
		window.addEventListener('focus', onFocus)
		return () => window.removeEventListener('focus', onFocus)
	}, [fetchToken])

	// Without a token the link still opens the bot; it just cannot link the
	// account, and the bot explains how to get a proper link.
	return linkToken ? `https://t.me/${BOT}?start=${linkToken}` : `https://t.me/${BOT}`
}
