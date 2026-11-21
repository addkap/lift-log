import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Plain Vite + React config. Vitest settings live here too.
export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
});
