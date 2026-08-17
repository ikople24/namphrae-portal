import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURES,
  FEATURE_HOME,
  FEATURE_LABELS,
  FEATURES,
  firstAllowedPath,
  hasFeature,
  isEnvManager,
  resolveAccess,
} from '@/lib/user-access';

describe('resolveAccess', () => {
  it('ไม่มี doc → ชุดเริ่มต้น calendar+data ไม่ใช่ผู้จัดการ', () => {
    const r = resolveAccess({ doc: null, clerkId: 'user_a', managerEnvId: undefined });
    expect(r).toEqual({ isManager: false, features: ['calendar', 'data'] });
    expect(r.features).toEqual([...DEFAULT_FEATURES]);
  });

  it('clerkId ตรงกับ env → ผู้จัดการเสมอ เห็นครบ แม้ doc บอกไม่ใช่', () => {
    const r = resolveAccess({
      doc: { features: [], isManager: false },
      clerkId: 'user_mgr',
      managerEnvId: 'user_mgr',
    });
    expect(r.isManager).toBe(true);
    expect(r.features).toEqual([...FEATURES]);
  });

  it('doc.isManager → เห็นทุกฟีเจอร์', () => {
    const r = resolveAccess({
      doc: { features: ['map'], isManager: true },
      clerkId: 'user_b',
      managerEnvId: undefined,
    });
    expect(r.isManager).toBe(true);
    expect(r.features).toEqual([...FEATURES]);
  });

  it('doc มี features [] → ไม่เห็นอะไรเลย (ไม่ fallback เป็น default)', () => {
    const r = resolveAccess({
      doc: { features: [], isManager: false },
      clerkId: 'user_c',
      managerEnvId: undefined,
    });
    expect(r.features).toEqual([]);
  });

  it('กรอง key แปลกทิ้ง และคืนตามลำดับ canonical', () => {
    const r = resolveAccess({
      doc: { features: ['settings', 'hack', 'links'], isManager: false },
      clerkId: 'user_d',
      managerEnvId: undefined,
    });
    expect(r.features).toEqual(['links', 'settings']);
  });

  it('env ว่าง ("" หรือ undefined) ไม่ทำให้ใครเป็นผู้จัดการ', () => {
    expect(resolveAccess({ doc: null, clerkId: '', managerEnvId: '' }).isManager).toBe(false);
    expect(isEnvManager('', '')).toBe(false);
    expect(isEnvManager(null, undefined)).toBe(false);
  });
});

describe('hasFeature / firstAllowedPath', () => {
  it('ผู้จัดการมีทุกฟีเจอร์ และหน้าแรกคือ /admin', () => {
    const mgr = { isManager: true, features: [...FEATURES] };
    expect(hasFeature(mgr, 'settings')).toBe(true);
    expect(firstAllowedPath(mgr)).toBe('/admin');
  });

  it('สมาชิก default → หน้าแรกคือ /admin/calendar', () => {
    const r = resolveAccess({ doc: null, clerkId: 'u', managerEnvId: undefined });
    expect(hasFeature(r, 'links')).toBe(false);
    expect(firstAllowedPath(r)).toBe('/admin/calendar');
  });

  it('ไม่มีสิทธิ์เลย → null', () => {
    expect(firstAllowedPath({ isManager: false, features: [] })).toBe(null);
  });
});

describe('feature key ใหม่จากการย้าย namphrae-map', () => {
  it('มี disaster และ health อยู่ใน FEATURES', () => {
    expect(FEATURES).toContain('disaster');
    expect(FEATURES).toContain('health');
  });

  it('ไม่หลุดเข้า DEFAULT_FEATURES — สมาชิกเดิมต้องไม่เห็นเมนูใหม่เอง', () => {
    expect(DEFAULT_FEATURES).not.toContain('disaster');
    expect(DEFAULT_FEATURES).not.toContain('health');
  });

  it('ทุก key มีหน้าแรกและป้ายชื่อครบ', () => {
    for (const key of FEATURES) {
      expect(FEATURE_HOME[key]).toBeTruthy();
      expect(FEATURE_LABELS.find((l) => l.key === key)).toBeTruthy();
    }
  });

  it('ผู้จัดการได้สิทธิ์ใหม่ทั้งสองตัวโดยอัตโนมัติ', () => {
    const access = resolveAccess({ doc: null, clerkId: 'u1', managerEnvId: 'u1' });
    expect(hasFeature(access, 'disaster')).toBe(true);
    expect(hasFeature(access, 'health')).toBe(true);
  });

  it('สมาชิกที่ได้ health ไม่ได้ disaster ตามไปด้วย', () => {
    const access = resolveAccess({
      doc: { features: ['health'] },
      clerkId: 'u2',
      managerEnvId: 'u1',
    });
    expect(hasFeature(access, 'health')).toBe(true);
    expect(hasFeature(access, 'disaster')).toBe(false);
  });
});
