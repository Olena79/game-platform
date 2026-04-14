import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const Footer = () => {
	const { t, i18n } = useTranslation()

	const toggleLang = () => {
		i18n.changeLanguage(i18n.language === 'ua' ? 'en' : 'ua')
	}

	return (
		<footer className='border-t border-gray-900 py-6 text-center text-gray-600 text-sm'>
			© 2026 Game Forge Platform
		</footer>
	)
}
