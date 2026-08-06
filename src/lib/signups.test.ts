import { describe, expect, it } from 'vitest';
import { planApproval, resolveApplyState } from '@/lib/signups';

describe('resolveApplyState', () => {
  it('no application → form', () => {
    expect(resolveApplyState(null)).toEqual({ state: 'form' });
  });

  it('pending → pending', () => {
    expect(resolveApplyState({ status: 'pending' })).toEqual({ state: 'pending' });
  });

  it('rejected → rejected with note', () => {
    expect(resolveApplyState({ status: 'rejected', rejectNote: 'ข้อมูลไม่ครบ' })).toEqual({
      state: 'rejected',
      rejectNote: 'ข้อมูลไม่ครบ',
    });
    expect(resolveApplyState({ status: 'rejected' })).toEqual({
      state: 'rejected',
      rejectNote: null,
    });
  });

  // approved แต่ไม่มี doc ใน registry แล้ว (โดน smart-namphrae ลบทีหลัง) —
  // ถือเป็นการเริ่มใหม่ ไม่ใช่ทางตัน
  it('stale approved → form', () => {
    expect(resolveApplyState({ status: 'approved' })).toEqual({ state: 'form' });
  });
});

// approve ต้อง idempotent: retry หลัง insert สำเร็จแต่ mark ล้มเหลว
// ต้องจบงานได้โดยไม่เกิด registry doc ซ้ำ
describe('planApproval', () => {
  it('pending + no registry doc → insert and mark', () => {
    expect(planApproval('pending', false)).toEqual({ action: 'insert_and_mark' });
  });

  it('pending + registry doc exists (retry / added via smart-namphrae) → mark only', () => {
    expect(planApproval('pending', true)).toEqual({ action: 'mark_only' });
  });

  it('approved + registry doc exists → noop', () => {
    expect(planApproval('approved', true)).toEqual({ action: 'noop' });
  });

  it('approved + registry doc later deleted → insert and mark again', () => {
    expect(planApproval('approved', false)).toEqual({ action: 'insert_and_mark' });
  });

  it('rejected → invalid (must not resurrect a rejected application)', () => {
    expect(planApproval('rejected', false)).toEqual({ action: 'invalid' });
    expect(planApproval('rejected', true)).toEqual({ action: 'invalid' });
  });
});
