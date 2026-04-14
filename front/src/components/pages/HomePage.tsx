import React from 'react'
import { useTranslation } from 'react-i18next'
import { MousePointer2, Users, Lightbulb, Zap } from 'lucide-react'
import { Button } from '../minicomponents/Button'

export const HomePage = () => {
	const { t } = useTranslation()

	return (
		<div className='flex flex-col gap-24 py-16'>
			{/* Hero Section - Главный блок */}
			<section className='relative flex flex-col items-center text-center px-4 overflow-hidden'>
				<img
					src='https://res.cloudinary.com/dsgqhwqr7/image/upload/v1776167811/360_F_1785258885_JV6D8dedszLThU675o3mfiJYKVjkL3rH_dmtm9r.jpg'
					alt='Neon Glow'
					className='absolute -top-140 w-[500px] h-[500px] max-w-none opacity-40 -z-10 animate-pulse pointer-events-none'
				/>
				<h1 className='text-5xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight max-w-4xl'>
					<span className='text-white'>Це не просто гра.</span> <br />
					<span className='bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent neon-text-blue'>
						Це досвід мислення в дії
					</span>
				</h1>

				<p className='text-gray-400 max-w-2xl text-lg md:text-xl font-light mb-10 leading-relaxed'>
					{t('welcome_subtitle')}
				</p>

				<Button
					variant='primary'
					size='lg'
					className='shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]'
				>
					Спробувати гру
				</Button>
			</section>

			{/* Section: Что это за игры */}
			<section className='flex flex-col items-center gap-12'>
				<h2 className='text-3xl font-bold text-white tracking-widest uppercase italic'>
					Що це за ігри
				</h2>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-4'>
					<FeatureCard
						icon={<MousePointer2 size={32} className='text-blue-400' />}
						title='Мислення через дію'
					/>
					<FeatureCard
						icon={<Users size={32} className='text-purple-400' />}
						title='Колективна динаміка'
					/>
					<FeatureCard
						icon={<Lightbulb size={32} className='text-cyan-400' />}
						title='Рефлексія'
					/>
				</div>
			</section>

			{/* Section: Как это происходит (Шаги) */}
			<section className='flex flex-col items-center gap-12 bg-white/5 py-16 rounded-[40px] border border-white/10 backdrop-blur-sm mx-4'>
				<h2 className='text-3xl font-bold text-white tracking-widest uppercase italic'>
					Як це відбувається
				</h2>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl px-6'>
					<StepCard
						number='1'
						text='Ти отримуєш запрошення в ігрову ситуацію'
					/>
					<StepCard
						number='2'
						text='Занурюєшся у роль, задачу, конфлікт'
						color='text-blue-400'
					/>
					<StepCard
						number='3'
						text='Разом із групою шукаєш рішення, яке не існувало раніше'
						color='text-purple-400'
					/>
					<StepCard
						number='4'
						text='Після гри — розбір і відкриття, які варто змінити у баченні світу'
						color='text-cyan-400'
					/>
				</div>
			</section>
		</div>
	)
}

/* Под-компоненты для чистоты кода */

const FeatureCard = ({
	icon,
	title,
}: {
	icon: React.ReactNode
	title: string
}) => (
	<div className='flex flex-col items-center p-10 rounded-3xl bg-[#0a0f18] border border-white/5 hover:border-blue-500/30 transition-all group cursor-default'>
		<div className='mb-6 transform group-hover:scale-110 transition-transform duration-300'>
			{icon}
		</div>
		<h3 className='text-gray-300 font-medium text-lg'>{title}</h3>
	</div>
)

const StepCard = ({
	number,
	text,
	color = 'text-white',
}: {
	number: string
	text: string
	color?: string
}) => (
	<div className='flex items-start gap-6 p-8 bg-black/40 rounded-2xl border border-white/5 hover:bg-white/[0.02] transition'>
		<span className={`text-5xl font-bold opacity-40 ${color}`}>{number}</span>
		<p className='text-gray-300 text-lg leading-snug pt-2'>{text}</p>
	</div>
)
