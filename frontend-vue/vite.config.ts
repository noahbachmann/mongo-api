import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
	return {
		plugins: [vue(), tailwindcss()],
		envDir: '../',
		server: {
			proxy: {
				'/api': {
					target: env.API_BASE || 'http://localhost:8080',
					changeOrigin: true,
				},
			},
		},
	}
})

