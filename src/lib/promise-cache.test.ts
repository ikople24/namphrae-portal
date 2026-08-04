import { describe, expect, it } from 'vitest';
import { cacheUntilRejected } from '@/lib/promise-cache';

/** กล่องเก็บค่าเลียนแบบตัวแปร module scope ใน mongodb.ts */
function slot<T>() {
  let value: Promise<T> | undefined;
  return {
    read: () => value,
    write: (v: Promise<T> | undefined) => {
      value = v;
    },
    get current() {
      return value;
    },
  };
}

describe('cacheUntilRejected', () => {
  it('เชื่อมครั้งเดียวเมื่อสำเร็จ — คำขอถัดไปใช้ของเดิม', async () => {
    const s = slot<string>();
    let calls = 0;
    const start = () => {
      calls += 1;
      return Promise.resolve('client');
    };

    expect(await cacheUntilRejected(s.read, s.write, start)).toBe('client');
    expect(await cacheUntilRejected(s.read, s.write, start)).toBe('client');
    expect(await cacheUntilRejected(s.read, s.write, start)).toBe('client');
    expect(calls).toBe(1);
  });

  // นี่คือบั๊กที่โมดูลนี้มีไว้ป้องกัน: `if (!cached)` เห็น promise ที่ reject
  // เป็นค่า truthy จึงไม่เคยลองใหม่ ครั้งเดียวที่ล้มกลายเป็นพังถาวร
  it('ล้มแล้วต้องลองใหม่ได้ ไม่ใช่คืน error เดิมตลอดไป', async () => {
    const s = slot<string>();
    let calls = 0;
    const start = () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error('เชื่อมไม่ได้'))
        : Promise.resolve('client');
    };

    await expect(cacheUntilRejected(s.read, s.write, start)).rejects.toThrow('เชื่อมไม่ได้');
    // คำขอถัดไปต้องได้ของจริง ไม่ใช่ error เดิมที่ถูก cache ไว้
    expect(await cacheUntilRejected(s.read, s.write, start)).toBe('client');
    expect(calls).toBe(2);
  });

  it('ล้างค่าที่ cache ไว้เมื่อ reject ไม่ทิ้ง promise เสียค้างไว้', async () => {
    const s = slot<string>();
    await expect(
      cacheUntilRejected(s.read, s.write, () => Promise.reject(new Error('พัง')))
    ).rejects.toThrow('พัง');
    expect(s.current).toBeUndefined();
  });

  it('ล้มติดกันหลายครั้งก็ยังลองใหม่ทุกครั้ง', async () => {
    const s = slot<string>();
    let calls = 0;
    const start = () => {
      calls += 1;
      return Promise.reject(new Error(`ล้มครั้งที่ ${calls}`));
    };

    for (let i = 1; i <= 3; i++) {
      await expect(cacheUntilRejected(s.read, s.write, start)).rejects.toThrow(
        `ล้มครั้งที่ ${i}`
      );
    }
    expect(calls).toBe(3);
  });

  it('คำขอที่มาพร้อมกันระหว่างกำลังเชื่อม ใช้ promise ตัวเดียวกัน', async () => {
    const s = slot<string>();
    let calls = 0;
    let resolveIt: ((v: string) => void) | undefined;
    const start = () => {
      calls += 1;
      return new Promise<string>((res) => {
        resolveIt = res;
      });
    };

    const a = cacheUntilRejected(s.read, s.write, start);
    const b = cacheUntilRejected(s.read, s.write, start);
    resolveIt!('client');

    expect(await a).toBe('client');
    expect(await b).toBe('client');
    expect(calls).toBe(1); // ไม่เปิดการเชื่อมซ้อนกัน
  });

  it('error ต้นฉบับถูกส่งต่อ ไม่ถูกกลบด้วย error ตัวใหม่', async () => {
    const s = slot<string>();
    const original = new Error('DNS หา host ไม่เจอ');
    await expect(
      cacheUntilRejected(s.read, s.write, () => Promise.reject(original))
    ).rejects.toBe(original);
  });
});
