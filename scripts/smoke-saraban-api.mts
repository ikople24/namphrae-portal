// scripts/smoke-saraban-api.mts
/* eslint-disable @typescript-eslint/no-explicit-any -- smoke อ่าน JSON ของ API แบบหลวม ๆ ประกาศชนิดซ้ำทุก route ไม่คุ้ม */
// smoke ของ API สารบรรณผ่าน dev server จริง — ครอบทางที่เทสต์หน่วยแตะไม่ถึง: ลำดับของ route
// การกวาดไฟล์ ลิงก์ชั่วคราว และรหัสข้อผิดพลาดของสเปกข้อ 8
//
// รัน (สองเทอร์มินัล หรือ server เป็น background):
//   rm -f data/saraban-*.json; MONGODB_URI= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= \
//     npx next dev -p 3123
//   SMOKE_BASE=http://localhost:3123 npx tsx --env-file=.env.local scripts/smoke-saraban-api.mts
// ปฏิเสธเองถ้า BUCKET_NAME ไม่มี '-dev'

import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { deleteObject, headObject, listKeys } from '@/lib/saraban-storage';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3123';
if (!process.env.BUCKET_NAME?.includes('-dev')) {
  console.error('FAIL ไม่ใช่ bucket ทดสอบ:', process.env.BUCKET_NAME);
  process.exit(1);
}

const results: string[] = [];
function check(label: string, ok: boolean, detail: unknown = '') {
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` → ${JSON.stringify(detail)}`}`);
}

async function call(method: string, path: string, body?: unknown, raw?: Uint8Array) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: raw ? { 'content-type': 'application/octet-stream' } : body ? { 'content-type': 'application/json' } : {},
    body: raw ? Buffer.from(raw) : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, location: res.headers.get('location') };
}

async function pdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage();
  return doc.save();
}

const created: string[] = [];
const receive = (id: string, files: { key: string; name: string }[] = []) => ({
  id,
  ref: 'ชม 0023.1/ว 1245',
  docDate: '2026-09-28',
  party: 'ที่ทำการปกครองอำเภอหางดง',
  subject: 'ขอเชิญประชุม',
  holderUnitId: 'palad',
  files,
});

try {
  const units = await call('GET', '/api/admin/saraban/units');
  check('units seeded 14', units.status === 200 && units.json.length === 14, units.status);

  const summary0 = await call('GET', '/api/admin/saraban/summary');
  check('summary storageConfigured', summary0.json?.storageConfigured === true, summary0.json);

  const up = await call('POST', '/api/admin/saraban/uploads', undefined, await pdf(2));
  check('upload pdf 201 pages 2', up.status === 201 && up.json.pages === 2 && up.json.format === 'pdf', up);
  created.push(up.json?.key);

  const gif = await call('POST', '/api/admin/saraban/uploads', undefined, new TextEncoder().encode('GIF89a....'));
  check('upload gif → 400 bad_format', gif.status === 400 && gif.json.error === 'bad_format', gif);

  const big = await call('POST', '/api/admin/saraban/uploads', undefined, new Uint8Array(10 * 1024 * 1024 + 1));
  check('upload 10MB+1 → 413', big.status === 413, big.status);

  const docId = randomUUID();
  const files = [{ key: up.json.key, name: 'หนังสือเชิญ.pdf' }];
  const r1 = await call('POST', '/api/admin/saraban/docs?kind=receive', receive(docId, files));
  check('receive 201 no 1 with file', r1.status === 201 && r1.json.no === 1 && r1.json.files[0]?.pages === 2, r1);
  const r2 = await call('POST', '/api/admin/saraban/docs?kind=receive', receive(docId, files));
  check('resend → 200 same no', r2.status === 200 && r2.json.no === 1, r2.status);

  const steal = await call('POST', '/api/admin/saraban/docs?kind=receive', receive(randomUUID(), files));
  check('reuse attached key → 400 invalid_file', steal.status === 400 && steal.json.error === 'invalid_file', steal);
  check('attached file survives failed request', (await headObject(up.json.key)) !== null);

  const orphan = await call('POST', '/api/admin/saraban/uploads', undefined, await pdf(1));
  const bad = await call('POST', '/api/admin/saraban/docs?kind=receive', {
    ...receive(randomUUID(), [{ key: orphan.json.key, name: 'x.pdf' }]),
    docDate: '2569-09-28',
  });
  check('invalid input → 400', bad.status === 400 && bad.json.error === 'invalid_input', bad.status);
  check('unattached file discarded on failure', (await headObject(orphan.json.key)) === null);

  const badUnit = await call('POST', '/api/admin/saraban/docs?kind=receive', { ...receive(randomUUID()), holderUnitId: 'nope' });
  check('unknown unit → 400 invalid_unit', badUnit.status === 400 && badUnit.json.error === 'invalid_unit', badUnit);

  const list = await call('GET', '/api/admin/saraban/docs?register=in');
  check('list total 1 · counts.pending 1 · today', list.json?.total === 1 && list.json.counts.pending === 1 && Boolean(list.json.today), list.json);

  const fileId = r1.json.files[0].id;
  const view = await call('GET', `/api/admin/saraban/docs/${docId}/files/${fileId}`);
  check('view → 302 to bucket', view.status === 302 && Boolean(view.location?.includes('storageapi')), view.status);
  const fetched = await fetch(view.location!);
  check('presigned link serves pdf', fetched.status === 200 && fetched.headers.get('content-type') === 'application/pdf', fetched.status);

  const v1 = r1.json.updatedAt;
  const edit = await call('PATCH', `/api/admin/saraban/docs/${docId}`, { action: 'edit', updatedAt: v1, edit: { subject: 'แก้เรื่อง', holderUnitId: 'mayor' } });
  const change = edit.json?.events?.at(-1)?.changes?.find((c: any) => c.field === 'holderUnitId');
  check('edit 200 · holder change stored as names', edit.status === 200 && change?.from === 'ปลัดเทศบาล' && change?.to === 'นายกเทศมนตรี', edit.json?.events?.at(-1));
  const stale = await call('PATCH', `/api/admin/saraban/docs/${docId}`, { action: 'edit', updatedAt: v1, edit: { subject: 'ทับ' } });
  check('stale version → 409 stale', stale.status === 409 && stale.json.error === 'stale', stale);
  const noop = await call('PATCH', `/api/admin/saraban/docs/${docId}`, { action: 'edit', updatedAt: edit.json.updatedAt, edit: { subject: 'แก้เรื่อง' } });
  check('no-op edit → 200 no new event', noop.status === 200 && noop.json.events.length === edit.json.events.length, noop.json?.events?.length);

  const up2 = await call('POST', '/api/admin/saraban/uploads', undefined, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  created.push(up2.json?.key);
  const add = await call('POST', `/api/admin/saraban/docs/${docId}/files`, { file: { key: up2.json.key, name: 'รูป.jpg' } });
  check('add jpg 201 · 2 files', add.status === 201 && add.json.files.length === 2, add);
  const del = await call('DELETE', `/api/admin/saraban/docs/${docId}/files/${fileId}`);
  check('delete file 200 · 1 file left', del.status === 200 && del.json.files.length === 1, del);
  check('deleted object gone from bucket', (await headObject(up.json.key)) === null);
  const gone = await call('GET', `/api/admin/saraban/docs/${docId}/files/${fileId}`);
  check('view deleted file → 404', gone.status === 404, gone.status);

  const sendBody = { id: randomUUID(), ownerUnitId: 'office', docDate: '2026-10-02', party: 'นายอำเภอหางดง', subject: 'รายงาน' };
  const out = await call('POST', '/api/admin/saraban/docs?kind=send', sendBody);
  check('send 201 ref ชม 55201/1', out.status === 201 && out.json.ref === 'ชม 55201/1' && out.json.status === 'in-progress', out.json?.ref);
  const noRef = await call('POST', '/api/admin/saraban/docs?kind=send', { ...sendBody, id: randomUUID(), ownerUnitId: 'finance' });
  check('send from unit without refCode → 400 invalid_unit', noRef.status === 400 && noRef.json.error === 'invalid_unit', noRef);

  const sent = await call('PATCH', `/api/admin/saraban/docs/${out.json.id}`, { action: 'sent', updatedAt: out.json.updatedAt, method: 'post' });
  check('sent → done', sent.status === 200 && sent.json.status === 'done' && sent.json.sendMethod === 'post', sent.json?.status);
  const voidDone = await call('PATCH', `/api/admin/saraban/docs/${out.json.id}`, { action: 'void', updatedAt: sent.json.updatedAt, reason: 'x' });
  check('void done doc → 409 invalid_transition', voidDone.status === 409 && voidDone.json.error === 'invalid_transition', voidDone);

  const year = await call('GET', '/api/admin/saraban/years?register=circular');
  const start = await call('PUT', '/api/admin/saraban/years', { register: 'circular', fiscalYear: year.json.fiscalYear, startNo: 12 });
  check('set circular start 12', start.status === 200 && start.json.nextNo === 12, start.json);
  const circ = await call('POST', '/api/admin/saraban/docs?kind=send', { ...sendBody, id: randomUUID(), circular: true });
  check('circular gets no 12 ref ชม 55201/ว 12', circ.json?.no === 12 && circ.json.ref === 'ชม 55201/ว 12', circ.json?.ref);
  const inUse = await call('PUT', '/api/admin/saraban/years', { register: 'in', fiscalYear: year.json.fiscalYear, startNo: 5 });
  check('start on used year → 409 year_in_use', inUse.status === 409, inUse.status);

  const summary = await call('GET', '/api/admin/saraban/summary');
  check('summary inboxPending 1', summary.json?.inboxPending === 1, summary.json);
} finally {
  // เก็บกวาด bucket ทดสอบ: ทุก object ใต้ saraban/ ที่ smoke นี้อาจสร้าง
  for (const { key } of await listKeys()) await deleteObject(key);
  console.log(results.join('\n'));
  console.log(results.some((r) => r.startsWith('FAIL')) ? '\nSMOKE FAILED' : '\nSMOKE OK');
}
