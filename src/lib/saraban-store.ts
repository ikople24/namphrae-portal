// src/lib/saraban-store.ts
// หนังสือของสารบรรณ — Mongo `sarabanDocs` + `sarabanYears` | ไฟล์ใน data/ (สเปกข้อ 3–4)
//
// ส่วนบนเป็นฟังก์ชันบริสุทธิ์ของการออกเลข แยกไว้ให้เทสต์ได้โดยไม่ต้องมี Mongo (repo ไม่มี DB
// ในเทสต์) ส่วน I/O อยู่ถัดลงไป

export const MAX_NUMBER_ATTEMPTS = 5;

/** ออกเลขชนครบเพดาน — route ตอบ 503 number_busy ให้ผู้ใช้กดใหม่ */
export class NumberBusyError extends Error {
  constructor() {
    super('number_busy');
    this.name = 'NumberBusyError';
  }
}

/**
 * index ไหนทำให้ insert ชน
 *   'no'  = เลขทะเบียนชน (อีกคนได้เลขนี้ไปก่อน) → ลองเลขถัดไป
 *   'id'  = id ชน (คำขอเดิมถูกส่งซ้ำ) → idempotency ไม่ใช่ออกเลขใหม่
 *   null  = ไม่ใช่ duplicate key หรือบอกไม่ได้ว่าชนตัวไหน → ผู้เรียกโยนต่อ (500 ดัง ๆ)
 */
export function duplicateKeyOf(err: unknown): 'no' | 'id' | null {
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown> } | null;
  if (e?.code !== 11000 || !e.keyPattern) return null;
  if ('no' in e.keyPattern) return 'no';
  if ('id' in e.keyPattern) return 'id';
  return null;
}

/**
 * ลอง attempt จนสำเร็จ ลองใหม่เฉพาะเมื่อ isCollision บอกว่าชน ครบ max ครั้งแล้วโยน
 * NumberBusyError — attempt ต้องอ่าน max(no) ใหม่ทุกครั้ง ไม่งั้นลองกี่รอบก็ชนเลขเดิม
 *
 * ทำไมไม่ใช้ตัวนับ $inc: ถ้า $inc สำเร็จแต่ insert ล้ม เลขหายหนึ่งเลข ทะเบียนมีรูที่ดูเหมือน
 * หนังสือถูกลบ และ repo ไม่มี transaction — แบบนี้ถ้า insert ล้ม เลขนั้นยังไม่เคยถูกใช้
 */
export async function issueWithRetry<T>(
  attempt: () => Promise<T>,
  isCollision: (err: unknown) => boolean,
  max: number = MAX_NUMBER_ATTEMPTS
): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (err) {
      if (!isCollision(err)) throw err;
      if (tries >= max) throw new NumberBusyError();
    }
  }
}
