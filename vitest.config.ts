import path from 'node:path';
import { defineConfig } from 'vitest/config';

// เทสต์ครอบเฉพาะ logic บริสุทธิ์ (ไม่มี DB/network) จึงใช้ environment 'node'
// alias ต้องตรงกับ paths ใน tsconfig.json
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
});
