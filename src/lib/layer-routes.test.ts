// src/lib/layer-routes.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as routes from '@/lib/layer-routes';

// คู่กับ api-guard-coverage.test.ts — ที่นั่นตรวจว่าไฟล์ route มี guard หรือมอบงาน
// ให้โมดูลนี้ ส่วนที่นี่ตรวจว่าโมดูลนี้ guard จริงทุกตัว ถ้าขาดข้างใดข้างหนึ่ง
// ข้อกำหนดทั้งชุดจะกลายเป็นการอ้างวงกลมที่ไม่ได้พิสูจน์อะไรเลย
const SRC = readFileSync(join(process.cwd(), 'src', 'lib', 'layer-routes.ts'), 'utf8');

/** ตัวจัดการคำขอที่ตั้งใจให้เปิดสาธารณะ — ที่เหลือทั้งหมดต้องมี guard */
const PUBLIC_ON_PURPOSE = new Set([
  'makePublicLayersHandler',
  'makePublicLayerGeojsonHandler',
]);

const factories = Object.keys(routes).filter((k) => k.startsWith('make'));

describe('layer-routes: guard ครบทุกตัว', () => {
  it('มีโรงงานครบสิบเอ็ดตัว', () => {
    expect(factories).toHaveLength(11);
  });

  for (const name of factories) {
    if (PUBLIC_ON_PURPOSE.has(name)) continue;
    it(`${name} เรียก requireFeature(domain.feature)`, () => {
      // ตัดเอาเฉพาะเนื้อของฟังก์ชันนี้ — จากบรรทัดที่ประกาศ ไปจนถึงบรรทัดก่อน
      // ฟังก์ชันถัดไป (หรือท้ายไฟล์)
      const start = SRC.indexOf(`export function ${name}(`);
      expect(start, `หา ${name} ในไฟล์ไม่เจอ`).toBeGreaterThan(-1);
      const next = SRC.indexOf('\nexport function make', start + 1);
      const body = SRC.slice(start, next === -1 ? undefined : next);
      expect(body).toContain('requireFeature(req, res, domain.feature)');
    });
  }

  it('ตัวที่เปิดสาธารณะโดยตั้งใจ ไม่มี guard — และมีแค่สองตัวนั้น', () => {
    for (const name of PUBLIC_ON_PURPOSE) {
      expect(factories).toContain(name);
    }
    expect(PUBLIC_ON_PURPOSE.size).toBe(2);
  });
});
