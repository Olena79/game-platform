import React from 'react'
import { useTranslation } from 'react-i18next'
import { MousePointer2, Users, Lightbulb } from 'lucide-react'

// Легкий компонент для карточки
const FeatureCard = ({ icon: Icon, title }: { icon: any; title: string }) => (
	<div className='glass-card flex flex-col items-center text-center group'>
		<div className='mb-6 p-4 rounded-full bg-white/5 border border-white/10 group-hover:border-accentCyan/30 transition-all duration-300'>
			<Icon size={32} className='text-accentCyan group-hover:animate-pulse' />
		</div>
		<h3 className='text-xl font-semibold text-white mb-2'>{title}</h3>
		<p className='text-slate-400 text-sm font-light'>
			Ігрові механіки, що активують нестандартне мислення.
		</p>
	</div>
)

// Разделительная радужная линия
const RainbowSeparator = () => (
	<div className='w-full flex justify-center my-16'>
		<div className='rainbow-line max-w-7xl' />
	</div>
)

export const HomePage = () => {
	const { t } = useTranslation()

	return (
		<div className='flex flex-col gap-24 py-16'>
			{/* Hero Section */}
			<section className='relative flex flex-col items-center text-center px-4 min-h-[70vh] justify-center overflow-hidden'>
				{/* Фоновое облачное сияние (z-0, pointer-events-none) */}
				{/* ВСТАВЬ СВОЮ ССЫЛКУ ИЗ ОБЛАКА НИЖЕ */}
				<img
					src='https://res.cloudinary.com/dsgqhwqr7/image/upload/v1776167811/360_F_1785258885_JV6D8dedszLThU675o3mfiJYKVjkL3rH_dmtm9r.jpg'
					alt='Background Glow'
					className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] max-w-none opacity-60 z-0 animate-pulse pointer-events-none'
				/>

				{/* Текст (relative z-10) */}
				<h1 className='relative z-10 text-6xl md:text-8xl font-black mb-8 leading-tight tracking-tighter'>
					<span className='text-white'>Це не просто гра.</span> <br />
					<span className='neon-title'>ЦЕ ДОСВІД МИСЛЕННЯ В ДІЇ</span>
				</h1>

				<p className='relative z-10 text-slate-400 max-w-2xl text-xl font-light mb-12 leading-relaxed tracking-wide'>
					Ігромастер: Керуй реальністю. Ігроки: Досліджуйте світи та вирішуйте
					глобальні конфлікти разом.
				</p>

				<button className='relative z-10 btn-neon'>Спробувати гру</button>
			</section>

			<RainbowSeparator />

			{/* Section: Що це за ігри */}
			<section className='flex flex-col items-center gap-16 px-4'>
				<h2 className='text-4xl md:text-5xl font-extrabold text-white tracking-tight uppercase italic'>
					Що це за ігри
				</h2>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-10 w-full max-w-7xl'>
					<FeatureCard icon={MousePointer2} title='Мислення через дію' />
					<FeatureCard icon={Users} title='Колективна динаміка' />
					<FeatureCard icon={Lightbulb} title='Рефлексія' />
				</div>
			</section>

			<RainbowSeparator />

			{/* Раздел "Как это происходит" можно добавить позже */}
		</div>
	)
}
