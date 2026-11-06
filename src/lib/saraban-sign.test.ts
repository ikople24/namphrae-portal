// src/lib/saraban-sign.test.ts
import { describe, expect, it } from 'vitest';
import { annotateExtras, buildSignature, clientIp, sha256Hex } from '@/lib/saraban-sign';
import type { SarabanFile, SarabanMark } from '@/types/saraban';

const enc = (s: string) => new TextEncoder().encode(s);
const file = (id: string): SarabanFile => ({
  id, key: `saraban/${id}.pdf`, name: `${id}.pdf`, format: 'pdf', bytes: 3, pages: 1,
  uploadedAt: '2026-11-05T00:00:00.000Z', uploadedBy: 'dev-open',
});
const deps = (configured = true) => ({
  storageConfigured: configured,
  getBytes: async (key: string) => enc(key === 'saraban/a.pdf' ? 'abc' : 'other'),
});
const stamp: SarabanMark = { type: 'stamp', fileId: 'a', page: 1, stamp: 'ack', x: 0.5, y: 0.5, rot: 0 };

describe('clientIp', () => {
  it('ค่าแรกของ x-forwarded-for ก่อน แล้ว socket แล้ว ""', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: { remoteAddress: '::1' } })).toBe('1.2.3.4');
    expect(clientIp({ headers: { 'x-forwarded-for': ['5.6.7.8'] }, socket: {} })).toBe('5.6.7.8');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1');
    expect(clientIp({ headers: { 'x-forwarded-for': ' ' }, socket: {} })).toBe('');
  });
});

describe('buildSignature', () => {
  it('sha256 ของทุกไฟล์ คำนวณจาก bytes เอง', async () => {
    expect(sha256Hex(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const sig = await buildSignature({ files: [file('a')] }, '1.2.3.4', deps());
    expect(sig).toEqual({
      ip: '1.2.3.4',
      files: [{ fileId: 'a', name: 'a.pdf', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }],
    });
  });
  it('ไม่มีไฟล์ → files: [] แม้ไม่ได้ตั้ง bucket · มีไฟล์แต่ไม่ได้ตั้ง → null', async () => {
    expect(await buildSignature({ files: [] }, '', deps(false))).toEqual({ ip: '', files: [] });
    expect(await buildSignature({ files: [file('a')] }, '', deps(false))).toBeNull();
  });
});

describe('annotateExtras', () => {
  const doc = { files: [file('a')] };
  it('ไม่มีอะไร → detail ว่าง (ไม่ใส่ marks: [])', async () => {
    expect(await annotateExtras(doc, { marks: [], sign: false }, '', deps())).toEqual({ ok: true, detail: {} });
  });
  it('mark ถูกต้อง + sign', async () => {
    const r = await annotateExtras(doc, { marks: [stamp], sign: true }, 'ip', deps());
    expect(r.ok && r.detail.marks).toEqual([stamp]);
    expect(r.ok && r.detail.signature?.files[0].fileId).toBe('a');
  });
  it('mark ผิดไฟล์ → 400 invalid_mark · sign ไม่มี bucket → 503', async () => {
    expect(await annotateExtras(doc, { marks: [{ ...stamp, fileId: 'x' }], sign: false }, '', deps())).toEqual({
      ok: false, status: 400, error: 'invalid_mark',
    });
    expect(await annotateExtras(doc, { marks: [], sign: true }, '', deps(false))).toEqual({
      ok: false, status: 503, error: 'storage_not_configured',
    });
  });
});
