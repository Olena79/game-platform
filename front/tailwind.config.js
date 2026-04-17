/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				display: ['Syne', 'sans-serif'],
			},
			colors: {
				cosmic: '#03040f',
				neonBlue: '#4af',
				neonPurple: '#c07fff',
				neonPink: '#ff5fa0',
				neonTeal: '#0fffc8',
			},
		},
	},
	plugins: [],
}
