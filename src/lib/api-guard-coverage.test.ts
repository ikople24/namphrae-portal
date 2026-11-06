// ทุกไฟล์ใต้ src/pages/api/admin ต้องเรียก guard สักตัว หรือมอบงานให้ layer-routes
// ซึ่ง layer-routes.test.ts ตรึงไว้ว่า guard ครบทุกตัว — requireAdmin เปล่า ๆ
// (สมาชิกทุกคนผ่าน) อนุญาตเฉพาะ allowlist ที่ตั้งใจไว้เท่านั้น route ใหม่ที่
// ลืมคิดเรื่องสิทธิ์จะตกเทสต์นี้ทันที
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src', 'pages', 'api', 'admin');
// me.ts: identity ของ sidebar ต้องเปิดให้สมาชิกทุกคน
// config.ts: GET ใช้ร่วมหลายฟีเจอร์ ส่วน PUT เช็ค hasFeature('data') ในไฟล์เอง
// files/index.ts: GET รายการคลังไฟล์เปิดให้สมาชิกทุกคน ส่วน POST เช็ค hasFeature('files') ในไฟล์เอง
//   (ตรึงด้วยเทสต์ท้ายไฟล์นี้)
// files/[id]/view.ts: เปิดไฟล์ในคลัง สมาชิกทุกคนดูได้ (สเปก 2026-10-31 ข้อ 3)
const BARE_REQUIRE_ADMIN_OK = new Set([
  'me.ts',
  'config.ts',
  'files/index.ts',
  'files/[id]/view.ts',
]);

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
        // ไฟล์ที่มอบงานให้ layer-routes — ทุก export ของโมดูลนั้นที่ขึ้นต้นด้วย
        // makeAdmin* ถูกตรึงด้วย layer-routes.test.ts ว่าเรียก requireFeature เสมอ
        // ข้อกำหนดจึงยังครบ แค่ย้ายที่พิสูจน์ ไม่ได้ผ่อนลง
        // โหมดเจ้าหน้าที่ (สารบรรณรอบ 3) — สิทธิ์มาจากการผูกตำแหน่ง ไม่ใช่ฟีเจอร์ ดูเทสต์ด้านล่าง
        src.includes('requireSarabanMember(') ||
        src.includes("from '@/lib/layer-routes'") ||
        (BARE_REQUIRE_ADMIN_OK.has(rel) && src.includes('requireAdmin('));
      expect(guarded, `${rel} ไม่มี guard หรือใช้ requireAdmin นอก allowlist`).toBe(true);
    });
  }
});

describe('คลังไฟล์: route ที่เปิดให้สมาชิกทุกคนยังกันการเขียน', () => {
  it('files/index.ts: POST เช็คสิทธิ์ files ในไฟล์เอง', () => {
    const src = readFileSync(join(API_DIR, 'files', 'index.ts'), 'utf8');
    expect(src).toContain("hasFeature(admin, 'files')");
  });

  it('files/[id]/view.ts: รับเฉพาะ GET', () => {
    const src = readFileSync(join(API_DIR, 'files', '[id]', 'view.ts'), 'utf8');
    expect(src).toContain("req.method !== 'GET'");
  });
});

describe('สารบรรณโหมดเจ้าหน้าที่: ทุก route ใต้ saraban/me ใช้ guard ของการผูกตำแหน่ง', () => {
  const ME_DIR = join(API_DIR, 'saraban', 'me');
  const files = walk(ME_DIR);

  it('มี route อย่างน้อยหนึ่งไฟล์ (กันเทสต์ผ่านเพราะโฟลเดอร์ว่าง)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = relative(API_DIR, file);
    it(rel, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).toContain('requireSarabanMember(');
      // คนละสิทธิ์ — requireFeature('saraban') จะตัดคนที่ผูกตำแหน่งอย่างเดียวออก
      expect(src).not.toContain("requireFeature(req, res, 'saraban')");
    });
  }

  it('ผูกคนเข้าตำแหน่งเป็นของผู้จัดการเท่านั้น', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'units', '[id]', 'members.ts'), 'utf8');
    expect(src).toContain('requireManager(');
  });

  it('guard: requireAdmin ก่อนอ่านสมุด · as มาจาก query string · Clerk ตัดสินจาก isClerkConfigured', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'saraban-member-guard.ts'), 'utf8');
    expect(src).toContain('clerkOn: isClerkConfigured()');
    expect(src).toContain("typeof req.query.as === 'string'");
    expect(src.indexOf('requireAdmin(')).toBeGreaterThan(-1);
    expect(src.indexOf('requireAdmin(')).toBeLessThan(src.indexOf('listUnits('));
  });

  it('ผูกคน: ตรวจกับทะเบียน active', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'units', '[id]', 'members.ts'), 'utf8');
    expect(src).toContain('activeRegistryFilter(');
  });

  it('docs/[id]: ดึงเรื่องกลับเช็คผู้จัดการก่อนเปลี่ยนสถานะ · แก้ไขส่ง isManager ให้กฎล็อก', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'docs', '[id]', 'index.ts'), 'utf8');
    expect(src).toContain('manager_only');
    expect(src.indexOf('manager_only')).toBeLessThan(src.indexOf('reopenTransition(current'));
    expect(src).toContain('buildEdit(current, patch.edit, { isManager: admin.isManager })');
  });

  it('me/docs/[id]: ทำในนามตำแหน่งที่ถือเท่านั้น และไม่ใช้ schema โหมดเต็ม', () => {
    const src = readFileSync(join(ME_DIR, 'docs', '[id]', 'index.ts'), 'utf8');
    expect(src).toContain('not_holder');
    expect(src).toContain('memberPatchSchema');
    expect(src).not.toContain('docPatchSchema');
  });

  it('docs/[id]: โหมดเต็มปฏิเสธลายมือ/ลงนาม (self_only) ก่อนอ่านหนังสือ · ใช้ annotateExtras', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'docs', '[id]', 'index.ts'), 'utf8');
    expect(src).toContain("'self_only'");
    expect(src.indexOf('hasSelfOnlyMarks(patch)')).toBeGreaterThan(-1);
    expect(src.indexOf('hasSelfOnlyMarks(patch)')).toBeLessThan(src.indexOf('const current = await getDoc(id)'));
    expect(src).toContain('annotateExtras(current, patch');
  });

  it('me/docs/[id]: ตรวจ marks และลงนามผ่าน annotateExtras หลัง not_holder', () => {
    const src = readFileSync(join(ME_DIR, 'docs', '[id]', 'index.ts'), 'utf8');
    expect(src).toContain('annotateExtras(current, patch');
    expect(src.indexOf('not_holder')).toBeLessThan(src.indexOf('annotateExtras(current, patch'));
  });
});
