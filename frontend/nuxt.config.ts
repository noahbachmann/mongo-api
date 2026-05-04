import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	css: ['./main.css'],
	vite: {
		plugins: [tailwindcss()],
	},
	runtimeConfig: {
		public: {
			apiBase: '',
		},
	},
	nitro: {
		devProxy: {
			'/api': {
				target: 'http://localhost:8080/api',
				changeOrigin: true,
				prependPath: true,
			},
		},
	},
})

