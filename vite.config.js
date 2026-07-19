import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  test: {
    environment: 'jsdom',
    // Vitest's default glob also matches tests/e2e/*.spec.js, which are
    // Playwright specs (imported test.describe from '@playwright/test',
    // not Vitest) — scope Vitest to src/ so `npm test` doesn't try to run
    // Playwright's test objects itself.
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
})
