import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'gamesofsenses_bot'

/**
 * The link that connects this account to the Telegram bot.
 *
 * It carries a short-lived signed token rather than the account id: an id is
 * easy to come by, and the bot would happily attach a stranger's chat to that
 * account and start forwarding its game codes, notes and recordings.
 *
 * The token lasts 15 minutes, so it is refreshed when the tab is focused.
 */
export function useTelegramLink(enabled = true): string {
	const { token: authToken } = useAuth()
	const [linkToken, setLinkToken] = useState('')

	const fetchToken = useCallback(() => {
		if (!enabled || !authToken) return
		fetch(`${API}/api/telegram/link-token`, { headers: { Authorization: `Bearer ${authToken}` } })
			.then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then(d => setLinkToken(d.token ?? ''))
			.catch(err => console.warn('[telegram] could not get a link token:', err))
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
