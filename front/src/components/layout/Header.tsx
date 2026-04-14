// src/components/layout/Header.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Gamepad2, UserCircle } from 'lucide-react'
import { Button } from '../minicomponents/Button'

export const Header = () => {
	const { t, i18n } = useTranslation()

	const toggleLang = () => {
		i18n.changeLanguage(i18n.language === 'ua' ? 'en' : 'ua')
	}

	return (
		<header className='border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50'>
			<div className='max-w-7xl mx-auto px-4 h-16 flex items-center justify-between'>
				<Link to='/' className='flex items-center gap-2 group'>
					<div className='w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center group-hover:rotate-6 transition-transform'>
						<Gamepad2 size={24} className='text-white' />
					</div>
					<span className='font-bold text-xl tracking-tight text-white'>
						GAME FORGE
					</span>
				</Link>

				<div className='flex items-center gap-3'>
					<Button
						variant='ghost'
						size='sm'
						onClick={toggleLang}
						className='gap-2'
					>
						<Globe size={16} />
						<span className='uppercase'>{i18n.language}</span>
					</Button>

					<Link to='/auth'>
						<Button variant='primary' size='md' className='gap-2'>
							<UserCircle size={18} />
							{t('login_btn')}
						</Button>
					</Link>
				</div>
			</div>
		</header>
	)
}
