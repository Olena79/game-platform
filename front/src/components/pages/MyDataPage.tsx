import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { exportAccountRequest, type AccountExport } from '../../actions/auth'

/**
 * Everything the site keeps about the signed-in person, as a page a person
 * can read — not a JSON file. "Save as PDF" is the browser's print dialog;
 * the print styles below leave only the content, black on white. The raw
 * file stays available at the bottom for anyone who wants it.
 */
export const MyDataPage = () => {
	const { t, i18n } = useTranslation()
	const { isDark } = useTheme()
	const { token } = useAuth()
	const [data, setData] = useState<AccountExport | null>(null)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		if (!token) return
		let alive = true
		exportAccountRequest(token)
			.then(d => { if (alive) setData(d) })
			.catch(() => { if (alive) setFailed(true) })
		return () => { alive = false }
	}, [token])

	const locale = i18n.language === 'ua' ? 'uk-UA' : 'en-GB'
	const when = (v?: string | null, withTime = true) => {
		if (!v) return '—'
		const d = new Date(v)
		if (isNaN(d.getTime())) return '—'
		return d.toLocaleString(locale, withTime
			? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
			: { day: 'numeric', month: 'long', year: 'numeric' })
	}

	const downloadRaw = () => {
		if (!data) return
		const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
		const a = document.createElement('a')
		a.href = url
		a.download = 'games-of-senses-data.json'
		a.click()
		URL.revokeObjectURL(url)
	}

	const card = isDark
		? { background: 'rgba(11,13,26,0.7)', border: '1px solid rgba(68,170,255,0.14)' }
		: { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }
	const muted = { color: 'var(--text-muted)' }
	const accent = isDark ? '#0fffc8' : 'var(--accent)'

	const Section = ({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) => (
		<section className='my-data-card rounded-[16px] p-[20px] flex flex-col gap-[12px]' style={card}>
			<h2 className='text-[16px] font-[700]'>
				{title}{count !== undefined && <span className='font-[500]' style={muted}> · {count}</span>}
			</h2>
			{children}
		</section>
	)
	const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
		<div className='flex justify-between gap-[12px] text-[14px]'>
			<span style={muted}>{label}</span>
			<span className='font-[600] text-right break-words min-w-0'>{value}</span>
		</div>
	)
	const Empty = () => <p className='text-[13px]' style={muted}>{t('my_data.none')}</p>
	const Item = ({ children }: { children: React.ReactNode }) => (
		<li className='my-data-item flex flex-col gap-[4px] py-[10px]' style={{ borderTop: '1px solid var(--border-subtle)' }}>{children}</li>
	)

	const a = data?.account
	const fullName = a ? [a.name, a.surname].filter(Boolean).join(' ') : ''

	return (
		<div className='my-data w-full max-w-[720px] mx-auto px-[16px] py-[40px] flex flex-col gap-[18px]'>
			{/* Print: only the content, black on white */}
			<style>{`@media print {
				header, footer, nav, .no-print { display: none !important; }
				html, body, #root { background: #fff !important; }
				.my-data, .my-data * { color: #000 !important; }
				.my-data { padding: 0 !important; max-width: none !important; }
				.my-data-card { background: #fff !important; border: 1px solid #ccc !important; break-inside: avoid-page; }
				.my-data-item { break-inside: avoid; }
				.my-data a { text-decoration: underline; }
			}`}</style>

			<Link to='/account' className='no-print self-start flex items-center gap-[6px] text-[13px] font-[600]' style={{ color: accent }}>
				<ArrowLeft size={14} /> {t('my_data.back')}
			</Link>

			<div className='flex flex-col gap-[8px]'>
				<h1 className='text-[22px] font-[700]'>{t('my_data.title')}</h1>
				<p className='text-[14px] leading-[1.55]' style={{ color: 'var(--text-secondary)' }}>{t('my_data.intro')}</p>
				{data && <p className='text-[12px]' style={muted}>{t('my_data.as_of', { date: when(data.exportedAt) })}</p>}
			</div>

			{!data && !failed && <p className='text-[14px]' style={muted}>{t('my_data.loading')}</p>}
			{failed && <p className='text-[14px]' style={{ color: 'rgb(220,70,90)' }}>{t('account.export_failed')}</p>}

			{data && (
				<>
					<div className='no-print flex flex-wrap gap-[8px]'>
						<button onClick={() => window.print()}
							className='flex items-center gap-[8px] rounded-[10px] px-[16px] py-[9px] text-[13px] font-[600] cursor-pointer'
							style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
							<Printer size={14} /> {t('my_data.print')}
						</button>
					</div>
					<p className='no-print text-[12px] leading-[1.5] -mt-[8px]' style={muted}>{t('my_data.print_hint')}</p>

					<Section title={t('my_data.profile')}>
						<Row label={t('account.name')} value={fullName || <span style={muted}>{t('account.name_empty')}</span>} />
						<Row label={t('account.email')} value={<span className='break-all'>{a?.email}</span>} />
						<Row label={t('my_data.sign_in')} value={[
							a?.hasPassword ? t('my_data.sign_in_password') : null,
							a?.googleId ? 'Google' : null,
						].filter(Boolean).join(', ') || '—'} />
						<Row label='Telegram' value={a?.telegramChatId ? t('account.telegram_on') : t('my_data.telegram_off')} />
						{a?.telegramChatId && (
							<Row label={t('my_data.news')} value={a.newsOptOut ? t('my_data.news_off') : t('my_data.news_on')} />
						)}
						<Row label={t('my_data.member_since')} value={when(a?.createdAt, false)} />
						{a?.communityMuted && <Row label={t('my_data.community')} value={t('my_data.community_muted')} />}
					</Section>

					<Section title={t('my_data.games_created')} count={data.gamesCreated.length}>
						{data.gamesCreated.length === 0 ? <Empty /> : (
							<ul className='flex flex-col -mt-[10px]'>
								{data.gamesCreated.map(g => (
									<Item key={g._id}>
										<span className='text-[15px] font-[600]'>{g.title}</span>
										<span className='text-[12px]' style={muted}>
											{t('my_data.game_date')}: {when(g.scheduledAt)} · {t('my_data.created')}: {when(g.createdAt, false)}
										</span>
										{g.description && <p className='text-[13px] leading-[1.5] whitespace-pre-wrap break-words'>{g.description}</p>}
										{g.scenario && (
											<div className='text-[13px]'>
												<span className='font-[600]' style={muted}>{t('my_data.scenario')}:</span>
												<p className='mt-[2px] leading-[1.5] whitespace-pre-wrap break-words'>{g.scenario}</p>
											</div>
										)}
									</Item>
								))}
							</ul>
						)}
					</Section>

					<Section title={t('my_data.games_joined')} count={data.gamesJoined.length}>
						{data.gamesJoined.length === 0 ? <Empty /> : (
							<ul className='flex flex-col -mt-[10px]'>
								{data.gamesJoined.map(g => (
									<Item key={g._id}>
										<span className='text-[15px] font-[600]'>{g.title}</span>
										<span className='text-[12px]' style={muted}>
											{when(g.scheduledAt)} · {g.as === 'player' ? t('my_data.as_player') : t('my_data.as_spectator')}
										</span>
									</Item>
								))}
							</ul>
						)}
					</Section>

					<Section title={t('my_data.posts')} count={data.posts.length}>
						{data.posts.length === 0 ? <Empty /> : (
							<ul className='flex flex-col -mt-[10px]'>
								{data.posts.map(p => (
									<Item key={p._id}>
										{p.topic && <span className='text-[14px] font-[600]'>{p.topic}</span>}
										<span className='text-[12px]' style={muted}>
											{when(p.createdAt)} · ♥ {p.likesCount ?? 0} · 💬 {p.commentsCount ?? 0}
										</span>
										<p className='text-[13px] leading-[1.5] whitespace-pre-wrap break-words'>{p.text}</p>
									</Item>
								))}
							</ul>
						)}
					</Section>

					<Section title={t('my_data.comments')} count={data.comments.length}>
						{data.comments.length === 0 ? <Empty /> : (
							<ul className='flex flex-col -mt-[10px]'>
								{data.comments.map(c => (
									<Item key={c._id}>
										<span className='text-[12px]' style={muted}>
											{when(c.createdAt)} · {c.post
												? t('my_data.reply_to', { post: c.post.topic || truncate(c.post.text, 60) })
												: t('my_data.reply_to_deleted')}
										</span>
										<p className='text-[13px] leading-[1.5] whitespace-pre-wrap break-words'>{c.text}</p>
									</Item>
								))}
							</ul>
						)}
					</Section>

					<Section title={t('my_data.recordings')} count={data.recordings.length}>
						{data.recordings.length === 0 ? <Empty /> : (
							<ul className='flex flex-col -mt-[10px]'>
								{data.recordings.map(r => {
									const live = r.shareLink && r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()
									return (
										<Item key={r._id}>
											<span className='text-[15px] font-[600]'>{r.gameTitle || '—'}</span>
											<span className='text-[12px]' style={muted}>
												{when(r.createdAt)} · {t(`my_data.rec_status.${r.status}`, { defaultValue: r.status })}
												{r.expiresAt && <> · {t('my_data.rec_until', { date: when(r.expiresAt, false) })}</>}
											</span>
											{live && (
												<a href={r.shareLink} target='_blank' rel='noreferrer' className='text-[13px] font-[600] underline break-all' style={{ color: accent }}>
													{t('my_data.rec_open')}
												</a>
											)}
										</Item>
									)
								})}
							</ul>
						)}
					</Section>

					<p className='no-print text-[12px] leading-[1.5]' style={muted}>
						{t('my_data.raw_hint')}{' '}
						<button onClick={downloadRaw} className='underline cursor-pointer' style={{ color: 'var(--text-secondary)' }}>
							{t('my_data.raw_button')}
						</button>
					</p>
				</>
			)}
		</div>
	)
}

function truncate(s: string, n: number) {
	return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
