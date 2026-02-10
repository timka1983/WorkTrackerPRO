
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel обычно работает из корня '/', в то время как GitHub Pages может требовать './' или '/repo/'.
// Мы делаем настройку универсальной.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild', // Принудительно используем esbuild вместо terser, чтобы избежать ошибок установки
  },
  server: {
    port: 3000
  }
});
