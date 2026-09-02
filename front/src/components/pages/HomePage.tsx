import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Modal } from '../minicomponents/Modal'

const TelegramIcon = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
	</svg>
)

const IconBlue3D = ({ glow }: { glow: boolean }) => (
	<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="feat-orb-blue" cx="36%" cy="30%" r="62%">
				<stop offset="0%" stopColor={glow ? '#aaddff' : '#f0d4c0'} />
				<stop offset="50%" stopColor={glow ? '#44aaff' : '#c0533a'} />
				<stop offset="100%" stopColor={glow ? '#081e40' : '#7a2a15'} />
			</radialGradient>
			{glow && (
				<filter id="feat-shd-blue" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#44aaff" floodOpacity="0.65" />
				</filter>
			)}
		</defs>
		<circle cx="14" cy="14" r="12.5" fill="url(#feat-orb-blue)" filter={glow ? 'url(#feat-shd-blue)' : undefined} />
		<ellipse cx="10.5" cy="9.5" rx="4" ry="2.5" fill="white" fillOpacity="0.2" transform="rotate(-20 10.5 9.5)" />
		<path d="M15.5 6L9.5 15h4.2L12 22.5l8-11h-4.5L15.5 6z" fill="white" fillOpacity="0.92" />
	</svg>
)

const IconPurple3D = ({ glow }: { glow: boolean }) => (
	<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="feat-orb-purple" cx="36%" cy="30%" r="62%">
				<stop offset="0%" stopColor={glow ? '#e0c0ff' : '#e8c8b8'} />
				<stop offset="50%" stopColor={glow ? '#c07fff' : '#9b4a2a'} />
				<stop offset="100%" stopColor={glow ? '#200840' : '#5a2010'} />
			</radialGradient>
			{glow && (
				<filter id="feat-shd-purple" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#c07fff" floodOpacity="0.6" />
				</filter>
			)}
		</defs>
		<circle cx="14" cy="14" r="12.5" fill="url(#feat-orb-purple)" filter={glow ? 'url(#feat-shd-purple)' : undefined} />
		<ellipse cx="10.5" cy="9.5" rx="4" ry="2.5" fill="white" fillOpacity="0.2" transform="rotate(-20 10.5 9.5)" />
		<line x1="14" y1="7.5" x2="8" y2="17.5" stroke="white" strokeWidth="1.3" strokeOpacity="0.85" strokeLinecap="round" />
		<line x1="14" y1="7.5" x2="20" y2="17.5" stroke="white" strokeWidth="1.3" strokeOpacity="0.85" strokeLinecap="round" />
		<line x1="8" y1="17.5" x2="20" y2="17.5" stroke="white" strokeWidth="1.3" strokeOpacity="0.85" strokeLinecap="round" />
		<circle cx="14" cy="7.5" r="2" fill="white" />
		<circle cx="8" cy="17.5" r="2" fill="white" />
		<circle cx="20" cy="17.5" r="2" fill="white" />
	</svg>
)

const IconTeal3D = ({ glow }: { glow: boolean }) => (
	<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="feat-orb-teal" cx="36%" cy="30%" r="62%">
				<stop offset="0%" stopColor={glow ? '#aaffee' : '#f0dcd0'} />
				<stop offset="50%" stopColor={glow ? '#0fffc8' : '#a84030'} />
				<stop offset="100%" stopColor={glow ? '#033020' : '#6a2010'} />
			</radialGradient>
			{glow && (
				<filter id="feat-shd-teal" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#0fffc8" floodOpacity="0.55" />
				</filter>
			)}
		</defs>
		<circle cx="14" cy="14" r="12.5" fill="url(#feat-orb-teal)" filter={glow ? 'url(#feat-shd-teal)' : undefined} />
		<ellipse cx="10.5" cy="9.5" rx="4" ry="2.5" fill="white" fillOpacity="0.2" transform="rotate(-20 10.5 9.5)" />
		<path d="M6.5 14C8.5 10 11 8.5 14 8.5C17 8.5 19.5 10 21.5 14C19.5 18 17 19.5 14 19.5C11 19.5 8.5 18 6.5 14Z" stroke="white" strokeWidth="1.4" fill="none" strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
		<circle cx="14" cy="14" r="3.2" fill="white" fillOpacity="0.88" />
		<circle cx="15.2" cy="12.8" r="1.1" fill="white" fillOpacity="0.5" />
	</svg>
)

export const HomePage = () => {
	const { t } = useTranslation()
	const { isLoggedIn } = useAuth()
	const { isDark } = useTheme()
	const navigate = useNavigate()
	const [authModal, setAuthModal] = useState(false)

	const handleCreateGame = () => {
		if (isLoggedIn) {
			navigate('/create-game')
		} else {
			setAuthModal(true)
		}
	}

	return (
		<div>
			{/* HERO */}
			<section className='relative min-h-[82vh] md:min-h-[88vh] flex items-center px-[20px] md:px-[32px] lg:px-[48px] py-[20px] md:py-[60px] overflow-hidden'>
				{/* Orb — dark mode only */}
				{isDark && <div className='absolute right-[-200px] md:right-[-120px] lg:right-[-80px] top-1/2 -translate-y-1/2 w-[380px] h-[380px] md:w-[500px] md:h-[500px] lg:w-[640px] lg:h-[640px] opacity-[0.45] md:opacity-[0.6] lg:opacity-[0.85] z-0 pointer-events-none'>
					<svg viewBox='0 0 640 640' xmlns='http://www.w3.org/2000/svg'>
						<defs>
							<radialGradient id='rg' cx='50%' cy='50%' r='50%'>
								<stop offset='0%' stopColor='#1833cc' stopOpacity='0.35' />
								<stop offset='100%' stopColor='#03040f' stopOpacity='0' />
							</radialGradient>
						</defs>
						<circle cx='320' cy='320' r='310' fill='url(#rg)' />
						<ellipse cx='320' cy='320' rx='220' ry='130' fill='none' stroke='#4af' strokeWidth='0.7' strokeOpacity='0.35' transform='rotate(-25 320 320)' />
						<ellipse cx='320' cy='320' rx='270' ry='100' fill='none' stroke='#c07fff' strokeWidth='0.6' strokeOpacity='0.3' transform='rotate(30 320 320)' />
						<ellipse cx='320' cy='320' rx='180' ry='175' fill='none' stroke='#0fffc8' strokeWidth='0.5' strokeOpacity='0.25' transform='rotate(70 320 320)' />
						<ellipse cx='320' cy='320' rx='290' ry='70' fill='none' stroke='#ff5fa0' strokeWidth='0.4' strokeOpacity='0.2' transform='rotate(-55 320 320)' />
						<circle cx='320' cy='320' r='50' fill='rgba(30,80,255,0.15)' />
						<circle cx='320' cy='320' r='22' fill='rgba(68,170,255,0.4)' />
						<circle cx='320' cy='320' r='9' fill='#7acfff' />
					</svg>
				</div>}

				<div className='w-full max-w-[780px] z-10 relative'>
					<div className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(100,180,255,0.9)] text-[11px] md:text-[12px] px-[12px] md:px-[16px] py-[6px] md:py-[7px] rounded-[30px] mb-[20px] md:mb-[28px] tracking-[0.5px] uppercase font-medium'>
						<div className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
						{t('home.hero.badge')}
					</div>

					<h1 className="font-amatic text-[34px] sm:text-[42px] md:text-[48px] lg:text-[58px] font-[800] leading-[1.08] md:leading-[1.05] text-white mb-[18px] md:mb-[22px]">
						<span className='block mb-[1em]'>{t('home.hero.title_line1')}</span>
						<span className='block'>{t('home.hero.title_line2')} <span className='neon-word'>{t('home.hero.title_highlight')}</span> {t('home.hero.title_line3')}</span>
					</h1>

					<p className='text-[15px] md:text-[16px] lg:text-[17px] text-[rgba(180,200,255,0.55)] leading-[1.7] mb-[32px] md:mb-[40px] max-w-[460px] font-[300]'>
						{t('home.hero.subtitle')}
					</p>

					<div className='flex flex-wrap gap-[12px] md:gap-[14px]'>
						<button
							onClick={handleCreateGame}
							className="bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white px-[22px] md:px-[28px] py-[12px] md:py-[14px] rounded-[12px] text-[14px] md:text-[15px] font-amatic font-[600] hover:shadow-[0_0_30px_rgba(100,80,255,0.5)] hover:-translate-y-[1px] transition-all cursor-pointer"
						>
							{t('home.hero.btn_try')}
						</button>
						<a
							href='https://t.me/+PPQQaaV5SrVkODgy'
							target='_blank'
							rel='noopener noreferrer'
							className='inline-flex items-center gap-[8px] bg-transparent text-[rgba(180,200,255,0.7)] border border-[rgba(255,255,255,0.15)] px-[22px] md:px-[28px] py-[12px] md:py-[14px] rounded-[12px] text-[14px] md:text-[15px] hover:border-[rgba(255,255,255,0.35)] hover:text-white transition-all cursor-pointer no-underline'
							style={isDark ? undefined : { color: 'var(--accent)', borderColor: 'var(--accent)' }}
						>
							<TelegramIcon />
							{t('home.hero.btn_learn')}
						</a>
					</div>
				</div>
			</section>

			<Divider />

			{/* FEATURES */}
			<section className='px-[20px] md:px-[32px] lg:px-[48px] py-[48px] md:py-[64px] lg:py-[80px]'>
				<SectionEyebrow>{t('home.features.eyebrow')}</SectionEyebrow>
				<SectionTitle>{t('home.features.title')}</SectionTitle>
				<SectionDesc>{t('home.features.desc')}</SectionDesc>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-[14px] md:gap-[16px]'>
					<FeatureCard icon={<IconBlue3D glow={isDark} />} title={t('home.features.card1_title')} desc={t('home.features.card1_desc')} color='blue' />
					<FeatureCard icon={<IconPurple3D glow={isDark} />} title={t('home.features.card2_title')} desc={t('home.features.card2_desc')} color='purple' />
					<FeatureCard icon={<IconTeal3D glow={isDark} />} title={t('home.features.card3_title')} desc={t('home.features.card3_desc')} color='teal' />
				</div>
			</section>

			<Divider />

			{/* AUDIENCE */}
			<section className='px-[20px] md:px-[32px] lg:px-[48px] py-[48px] md:py-[64px] lg:py-[80px]'>
				<SectionEyebrow>{t('home.audience.eyebrow')}</SectionEyebrow>
				<SectionTitle>{t('home.audience.title')}</SectionTitle>
				<SectionDesc>{t('home.audience.desc')}</SectionDesc>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-[14px] md:gap-[16px]'>
					<AudienceCard num='01' title={t('home.audience.card1_title')} desc={t('home.audience.card1_desc')} color='blue' />
					<AudienceCard num='02' title={t('home.audience.card2_title')} desc={t('home.audience.card2_desc')} color='purple' />
					<AudienceCard num='03' title={t('home.audience.card3_title')} desc={t('home.audience.card3_desc')} color='teal' />
				</div>
			</section>

			<Divider />

			{/* HOW IT WORKS */}
			<section className='px-[20px] md:px-[32px] lg:px-[48px] py-[48px] md:py-[64px] lg:py-[80px]'>
				<SectionEyebrow>{t('home.how.eyebrow')}</SectionEyebrow>
				<SectionTitle>{t('home.how.title')}</SectionTitle>
				<SectionDesc>{t('home.how.desc')}</SectionDesc>
				<div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[14px]'>
					<HowCard n='1' title={t('home.how.step1_title')} desc={t('home.how.step1_desc')} color='blue' />
					<HowCard n='2' title={t('home.how.step2_title')} desc={t('home.how.step2_desc')} color='purple' />
					<HowCard n='3' title={t('home.how.step3_title')} desc={t('home.how.step3_desc')} color='teal' />
					<HowCard n='4' title={t('home.how.step4_title')} desc={t('home.how.step4_desc')} color='pink' />
				</div>
			</section>

			<Modal
				isOpen={authModal}
				onClose={() => setAuthModal(false)}
				title={t('home.auth_required_title')}
				message={t('home.auth_required_msg')}
				variant='warn'
				onConfirm={() => { setAuthModal(false); navigate('/auth') }}
				confirmLabel={t('home.auth_required_confirm')}
				cancelLabel={t('home.auth_required_cancel')}
			/>
		</div>
	)
}

// ─── Shared ────────────────────────────────────────────────────────────────

const Divider = () => (
	<div className='h-[0.5px] bg-gradient-to-r from-transparent via-[rgba(68,170,255,0.2)] to-transparent mx-[20px] md:mx-[32px] lg:mx-[48px]' />
)

const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
	<div className='mb-[16px] md:mb-[20px]'>
		<span className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(100,180,255,0.9)] text-[11px] md:text-[12px] px-[12px] md:px-[16px] py-[6px] md:py-[7px] rounded-[30px] tracking-[0.5px] uppercase font-medium'>
			<span className='w-[6px] h-[6px] rounded-full bg-[#44aaff] pulse-dot-anim flex-shrink-0' />
			{children}
		</span>
	</div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
	<h2 className="font-amatic text-[26px] md:text-[32px] lg:text-[38px] font-[700] text-white mb-[12px] md:mb-[14px]">
		{children}
	</h2>
)

const SectionDesc = ({ children }: { children: React.ReactNode }) => (
	<p className='text-[15px] md:text-[16px] text-[rgba(180,200,255,0.45)] leading-[1.7] max-w-[540px] mb-[32px] md:mb-[44px] lg:mb-[52px] font-[300]'>
		{children}
	</p>
)

// ─── Feature Cards ─────────────────────────────────────────────────────────

type FeatColor = 'blue' | 'purple' | 'teal'

const featColorMap: Record<FeatColor, { hover: string; icon: string; glow: string }> = {
	blue: {
		hover: 'hover:border-[rgba(68,170,255,0.6)] hover:shadow-[0_0_30px_rgba(68,170,255,0.15),inset_0_0_30px_rgba(68,170,255,0.04)]',
		icon: 'bg-[rgba(68,170,255,0.12)] border border-[rgba(68,170,255,0.25)]',
		glow: 'shadow-[0_0_22px_rgba(68,170,255,0.1),inset_0_0_18px_rgba(68,170,255,0.03)] border-[rgba(68,170,255,0.2)] md:shadow-none md:border-[rgba(255,255,255,0.08)]',
	},
	purple: {
		hover: 'hover:border-[rgba(192,127,255,0.6)] hover:shadow-[0_0_30px_rgba(192,127,255,0.15),inset_0_0_30px_rgba(192,127,255,0.04)]',
		icon: 'bg-[rgba(192,127,255,0.12)] border border-[rgba(192,127,255,0.25)]',
		glow: 'shadow-[0_0_22px_rgba(192,127,255,0.1),inset_0_0_18px_rgba(192,127,255,0.03)] border-[rgba(192,127,255,0.2)] md:shadow-none md:border-[rgba(255,255,255,0.08)]',
	},
	teal: {
		hover: 'hover:border-[rgba(15,255,200,0.6)] hover:shadow-[0_0_30px_rgba(15,255,200,0.15),inset_0_0_30px_rgba(15,255,200,0.04)]',
		icon: 'bg-[rgba(15,255,200,0.1)] border border-[rgba(15,255,200,0.2)]',
		glow: 'shadow-[0_0_22px_rgba(15,255,200,0.09),inset_0_0_18px_rgba(15,255,200,0.03)] border-[rgba(15,255,200,0.18)] md:shadow-none md:border-[rgba(255,255,255,0.08)]',
	},
}

const FeatureCard = ({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: FeatColor }) => {
	const { hover, icon: iconClass, glow } = featColorMap[color]
	return (
		<div className={`border rounded-[20px] px-[24px] md:px-[28px] py-[28px] md:py-[32px] transition-all duration-[400ms] cursor-default ${glow} ${hover}`}>
			<div className={`w-[48px] h-[48px] md:w-[52px] md:h-[52px] rounded-[14px] md:rounded-[16px] flex items-center justify-center mb-[18px] md:mb-[20px] ${iconClass}`}>
				{icon}
			</div>
			<h3 className="font-amatic text-[15px] md:text-[16px] font-[600] text-white mb-[8px] md:mb-[10px]">{title}</h3>
			<p className='text-[13px] md:text-[14px] text-[rgba(180,200,255,0.45)] leading-[1.65] font-[300]'>{desc}</p>
		</div>
	)
}

// ─── Audience Cards ─────────────────────────────────────────────────────────

type AudColor = 'blue' | 'purple' | 'teal'

const audColorMap: Record<AudColor, { hover: string; num: string; glow: string }> = {
	blue: {
		hover: 'hover:border-[rgba(68,170,255,0.5)] hover:shadow-[0_8px_40px_rgba(68,170,255,0.12)]',
		num: 'neon-num-blue',
		glow: 'shadow-[0_6px_28px_rgba(68,170,255,0.1)] border-[rgba(68,170,255,0.2)] md:shadow-none md:border-[rgba(255,255,255,0.08)]',
	},
	purple: {
		hover: 'hover:border-[rgba(192,127,255,0.5)] hover:shadow-[0_8px_40px_rgba(192,127,255,0.12)]',
		num: 'neon-num-purple',
		glow: 'shadow-[0_6px_28px_rgba(192,127,255,0.1)] border-[rgba(192,127,255,0.2)] md:shadow-none md:border-[rgba(255,255,255,0.08)]',
	},
	teal: {
		hover: 'hover:border-[rgba(15,255,200,0.5)] hover:shadow-[0_8px_40px_rgba(15,255,200,0.12)]',
		num: 'neon-num-teal',
		glow: 'shadow-[0_6px_28px_rgba(15,255,200,0.09)] border-[rgba(15,255,200,0.18)] md:shadow-none md:border-[rgba(255,255,255,0.08)]',
	},
}

const AudienceCard = ({ num, title, desc, color }: { num: string; title: string; desc: string; color: AudColor }) => {
	const { hover, num: numClass, glow } = audColorMap[color]
	return (
		<div className={`rounded-[20px] md:rounded-[22px] px-[24px] md:px-[28px] py-[28px] md:py-[36px] border transition-all duration-[400ms] cursor-default ${glow} ${hover}`}>
			<div className={`font-amatic text-[40px] md:text-[48px] font-[800] leading-[1] mb-[14px] md:mb-[16px] ${numClass}`}>
				{num}
			</div>
			<div className="font-amatic text-[16px] md:text-[17px] font-[700] text-white mb-[8px] md:mb-[10px]">{title}</div>
			<div className='text-[13px] md:text-[14px] text-[rgba(180,200,255,0.45)] leading-[1.65] font-[300]'>{desc}</div>
		</div>
	)
}

// ─── How Cards ──────────────────────────────────────────────────────────────

type HowColor = 'blue' | 'purple' | 'teal' | 'pink'

const howColorMap: Record<HowColor, { card: string; num: string; glow: string }> = {
	blue:   { card: 'hover:border-[rgba(68,170,255,0.4)] hover:shadow-[0_0_24px_rgba(68,170,255,0.08)]',   num: 'neon-num-blue',   glow: 'shadow-[0_0_18px_rgba(68,170,255,0.09)] border-[rgba(68,170,255,0.18)] md:shadow-none md:border-[rgba(255,255,255,0.07)]' },
	purple: { card: 'hover:border-[rgba(192,127,255,0.4)] hover:shadow-[0_0_24px_rgba(192,127,255,0.08)]', num: 'neon-num-purple', glow: 'shadow-[0_0_18px_rgba(192,127,255,0.09)] border-[rgba(192,127,255,0.18)] md:shadow-none md:border-[rgba(255,255,255,0.07)]' },
	teal:   { card: 'hover:border-[rgba(15,255,200,0.4)] hover:shadow-[0_0_24px_rgba(15,255,200,0.08)]',   num: 'neon-num-teal',   glow: 'shadow-[0_0_18px_rgba(15,255,200,0.08)] border-[rgba(15,255,200,0.16)] md:shadow-none md:border-[rgba(255,255,255,0.07)]' },
	pink:   { card: 'hover:border-[rgba(255,90,160,0.4)] hover:shadow-[0_0_24px_rgba(255,90,160,0.08)]',   num: 'neon-num-pink',   glow: 'shadow-[0_0_18px_rgba(255,90,160,0.09)] border-[rgba(255,90,160,0.18)] md:shadow-none md:border-[rgba(255,255,255,0.07)]' },
}

const HowCard = ({ n, title, desc, color }: { n: string; title: string; desc: string; color: HowColor }) => (
	<div className={`flex gap-[16px] md:gap-[20px] px-[20px] md:px-[28px] py-[22px] md:py-[28px] border rounded-[16px] md:rounded-[18px] items-start transition-all duration-[400ms] ${howColorMap[color].glow} ${howColorMap[color].card}`}>
		<div className={`font-amatic text-[36px] md:text-[44px] font-[800] leading-[1] min-w-[36px] md:min-w-[42px] ${howColorMap[color].num}`}>
			{n}
		</div>
		<div>
			<h3 className="font-amatic text-[14px] md:text-[15px] font-[600] text-white mb-[5px] md:mb-[6px]">{title}</h3>
			<p className='text-[13px] text-[rgba(180,200,255,0.4)] leading-[1.65] font-[300]'>{desc}</p>
		</div>
	</div>
)
