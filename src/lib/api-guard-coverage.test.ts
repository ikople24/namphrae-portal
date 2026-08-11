// ทุกไฟล์ใต้ src/pages/api/admin ต้องเรียก guard สักตัว — requireAdmin เปล่า ๆ
// (สมาชิกทุกคนผ่าน) อนุญาตเฉพาะ allowlist ที่ตั้งใจไว้เท่านั้น route ใหม่ที่
// ลืมคิดเรื่องสิทธิ์จะตกเทสต์นี้ทันที
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src', 'pages', 'api', 'admin');
// me.ts: identity ของ sidebar ต้องเปิดให้สมาชิกทุกคน
// config.ts: GET ใช้ร่วมหลายฟีเจอร์ ส่วน PUT เช็ค hasFeature('data') ในไฟล์เอง
const BARE_REQUIRE_ADMIN_OK = new Set(['me.ts', 'config.ts']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('guard coverage: /api/admin/**', () => {
  for (const file of walk(API_DIR)) {
    const rel = relative(API_DIR, file);
    it(rel, () => {
      const src = readFileSync(file, 'utf8');
      const guarded =
        src.includes('requireFeature(') ||
        src.includes('requireManager(') ||
        (BARE_REQUIRE_ADMIN_OK.has(rel) && src.includes('requireAdmin('));
      expect(guarded, `${rel} ไม่มี guard หรือใช้ requireAdmin นอก allowlist`).toBe(true);
    });
  }
});
