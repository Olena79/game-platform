import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../minicomponents/Button'
import { User, Mail, Phone, Lock, Hash, ShieldCheck } from 'lucide-react'

export const AuthPage = () => {
	const { t } = useTranslation()
	const [isLogin, setIsLogin] = useState(true)
	const [role, setRole] = useState('player')

	return (
		<div className='flex justify-center items-center py-12 px-4'>
			<div className='bg-gray-900/50 border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm'>
				<div className='flex gap-4 mb-8 border-b border-gray-800 pb-4'>
					<button
						onClick={() => setIsLogin(true)}
						className={`flex-1 pb-2 font-semibold transition ${isLogin ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}
					>
						Вхід
					</button>
					<button
						onClick={() => setIsLogin(false)}
						className={`flex-1 pb-2 font-semibold transition ${!isLogin ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}
					>
						Реєстрація
					</button>
				</div>

				<form className='space-gap-y-4 flex flex-col gap-4'>
					{/* Общие поля */}
					<div className='relative'>
						<User className='absolute left-3 top-3 text-gray-500' size={18} />
						<input
							type='text'
							placeholder="Ім'я"
							className='w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition'
						/>
					</div>

					{!isLogin && (
						<>
							<div className='relative'>
								<Mail
									className='absolute left-3 top-3 text-gray-500'
									size={18}
								/>
								<input
									type='email'
									placeholder='Email'
									className='w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition'
								/>
							</div>
							<div className='relative'>
								<Phone
									className='absolute left-3 top-3 text-gray-500'
									size={18}
								/>
								<input
									type='tel'
									placeholder='Телефон'
									className='w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition'
								/>
							</div>
						</>
					)}

					<div className='relative'>
						<Lock className='absolute left-3 top-3 text-gray-500' size={18} />
						<input
							type='password'
							placeholder='Пароль'
							className='w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition'
						/>
					</div>

					{/* Выбор роли */}
					<div className='relative'>
						<ShieldCheck
							className='absolute left-3 top-3 text-gray-500'
							size={18}
						/>
						<select
							value={role}
							onChange={e => setRole(e.target.value)}
							className='w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 appearance-none transition'
						>
							<option value='player'>Гравець</option>
							<option value='gamemaster'>Ігромайстер</option>
							<option value='spectator'>Глядач</option>
						</select>
					</div>

					{/* Код игры (только для игроков и зрителей) */}
					{role !== 'gamemaster' && (
						<div className='relative'>
							<Hash className='absolute left-3 top-3 text-gray-500' size={18} />
							<input
								type='text'
								placeholder='Код гри'
								className='w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition'
							/>
						</div>
					)}

					<Button variant='primary' size='lg' className='mt-4 w-full'>
						{isLogin ? 'Увійти' : 'Створити акаунт'}
					</Button>
				</form>
			</div>
		</div>
	)
}
