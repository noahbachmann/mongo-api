import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	server: {
		proxy: {
			'/api': {
				target: process.env.API_BASE || 'http://localhost:8080',
				changeOrigin: true,
			},
		},
	},
})
