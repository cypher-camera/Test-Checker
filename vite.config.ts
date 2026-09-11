import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Ensures assets load correctly on GitHub Pages
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
