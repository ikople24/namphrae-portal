import path from 'node:path';
import { defineConfig } from 'vitest/config';

// เทสต์ครอบเฉพาะ logic บริสุทธิ์ (ไม่มี DB/network) จึงใช้ environment 'node'
// alias ต้องตรงกับ paths ใน tsconfig.json
//
// ห้ามวางไฟล์เทสต์ไว้ใต้ src/pages/** — Pages Router ของ Next ใช้
// pageExtensions ปริยาย (tsx/ts/jsx/js) ซึ่งครอบ .test.ts ด้วย ไฟล์เทสต์ที่นั่น
// จะกลายเป็น route จริงและถูกรวมเข้า next build (เช่น /admin/calendar/index.test)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts?(x)'],
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
});
