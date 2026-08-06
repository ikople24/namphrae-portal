import { describe, expect, it } from 'vitest';
import {
  activeRegistryFilter,
  buildMemberPatch,
  buildRegistryUserDoc,
  serializeMember,
} from '@/lib/registry-user';

// ตัวกรองนี้คือประตูหลังบ้านทั้งบาน — ใช้ $ne ไม่ใช่ equality เพราะ document
// รุ่นเก่าอาจไม่มีฟิลด์ isActive/isArchived เลย (ไม่มีฟิลด์ = ยัง active
// ตาม default ของ schema ฝั่ง smart-namphrae)
describe('activeRegistryFilter', () => {
  it('matches by clerkId and excludes deactivated/archived', () => {
    expect(activeRegistryFilter('user_1')).toEqual({
      clerkId: 'user_1',
      isActive: { $ne: false },
      isArchived: { $ne: true },
    });
  });
});

describe('buildRegistryUserDoc', () => {
  const now = new Date('2026-08-06T10:00:00Z');
  const app = {
    clerkId: 'user_1',
    name: 'สมชาย ใจดี',
    position: 'นักวิชาการ',
    department: 'สาธารณสุข',
    phone: '0812345678',
  };

  it('produces the exact smart-namphrae schema shape', () => {
    expect(buildRegistryUserDoc(app, 'staff', now)).toEqual({
      name: 'สมชาย ใจดี',
      position: 'นักวิชาการ',
      department: 'สาธารณสุข',
      role: 'staff',
      phone: '0812345678',
      profileImage: '',
      assignedTask: '',
      clerkId: 'user_1',
      isActive: true,
      isArchived: false,
      exitDate: null,
      exitNote: '',
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('buildMemberPatch', () => {
  const now = new Date('2026-08-06T10:00:00Z');

  it('copies only provided profile fields and always stamps updatedAt', () => {
    expect(buildMemberPatch({ name: 'ใหม่', role: 'lead' }, now)).toEqual({
      name: 'ใหม่',
      role: 'lead',
      updatedAt: now,
    });
  });

  it('deactivation stamps exitDate', () => {
    expect(buildMemberPatch({ isActive: false }, now)).toEqual({
      isActive: false,
      exitDate: now,
      updatedAt: now,
    });
  });

  it('reactivation clears exitDate', () => {
    expect(buildMemberPatch({ isActive: true }, now)).toEqual({
      isActive: true,
      exitDate: null,
      updatedAt: now,
    });
  });
});

describe('serializeMember', () => {
  it('legacy doc without lifecycle fields counts as active', () => {
    const m = serializeMember({ _id: { toString: () => 'abc' }, name: 'ก' });
    expect(m).toEqual({
      id: 'abc',
      clerkId: null,
      name: 'ก',
      position: '',
      department: '',
      role: '',
      phone: '',
      isActive: true,
      isArchived: false,
    });
  });

  it('isActive false / isArchived true survive serialization', () => {
    const m = serializeMember({
      _id: { toString: () => 'abc' },
      clerkId: 'user_1',
      isActive: false,
      isArchived: true,
    });
    expect(m.isActive).toBe(false);
    expect(m.isArchived).toBe(true);
    expect(m.clerkId).toBe('user_1');
  });
});
