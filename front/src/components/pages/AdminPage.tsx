import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, LogOut, RefreshCw } from 'lucide-react'
import { useAdmin } from '../../context/AdminContext'

// ── Shared bits ──────────────────────────────────────────────────────────────

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }
const input: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }

function when(value: string | number | null | undefined, withTime = true): string {
	if (!value) return '—'
	const d = new Date(value)
	if (isNaN(d.getTime())) return '—'
	return new Intl.DateTimeFormat('uk-UA', {
		day: 'numeric', month: 'short', year: 'numeric',
		...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
		timeZone: 'Europe/Kyiv',
	}).format(d)
}

function size(bytes: number): string {
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
	return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`
}

function Btn({ children, onClick, tone = 'plain', disabled }: {
	children: React.ReactNode; onClick: () => void; tone?: 'plain' | 'danger' | 'accent'; disabled?: boolean
}) {
	const style: React.CSSProperties = tone === 'danger'
		? { background: 'rgba(220,60,80,0.08)', border: '1px solid rgba(220,60,80,0.4)', color: 'rgb(220,70,90)' }
		: tone === 'accent'
			? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }
			: { background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }
	return (
		<button type='button' onClick={onClick} disabled={disabled} style={style}
			className='px-[10px] py-[5px] rounded-[8px] text-[12px] font-[600] cursor-pointer transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'>
			{children}
		</button>
	)
}

function Badge({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'danger' | 'ok' | 'warn' }) {
	const color = tone === 'danger' ? 'rgb(220,70,90)' : tone === 'ok' ? 'rgb(20,170,130)' : tone === 'warn' ? 'rgb(210,140,30)' : 'var(--text-muted)'
	return <span className='text-[11px] font-[600] px-[7px] py-[2px] rounded-[6px]' style={{ color, border: `1px solid ${color}` }}>{children}</span>
}

/** Loads a list from the admin API, with a reload. */
function useAdminList<T>(path: string) {
	const { adminFetch } = useAdmin()
	const [data, setData] = useState<T | null>(null)
	const [error, setError] = useState(false)
	const reload = useCallback(async () => {
		setError(false)
		try {
			const res = await adminFetch(path)
			if (!res.ok) throw new Error(String(res.status))
			setData(await res.json())
		} catch { setError(true) }
	}, [adminFetch, path])
	useEffect(() => { void reload() }, [reload])
	return { data, error, reload }
}

function Loading({ error }: { error: boolean }) {
	const { t } = useTranslation()
	return <p className='text-[13px] py-[20px]' style={{ color: 'var(--text-muted)' }}>{error ? t('admin.load_error') : t('admin.loading')}</p>
}

/** Runs an admin action; says so if it failed. */
function useAction() {
	const { adminFetch } = useAdmin()
	const { t } = useTranslation()
	return useCallback(async (path: string, init: RequestInit): Promise<boolean> => {
		try {
			const res = await adminFetch(path, init)
			if (res.ok) return true
		} catch { /* below */ }
		window.alert(t('admin.action_failed'))
		return false
	}, [adminFetch, t])
}

// ── Sign-in ──────────────────────────────────────────────────────────────────

function AdminLogin() {
	const { t } = useTranslation()
	const { adminFetch, open } = useAdmin()
	const [step, setStep] = useState<'phrase' | 'code'>('phrase')
	const [phrase, setPhrase] = useState('')
	const [code, setCode] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const explain = async (res: Response): Promise<string> => {
		if (res.status === 404) return t('admin.login.not_admin')
		const body = await res.json().catch(() => ({})) as { message?: string; until?: number; locked?: boolean }
		if (body.message === 'LOCKED' || body.locked) return t('admin.login.locked', { time: when(body.until ?? Date.now() + 3600_000) })
		const known = ['WRONG_PASSPHRASE', 'WRONG_CODE', 'CODE_EXPIRED', 'NO_TELEGRAM', 'CODE_NOT_SENT']
		return body.message && known.includes(body.message) ? t(`admin.login.${body.message}`) : t('admin.action_failed')
	}

	const sendPhrase = async () => {
		if (!phrase || busy) return
		setBusy(true); setError('')
		try {
			const res = await adminFetch('/login', { method: 'POST', body: JSON.stringify({ passphrase: phrase }) })
			if (res.ok) { setStep('code'); setPhrase('') }
			else setError(await explain(res))
		} catch { setError(t('admin.action_failed')) }
		setBusy(false)
	}

	const sendCode = async () => {
		if (code.length !== 6 || busy) return
		setBusy(true); setError('')
		try {
			const res = await adminFetch('/verify', { method: 'POST', body: JSON.stringify({ code }) })
			if (res.ok) open(await res.json())
			else {
				const msg = await explain(res)
				setError(msg)
				if (res.status === 401) setCode('')
			}
		} catch { setError(t('admin.action_failed')) }
		setBusy(false)
	}

	return (
		<div className='w-full max-w-[420px] mx-auto rounded-[16px] p-[22px] flex flex-col gap-[14px]' style={card}>
			<div className='flex items-center gap-[8px]'>
				<ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
				<h1 className='text-[18px] font-[700]' style={{ color: 'var(--text-primary)' }}>{t('admin.login.title')}</h1>
			</div>
			{step === 'phrase' ? (
				<form className='flex flex-col gap-[10px]' onSubmit={e => { e.preventDefault(); void sendPhrase() }}>
					<label className='text-[13px]' style={{ color: 'var(--text-secondary)' }}>{t('admin.login.phrase_label')}</label>
					<input type='password' autoComplete='off' autoFocus value={phrase} onChange={e => setPhrase(e.target.value)}
						className='w-full rounded-[10px] px-[12px] py-[10px] text-[14px] focus:outline-none' style={input} />
					<Btn tone='accent' onClick={() => void sendPhrase()} disabled={!phrase || busy}>{t('admin.login.next')}</Btn>
				</form>
			) : (
				<form className='flex flex-col gap-[10px]' onSubmit={e => { e.preventDefault(); void sendCode() }}>
					<label className='text-[13px]' style={{ color: 'var(--text-secondary)' }}>{t('admin.login.code_label')}</label>
					<input type='text' inputMode='numeric' pattern='[0-9]*' autoComplete='one-time-code' autoFocus maxLength={6}
						value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
						className='w-full rounded-[10px] px-[12px] py-[10px] text-[20px] tracking-[6px] text-center font-[700] focus:outline-none' style={input} />
					<Btn tone='accent' onClick={() => void sendCode()} disabled={code.length !== 6 || busy}>{t('admin.login.enter')}</Btn>
					<button type='button' onClick={() => { setStep('phrase'); setCode(''); setError('') }}
						className='text-[12px] underline cursor-pointer self-start' style={{ color: 'var(--text-muted)' }}>
						{t('admin.login.again')}
					</button>
				</form>
			)}
			{error && <p className='text-[13px]' style={{ color: 'rgb(220,70,90)' }}>{error}</p>}
		</div>
	)
}

// ── Sections ─────────────────────────────────────────────────────────────────

interface Stats {
	users: number; telegram: number; blocked: number; muted: number; newUsers: number
	games: number; upcoming: number; posts: number; comments: number
	recordings: number; recordingBytes: number; openRooms: number; activeRooms: number
}

function Overview() {
	const { t } = useTranslation()
	const { data, error, reload } = useAdminList<Stats>('/stats')
	if (!data) return <Loading error={error} />
	const tiles: Array<[string, string | number, string?]> = [
		[t('admin.stats.users'), data.users, t('admin.stats.new_week', { n: data.newUsers })],
		[t('admin.stats.telegram'), data.telegram, t('admin.stats.of_users', { n: data.users })],
		[t('admin.stats.blocked'), data.blocked, t('admin.stats.muted', { n: data.muted })],
		[t('admin.stats.games'), data.games, t('admin.stats.upcoming', { n: data.upcoming })],
		[t('admin.stats.rooms'), data.openRooms, t('admin.stats.active', { n: data.activeRooms })],
		[t('admin.stats.recordings'), data.recordings, t('admin.stats.storage', { size: size(data.recordingBytes) })],
		[t('admin.stats.posts'), data.posts, t('admin.stats.comments', { n: data.comments })],
	]
	return (
		<div className='flex flex-col gap-[12px]'>
			<div className='grid grid-cols-2 md:grid-cols-4 gap-[10px]'>
				{tiles.map(([label, value, sub]) => (
					<div key={label} className='rounded-[12px] p-[14px] flex flex-col gap-[4px]' style={card}>
						<span className='text-[12px]' style={{ color: 'var(--text-muted)' }}>{label}</span>
						<span className='text-[24px] font-[700]' style={{ color: 'var(--text-primary)' }}>{value}</span>
						{sub && <span className='text-[11px]' style={{ color: 'var(--text-faint)' }}>{sub}</span>}
					</div>
				))}
			</div>
			<p className='text-[12px]' style={{ color: 'var(--text-faint)' }}>{t('admin.stats.storage_note')}</p>
			<div><Btn onClick={() => void reload()}><RefreshCw size={12} className='inline mr-[4px]' />{t('admin.refresh')}</Btn></div>
		</div>
	)
}

interface AdminUser {
	id: string; name: string; surname: string; email: string
	google: boolean; telegram: boolean; newsOptOut: boolean
	blockedAt: string | null; blockReason: string; communityMuted: boolean
	createdAt: string; gamesCreated: number; gamesJoined: number; isAdmin: boolean
}

function Users() {
	const { t } = useTranslation()
	const [q, setQ] = useState('')
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState('')
	const { data, error, reload } = useAdminList<AdminUser[]>(`/users?q=${encodeURIComponent(query)}&filter=${filter}`)
	const act = useAction()

	useEffect(() => {
		const id = setTimeout(() => setQuery(q.trim()), 300)
		return () => clearTimeout(id)
	}, [q])

	const name = (u: AdminUser) => [u.name, u.surname].filter(Boolean).join(' ') || u.email.split('@')[0]

	const block = async (u: AdminUser) => {
		const reason = window.prompt(t('admin.users.block_prompt', { name: name(u) }))
		if (reason === null) return
		if (await act(`/users/${u.id}/block`, { method: 'POST', body: JSON.stringify({ reason }) })) void reload()
	}
	const simple = async (u: AdminUser, path: string, confirmKey?: string) => {
		if (confirmKey && !window.confirm(t(confirmKey, { name: name(u) }))) return
		if (await act(`/users/${u.id}${path}`, { method: path ? 'POST' : 'DELETE' })) void reload()
	}
	const remove = async (u: AdminUser) => {
		if (!window.confirm(t('admin.users.delete_confirm', { name: name(u), email: u.email }))) return
		if (await act(`/users/${u.id}`, { method: 'DELETE' })) void reload()
	}

	return (
		<div className='flex flex-col gap-[12px]'>
			<div className='flex flex-col sm:flex-row gap-[8px]'>
				<input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.users.search')}
					className='flex-1 rounded-[10px] px-[12px] py-[8px] text-[14px] focus:outline-none' style={input} />
				<select value={filter} onChange={e => setFilter(e.target.value)}
					className='rounded-[10px] px-[10px] py-[8px] text-[13px] focus:outline-none' style={input}>
					<option value=''>{t('admin.users.filter_all')}</option>
					<option value='blocked'>{t('admin.users.filter_blocked')}</option>
					<option value='muted'>{t('admin.users.filter_muted')}</option>
					<option value='no-telegram'>{t('admin.users.filter_no_telegram')}</option>
				</select>
			</div>
			{!data ? <Loading error={error} /> : data.length === 0 ? <p className='text-[13px]' style={{ color: 'var(--text-muted)' }}>{t('admin.empty')}</p> : (
				<div className='flex flex-col gap-[8px]'>
					{data.map(u => (
						<div key={u.id} className='rounded-[12px] p-[12px] flex flex-col gap-[8px]' style={card}>
							<div className='flex flex-wrap items-center gap-[6px]'>
								<span className='text-[14px] font-[700]' style={{ color: 'var(--text-primary)' }}>{name(u)}</span>
								<span className='text-[12px] break-all' style={{ color: 'var(--text-muted)' }}>{u.email}</span>
							</div>
							<div className='flex flex-wrap gap-[5px]'>
								{u.isAdmin && <Badge tone='ok'>{t('admin.users.badge_admin')}</Badge>}
								{u.blockedAt && <Badge tone='danger'>{t('admin.users.badge_blocked')}</Badge>}
								{u.communityMuted && <Badge tone='warn'>{t('admin.users.badge_muted')}</Badge>}
								<Badge tone={u.telegram ? 'ok' : 'plain'}>{u.telegram ? 'Telegram ✓' : t('admin.users.no_telegram')}</Badge>
								{u.google && <Badge>Google</Badge>}
								{u.newsOptOut && <Badge>/stop</Badge>}
							</div>
							<p className='text-[12px]' style={{ color: 'var(--text-muted)' }}>
								{t('admin.users.meta', { date: when(u.createdAt, false), created: u.gamesCreated, joined: u.gamesJoined })}
							</p>
							{u.blockedAt && (
								<p className='text-[12px]' style={{ color: 'rgb(220,70,90)' }}>
									{t('admin.users.blocked_since', { date: when(u.blockedAt) })}{u.blockReason ? ` — ${u.blockReason}` : ''}
								</p>
							)}
							{!u.isAdmin && (
								<div className='flex flex-wrap gap-[6px]'>
									{u.blockedAt
										? <Btn onClick={() => void simple(u, '/unblock', 'admin.users.unblock_confirm')}>{t('admin.users.unblock')}</Btn>
										: <Btn tone='danger' onClick={() => void block(u)}>{t('admin.users.block')}</Btn>}
									{u.communityMuted
										? <Btn onClick={() => void simple(u, '/unmute')}>{t('admin.users.unmute')}</Btn>
										: <Btn onClick={() => void simple(u, '/mute', 'admin.users.mute_confirm')}>{t('admin.users.mute')}</Btn>}
									<Btn tone='danger' onClick={() => void remove(u)}>{t('admin.users.delete')}</Btn>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

interface AdminGame {
	id: string; title: string; creatorName: string; scheduledAt: string | null
	participationCost: number; maxPlayers: number; players: number; spectators: number
	createdAt: string; roomOpen: boolean
}

function Games() {
	const { t } = useTranslation()
	const { data, error, reload } = useAdminList<AdminGame[]>('/games')
	const act = useAction()
	const remove = async (g: AdminGame) => {
		if (!window.confirm(t('admin.games.delete_confirm', { title: g.title }))) return
		if (await act(`/games/${g.id}`, { method: 'DELETE' })) void reload()
	}
	if (!data) return <Loading error={error} />
	if (data.length === 0) return <p className='text-[13px]' style={{ color: 'var(--text-muted)' }}>{t('admin.empty')}</p>
	return (
		<div className='flex flex-col gap-[8px]'>
			{data.map(g => (
				<div key={g.id} className='rounded-[12px] p-[12px] flex flex-col sm:flex-row sm:items-center gap-[8px]' style={card}>
					<div className='flex-1 min-w-0 flex flex-col gap-[3px]'>
						<div className='flex flex-wrap items-center gap-[6px]'>
							<span className='text-[14px] font-[700]' style={{ color: 'var(--text-primary)' }}>{g.title}</span>
							{g.roomOpen && <Badge tone='ok'>{t('admin.games.room_open')}</Badge>}
						</div>
						<p className='text-[12px]' style={{ color: 'var(--text-muted)' }}>
							{g.creatorName} · 📅 {when(g.scheduledAt)} · {g.participationCost > 0 ? `${g.participationCost} грн` : t('admin.games.free')}
						</p>
						<p className='text-[12px]' style={{ color: 'var(--text-faint)' }}>
							{t('admin.games.people', { players: g.players, max: g.maxPlayers, spectators: g.spectators })}
						</p>
					</div>
					<Btn tone='danger' onClick={() => void remove(g)}>{t('admin.games.delete')}</Btn>
				</div>
			))}
		</div>
	)
}

interface AdminRoom {
	gameId: string; title: string; status: 'lobby' | 'started' | 'ended'
	players: number; spectators: number; gamemasterOnline: boolean; isRecording: boolean; breakouts: number
}

function Rooms() {
	const { t } = useTranslation()
	const { data, error, reload } = useAdminList<AdminRoom[]>('/rooms')
	const act = useAction()
	useEffect(() => {
		const id = setInterval(() => void reload(), 15_000)
		return () => clearInterval(id)
	}, [reload])
	const close = async (r: AdminRoom) => {
		if (!window.confirm(t('admin.rooms.close_confirm', { title: r.title }))) return
		if (await act(`/rooms/${r.gameId}/close`, { method: 'POST' })) void reload()
	}
	if (!data) return <Loading error={error} />
	return (
		<div className='flex flex-col gap-[8px]'>
			<p className='text-[12px]' style={{ color: 'var(--text-faint)' }}>{t('admin.rooms.note')}</p>
			{data.length === 0 ? <p className='text-[13px]' style={{ color: 'var(--text-muted)' }}>{t('admin.rooms.none')}</p> : data.map(r => (
				<div key={r.gameId} className='rounded-[12px] p-[12px] flex flex-col sm:flex-row sm:items-center gap-[8px]' style={card}>
					<div className='flex-1 min-w-0 flex flex-col gap-[4px]'>
						<div className='flex flex-wrap items-center gap-[6px]'>
							<span className='text-[14px] font-[700]' style={{ color: 'var(--text-primary)' }}>{r.title}</span>
							<Badge tone={r.status === 'started' ? 'ok' : 'plain'}>{t(`admin.rooms.status_${r.status}`)}</Badge>
							{r.isRecording && <Badge tone='danger'>● REC</Badge>}
						</div>
						<p className='text-[12px]' style={{ color: 'var(--text-muted)' }}>
							{t('admin.rooms.people', { players: r.players, spectators: r.spectators })}
							{' · '}{r.gamemasterOnline ? t('admin.rooms.gm_here') : t('admin.rooms.gm_away')}
							{r.breakouts > 0 ? ` · ${t('admin.rooms.breakouts', { n: r.breakouts })}` : ''}
						</p>
					</div>
					{r.status !== 'ended' && <Btn tone='danger' onClick={() => void close(r)}>{t('admin.rooms.close')}</Btn>}
				</div>
			))}
		</div>
	)
}

interface AdminRecording {
	id: string; gameTitle: string; gmName: string; mode: string; contentType: string
	status: string; interrupted: boolean; error: string; bytes: number
	shareLink: string; createdAt: string; expiresAt: string
}

function Recordings() {
	const { t } = useTranslation()
	const { data, error, reload } = useAdminList<AdminRecording[]>('/recordings')
	const act = useAction()
	const remove = async (r: AdminRecording) => {
		if (!window.confirm(t('admin.recordings.delete_confirm', { title: r.gameTitle }))) return
		if (await act(`/recordings/${r.id}`, { method: 'DELETE' })) void reload()
	}
	if (!data) return <Loading error={error} />
	if (data.length === 0) return <p className='text-[13px]' style={{ color: 'var(--text-muted)' }}>{t('admin.empty')}</p>
	return (
		<div className='flex flex-col gap-[8px]'>
			{data.map(r => (
				<div key={r.id} className='rounded-[12px] p-[12px] flex flex-col sm:flex-row sm:items-center gap-[8px]' style={card}>
					<div className='flex-1 min-w-0 flex flex-col gap-[4px]'>
						<div className='flex flex-wrap items-center gap-[6px]'>
							<span className='text-[14px] font-[700]' style={{ color: 'var(--text-primary)' }}>{r.gameTitle || '—'}</span>
							<Badge tone={r.status === 'completed' ? 'ok' : r.status === 'failed' ? 'danger' : 'warn'}>{t(`admin.recordings.status_${r.status}`)}</Badge>
							{r.interrupted && <Badge tone='warn'>{t('admin.recordings.interrupted')}</Badge>}
							<Badge>{r.contentType.startsWith('audio/') ? t('admin.recordings.audio') : t('admin.recordings.video')}</Badge>
						</div>
						<p className='text-[12px]' style={{ color: 'var(--text-muted)' }}>
							{r.gmName} · {when(r.createdAt)} · {size(r.bytes)} · {t('admin.recordings.until', { date: when(r.expiresAt, false) })}
						</p>
						{r.error && <p className='text-[12px]' style={{ color: 'rgb(220,70,90)' }}>{r.error}</p>}
					</div>
					<div className='flex gap-[6px]'>
						{r.shareLink && <a href={r.shareLink} target='_blank' rel='noreferrer'><Btn tone='accent' onClick={() => undefined}>{t('admin.recordings.open')}</Btn></a>}
						<Btn tone='danger' onClick={() => void remove(r)}>{t('admin.recordings.delete')}</Btn>
					</div>
				</div>
			))}
		</div>
	)
}

function Broadcast() {
	const { t } = useTranslation()
	const { adminFetch } = useAdmin()
	const [text, setText] = useState('')
	const [busy, setBusy] = useState(false)
	const [result, setResult] = useState('')
	const send = async () => {
		if (!text.trim() || busy) return
		if (!window.confirm(t('admin.broadcast.confirm'))) return
		setBusy(true); setResult('')
		try {
			const res = await adminFetch('/broadcast', { method: 'POST', body: JSON.stringify({ text }) })
			if (res.ok) {
				const body = await res.json() as { recipients: number }
				setResult(t('admin.broadcast.started', { n: body.recipients }))
				setText('')
			} else setResult(t('admin.action_failed'))
		} catch { setResult(t('admin.action_failed')) }
		setBusy(false)
	}
	return (
		<div className='flex flex-col gap-[10px] max-w-[640px]'>
			<p className='text-[13px] leading-[1.5]' style={{ color: 'var(--text-secondary)' }}>{t('admin.broadcast.lead')}</p>
			<textarea value={text} onChange={e => setText(e.target.value.slice(0, 3500))} rows={7}
				placeholder={t('admin.broadcast.placeholder')}
				className='w-full rounded-[10px] px-[12px] py-[10px] text-[14px] leading-[1.5] focus:outline-none resize-y' style={input} />
			<div className='flex items-center justify-between gap-[8px]'>
				<span className='text-[11px]' style={{ color: 'var(--text-faint)' }}>{text.length} / 3500</span>
				<Btn tone='accent' onClick={() => void send()} disabled={!text.trim() || busy}>{t('admin.broadcast.send')}</Btn>
			</div>
			{result && <p className='text-[13px]' style={{ color: 'var(--text-secondary)' }}>{result}</p>}
		</div>
	)
}

interface LogEntry { id: string; action: string; target: string; detail: string; ip: string; createdAt: string }

function Journal() {
	const { t } = useTranslation()
	const { data, error } = useAdminList<LogEntry[]>('/log')
	if (!data) return <Loading error={error} />
	if (data.length === 0) return <p className='text-[13px]' style={{ color: 'var(--text-muted)' }}>{t('admin.empty')}</p>
	return (
		<div className='flex flex-col gap-[6px]'>
			{data.map(e => (
				<div key={e.id} className='rounded-[10px] px-[12px] py-[8px] flex flex-col gap-[2px]' style={card}>
					<div className='flex flex-wrap items-center gap-[8px]'>
						<span className='text-[12px] font-[700]' style={{ color: e.action === 'login-failed' ? 'rgb(220,70,90)' : 'var(--text-primary)' }}>
							{t(`admin.log.${e.action}`, { defaultValue: e.action })}
						</span>
						<span className='text-[11px]' style={{ color: 'var(--text-faint)' }}>{when(e.createdAt)} · IP {e.ip || '?'}</span>
					</div>
					{e.detail && <span className='text-[12px] break-words' style={{ color: 'var(--text-muted)' }}>{e.detail}</span>}
				</div>
			))}
		</div>
	)
}

// ── The page ─────────────────────────────────────────────────────────────────

const TABS = ['overview', 'users', 'games', 'rooms', 'recordings', 'broadcast', 'log'] as const
type Tab = typeof TABS[number]

export const AdminPage = () => {
	const { t } = useTranslation()
	const { active, expiresAt, close } = useAdmin()
	const [tab, setTab] = useState<Tab>('overview')

	useEffect(() => { document.title = t('admin.title') }, [t])

	return (
		<div className='w-full max-w-[1100px] mx-auto px-[16px] md:px-[32px] py-[24px] md:py-[36px] flex flex-col gap-[18px]'>
			{!active ? <AdminLogin /> : (
				<>
					<div className='flex flex-wrap items-center justify-between gap-[10px]'>
						<div className='flex items-center gap-[8px]'>
							<ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
							<h1 className='text-[20px] font-[700]' style={{ color: 'var(--text-primary)' }}>{t('admin.title')}</h1>
						</div>
						<div className='flex items-center gap-[10px]'>
							<span className='text-[11px]' style={{ color: 'var(--text-faint)' }}>
								{t('admin.session_until', { time: expiresAt ? new Date(expiresAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '' })}
							</span>
							<Btn onClick={() => void close()}><LogOut size={12} className='inline mr-[4px]' />{t('admin.sign_out')}</Btn>
						</div>
					</div>
					<div className='flex gap-[6px] overflow-x-auto pb-[4px]' style={{ scrollbarWidth: 'none' }}>
						{TABS.map(id => (
							<button key={id} type='button' onClick={() => setTab(id)}
								className='px-[12px] py-[7px] rounded-[9px] text-[13px] font-[600] cursor-pointer whitespace-nowrap transition-all'
								style={tab === id
									? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }
									: { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
								{t(`admin.tabs.${id}`)}
							</button>
						))}
					</div>
					{tab === 'overview' && <Overview />}
					{tab === 'users' && <Users />}
					{tab === 'games' && <Games />}
					{tab === 'rooms' && <Rooms />}
					{tab === 'recordings' && <Recordings />}
					{tab === 'broadcast' && <Broadcast />}
					{tab === 'log' && <Journal />}
					<p className='text-[12px]' style={{ color: 'var(--text-faint)' }}>{t('admin.community_hint')}</p>
				</>
			)}
		</div>
	)
}
