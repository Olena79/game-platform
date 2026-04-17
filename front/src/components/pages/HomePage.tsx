import React from 'react'

export const HomePage = () => {
	return (
		<div className='min-h-screen bg-[#03040f]'>
			{/* HERO SECTION */}
			<section className='relative min-h-[88vh] flex items-center px-[48px] overflow-hidden'>
				{/* SVG ORB MAIN */}
				<div className='absolute right-[-80px] top-1/2 -translate-y-1/2 w-[640px] h-[640px] opacity-85 z-0'>
					<svg viewBox='0 0 640 640' xmlns='http://www.w3.org/2000/svg'>
						<defs>
							<radialGradient id='rg' cx='50%' cy='50%' r='50%'>
								<stop offset='0%' stopColor='#1833cc' stopOpacity='0.35' />
								<stop offset='100%' stopColor='#03040f' stopOpacity='0' />
							</radialGradient>
						</defs>
						<circle cx='320' cy='320' r='310' fill='url(#rg)' />
						<ellipse
							cx='320'
							cy='320'
							rx='220'
							ry='130'
							fill='none'
							stroke='#4af'
							strokeWidth='0.7'
							strokeOpacity='0.35'
							transform='rotate(-25 320 320)'
						/>
						<ellipse
							cx='320'
							cy='320'
							rx='270'
							ry='100'
							fill='none'
							stroke='#c07fff'
							strokeWidth='0.6'
							strokeOpacity='0.3'
							transform='rotate(30 320 320)'
						/>
						<circle cx='320' cy='320' r='22' fill='rgba(68,170,255,0.4)' />
						<circle cx='320' cy='320' r='9' fill='#7acfff' />
					</svg>
				</div>

				<div className='max-w-[580px] z-10 relative'>
					<div className='inline-flex items-center gap-[8px] border border-[rgba(68,170,255,0.35)] text-[rgba(100,180,255,0.9)] text-[12px] px-[16px] py-[7px] rounded-[30px] mb-[28px] tracking-[0.5px] uppercase font-medium'>
						<div className='w-[6px] h-[6px] rounded-full bg-[#4af] pulse-dot-anim' />
						Новий досвід мислення
					</div>

					<h1 className="font-['Syne'] text-[58px] font-[800] leading-[1.05] text-white mb-[22px] tracking-[-1.5px]">
						Це не просто гра.
						<br />
						Це <span className='neon-word'>мислення</span> <span></span>в дії.
					</h1>

					<p className='text-[17px] text-[rgba(180,200,255,0.55)] leading-[1.7] mb-[40px] max-w-[460px] font-[300]'>
						Занурся у простір, де гра — это спосіб пізнати себе, розуміти
						системи і проєктувати реальність разом з іншими.
					</p>

					<div className='flex gap-[14px]'>
						<button className="bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white px-[28px] py-[14px] rounded-[12px] text-[15px] font-['Syne'] font-[600] tracking-[-0.2px] hover:shadow-[0_0_30px_rgba(100,80,255,0.5)] transition-all">
							Спробувати гру ↗
						</button>
						<button className='bg-transparent text-[rgba(180,200,255,0.7)] border border-[rgba(255,255,255,0.15)] px-[28px] py-[14px] rounded-[12px] text-[15px] hover:border-[rgba(255,255,255,0.35)] hover:text-white transition-all'>
							Дізнатись більше
						</button>
					</div>
				</div>
			</section>

			<div className='h-[0.5px] bg-gradient-to-r from-transparent via-[rgba(68,170,255,0.2)] to-transparent mx-[48px]' />

			{/* SECTION: Що це за ігри */}
			<section className='px-[48px] py-[80px]'>
				<div className='text-[11px] tracking-[3px] uppercase text-[rgba(100,180,255,0.6)] mb-[10px] font-[500]'>
					Можливості
				</div>
				<h2 className="font-['Syne'] text-[38px] font-[700] text-white mb-[14px] tracking-[-0.8px]">
					Що це за ігри
				</h2>
				<p className='text-[16px] text-[rgba(180,200,255,0.45)] leading-[1.7] max-w-[540px] mb-[52px] font-[300]'>
					Не розваги — інструмент. Кожна гра це структурована ситуація, де ти
					мислиш, вирішуєш і рефлексуєш.
				</p>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-[16px]'>
					<FeatureCard
						icon='⟳'
						title='Мислення через дію'
						desc='Ти не спостерігаєш — ти граєш роль, приймаєш рішення і відчуваєш наслідки у реальному часі.'
						hoverClass='hover:border-[rgba(68,170,255,0.6)] hover:shadow-[0_0_30px_rgba(68,170,255,0.15)]'
						iconBg='bg-[rgba(68,170,255,0.12)] border-[rgba(68,170,255,0.25)]'
					/>
					<FeatureCard
						icon='◎'
						title='Колективна динаміка'
						desc='Конфлікти інтересів, коаліції, переговори — усе що є в реальных командах, але в безпечному просторі.'
						hoverClass='hover:border-[rgba(192,127,255,0.6)] hover:shadow-[0_0_30px_rgba(192,127,255,0.15)]'
						iconBg='bg-[rgba(192,127,255,0.12)] border-[rgba(192,127,255,0.25)]'
					/>
					<FeatureCard
						icon='◈'
						title='Рефлексія після'
						desc='Розбір — найважливіша частина. Що сталось? Чому ти вирішив саме так? Що це говорить про тебе?'
						hoverClass='hover:border-[rgba(15,255,200,0.6)] hover:shadow-[0_0_30px_rgba(15,255,200,0.15)]'
						iconBg='bg-[rgba(15,255,200,0.1)] border-[rgba(15,255,200,0.2)]'
					/>
				</div>
			</section>
		</div>
	)
}

const FeatureCard = ({ icon, title, desc, hoverClass, iconBg }: any) => (
	<div
		className={`bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.08)] rounded-[20px] padding-[32px_28px] p-8 transition-all duration-400 ${hoverClass}`}
	>
		<div
			className={`w-[52px] h-[52px] rounded-[16px] flex items-center justify-center mb-[20px] text-[22px] ${iconBg}`}
		>
			{icon}
		</div>
		<h3 className="font-['Syne'] text-[16px] font-[600] text-white mb-[10px]">
			{title}
		</h3>
		<p className='text-[14px] text-[rgba(180,200,255,0.45)] leading-[1.65] font-[300]'>
			{desc}
		</p>
	</div>
)
