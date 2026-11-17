import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const repo = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
export default defineConfig({ plugins: [vue()], base: process.env.GITHUB_PAGES_BASE || (repo ? `/${repo}/` : '/') })
