import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

/**
 * Sends anonymous visitors to sign in and brings them back afterwards.
 *
 * Pages behind this used to render for anyone: the backend refused the
 * request, but only after the person had filled in a whole form and got
 * "Request failed" for their trouble. A game link from Telegram was the same
 * wall with no way through it.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
	const { isLoggedIn, isLoading } = useAuth()
	const location = useLocation()
	const { t } = useTranslation()

	if (isLoading) {
		return (
			<div className='w-full min-h-[50vh] flex items-center justify-center'>
				<span className='text-[13px]' style={{ color: 'var(--text-muted)' }}>{t('room.loading')}</span>
			</div>
		)
	}

	if (!isLoggedIn) {
		const next = encodeURIComponent(location.pathname + location.search)
		return <Navigate to={`/auth?next=${next}`} replace />
	}

	return <>{children}</>
}
