/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				display: ['Montserrat', 'sans-serif'],
			},
			colors: {
				dark: '#020617',
				surface: '#0f172a',
				// Основной неоновый акцент
				accentCyan: '#00d2ff',
			},
		},
	},
	plugins: [],
}
