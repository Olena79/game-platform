import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'

export const TermsOfServicePage = () => {
	const { t } = useTranslation()
	const { isDark } = useTheme()

	return (
		<div className='min-h-screen px-4 py-12 md:py-16'>
			<div className='max-w-3xl mx-auto'>
				<h1
					className='text-3xl md:text-4xl font-bold mb-8'
					style={{ color: isDark ? '#44aaff' : 'var(--text)' }}
				>
					{t('nav.terms_of_service')}
				</h1>

				<div
					className='prose prose-invert max-w-none'
					style={{ color: isDark ? 'rgba(180,200,255,0.9)' : 'var(--text)' }}
				>
					{/* Last Updated */}
					<p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>
						{t('legal.last_updated')}: 2026-09-02
					</p>

					{/* Acceptance */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.terms_acceptance_title')}
						</h2>
						<p>{t('legal.terms_acceptance_text')}</p>
					</section>

					{/* Use License */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.use_license_title')}
						</h2>
						<p>{t('legal.use_license_text')}</p>
					</section>

					{/* Game Platform */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.platform_title')}
						</h2>
						<p>{t('legal.platform_desc')}</p>
						<ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '12px' }}>
							<li>{t('legal.platform_facilitation')}</li>
							<li>{t('legal.platform_no_intermediary')}</li>
							<li>{t('legal.platform_gm_responsibilities')}</li>
							<li>{t('legal.platform_payment_responsibility')}</li>
						</ul>
					</section>

					{/* Payments & Donations */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.payments_title')}
						</h2>
						<p>{t('legal.payments_intro')}</p>
						<p style={{ marginTop: '12px' }}><strong>{t('legal.payments_how')}</strong></p>
						<p style={{ marginTop: '8px' }}>{t('legal.payments_how_text')}</p>
						<p style={{ marginTop: '12px' }}><strong>{t('legal.payments_gm_responsibility')}</strong></p>
						<p style={{ marginTop: '8px' }}>{t('legal.payments_gm_responsibility_text')}</p>
						<p style={{ marginTop: '12px' }}><strong>{t('legal.payments_platform_responsibility')}</strong></p>
						<p style={{ marginTop: '8px' }}>{t('legal.payments_platform_responsibility_text')}</p>
						<p style={{ marginTop: '12px' }}><strong>{t('legal.payments_disputes')}</strong></p>
						<p style={{ marginTop: '8px' }}>{t('legal.payments_disputes_text')}</p>
					</section>

					{/* User Responsibilities */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.user_responsibilities_title')}
						</h2>
						<p>{t('legal.user_responsibilities_text')}</p>
						<ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '12px' }}>
							<li>{t('legal.responsibility_accurate')}</li>
							<li>{t('legal.responsibility_legal')}</li>
							<li>{t('legal.responsibility_content')}</li>
							<li>{t('legal.responsibility_behavior')}</li>
							<li>{t('legal.responsibility_compliance')}</li>
						</ul>
					</section>

					{/* GM Responsibilities */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.gm_responsibilities_title')}
						</h2>
						<p>{t('legal.gm_responsibilities_text')}</p>
						<ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '12px' }}>
							<li>{t('legal.gm_responsibility_create')}</li>
							<li>{t('legal.gm_responsibility_price')}</li>
							<li>{t('legal.gm_responsibility_conduct')}</li>
							<li>{t('legal.gm_responsibility_safe')}</li>
							<li>{t('legal.gm_responsibility_participants')}</li>
						</ul>
					</section>

					{/* Conduct */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.conduct_title')}
						</h2>
						<p>{t('legal.conduct_intro')}</p>
						<p style={{ marginTop: '12px' }}>Users agree NOT to:</p>
						<ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '12px' }}>
							<li>{t('legal.conduct_harass')}</li>
							<li>{t('legal.conduct_illegal')}</li>
							<li>{t('legal.conduct_spam')}</li>
							<li>{t('legal.conduct_malware')}</li>
							<li>{t('legal.conduct_impersonate')}</li>
							<li>{t('legal.conduct_interfere')}</li>
						</ul>
					</section>

					{/* Content Rights */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.content_rights_title')}
						</h2>
						<p>{t('legal.content_rights_user')}</p>
						<p style={{ marginTop: '12px' }}>{t('legal.content_rights_grant')}</p>
						<p style={{ marginTop: '12px' }}>{t('legal.content_rights_removal')}</p>
					</section>

					{/* Recordings */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.recordings_title')}
						</h2>
						<p>{t('legal.recordings_text')}</p>
						<ul style={{ listStyle: 'disc', marginLeft: '20px', marginTop: '12px' }}>
							<li>{t('legal.recordings_storage')}</li>
							<li>{t('legal.recordings_deletion')}</li>
							<li>{t('legal.recordings_consent')}</li>
						</ul>
					</section>

					{/* Disclaimer */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.disclaimer_title')}
						</h2>
						<p>{t('legal.disclaimer_text')}</p>
					</section>

					{/* Limitation */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.limitation_title')}
						</h2>
						<p>{t('legal.limitation_text')}</p>
					</section>

					{/* Termination */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.termination_title')}
						</h2>
						<p>{t('legal.termination_text')}</p>
					</section>

					{/* Disputes */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.disputes_title')}
						</h2>
						<p>{t('legal.disputes_text')}</p>
					</section>

					{/* Contact */}
					<section className='mb-8'>
						<h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: isDark ? '#44aaff' : 'var(--text)' }}>
							{t('legal.contact_title')}
						</h2>
						<p>{t('legal.contact_text')}</p>
						<p style={{ marginTop: '12px' }}>
							Email: <a href='mailto:foksysmile@gmail.com' style={{ color: isDark ? '#44aaff' : 'var(--accent)' }}>foksysmile@gmail.com</a>
						</p>
					</section>
				</div>
			</div>
		</div>
	)
}
