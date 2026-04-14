import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import translationEN from './translation/en.json'
import translationUA from './translation/ua.json'

const resources = {
	en: {
		translation: translationEN,
	},
	ua: {
		translation: translationUA,
	},
}

i18n.use(initReactI18next).init({
	resources,
	lng: 'ua', // язык по умолчанию
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false,
	},
})

export default i18n
