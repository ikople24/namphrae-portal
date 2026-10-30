// src/lib/raw-body.test.ts
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readRawBody } from '@/lib/raw-body';

const stream = (...chunks: (string | Uint8Array)[]) => Readable.from(chunks);

describe('readRawBody', () => {
  it('ต่อ chunk ทั้งหมดเป็น Buffer เดียว — รับทั้ง string และ bytes', async () => {
    const body = await readRawBody(stream('ab', new Uint8Array([0x63])), 10);
    expect(body?.toString()).toBe('abc');
  });

  it('ยาวเท่าเพดานพอดีผ่าน', async () => {
    expect((await readRawBody(stream('12345'), 5))?.length).toBe(5);
  });

  it('เกินเพดานหนึ่งไบต์ → null และไม่อ่านต่อ', async () => {
    let pulled = 0;
    async function* chunks() {
      for (const c of ['123', '456', '789']) {
        pulled += 1;
        yield c;
      }
    }
    expect(await readRawBody(chunks(), 5)).toBeNull();
    expect(pulled).toBe(2);
  });

  it('body ว่าง → Buffer ยาว 0 (ผู้เรียกตัดสินเองว่าว่างผิดไหม)', async () => {
    expect((await readRawBody(stream(), 5))?.length).toBe(0);
  });
});
