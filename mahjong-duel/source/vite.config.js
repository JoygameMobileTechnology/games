import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { port: 5173 }, optimizeDeps: { entries: ['index.html'] }, build: { target: 'es2020' } });
