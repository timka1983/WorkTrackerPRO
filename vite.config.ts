
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Для GitHub Pages важна правильная база путей. 
// Использование './' делает сборку универсальной для подпапок.
export default defineConfig({
  plugins: [react()],
  base: './', 
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
  server: {
    port: 3000
  }
});
