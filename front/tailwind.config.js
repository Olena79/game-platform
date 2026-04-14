/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				darkBg: '#05070a', // Глубокий темный
				neonBlue: '#00d2ff',
				neonPurple: '#9d50bb',
			},
			boxShadow: {
				'neon-blue':
					'0 0 10px rgba(0, 210, 255, 0.5), 0 0 20px rgba(0, 210, 255, 0.3)',
				'neon-purple':
					'0 0 10px rgba(157, 80, 187, 0.5), 0 0 20px rgba(157, 80, 187, 0.3)',
			},
		},
	},
	plugins: [],
}
