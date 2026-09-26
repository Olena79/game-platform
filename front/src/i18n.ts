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

/** The last language chosen on this device; Ukrainian the first time */
const LANG_KEY = 'gos-lang'

function savedLanguage(): string {
	try {
		const saved = localStorage.getItem(LANG_KEY)
		if (saved === 'ua' || saved === 'en') return saved
	} catch { /* storage blocked: default */ }
	return 'ua'
}

i18n.use(initReactI18next).init({
	resources,
	lng: savedLanguage(),
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false,
	},
})

document.documentElement.lang = i18n.language === 'ua' ? 'uk' : 'en'
i18n.on('languageChanged', lng => {
	try { localStorage.setItem(LANG_KEY, lng) } catch { /* storage blocked */ }
	document.documentElement.lang = lng === 'ua' ? 'uk' : 'en'
})

export default i18n
