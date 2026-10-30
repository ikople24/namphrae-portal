import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature, type AdminIdentity } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { checkAttachment, looseKeysOf } from '@/lib/saraban-attachment';
import { OPEN_STATUSES, type NewDocFields } from '@/lib/saraban-doc';
import { bangkokDateOf, composeRef, fiscalYearOf } from '@/lib/saraban-number';
import {
  docKindSchema,
  docListQuerySchema,
  receiveInputSchema,
  sendInputSchema,
  type FileRef,
  type ReceiveInput,
} from '@/lib/saraban-schema';
import { discardUnattached, headObject, isStorageConfigured } from '@/lib/saraban-storage';
import {
  attachedKeys,
  countDocs,
  createDoc,
  getDoc,
  listDocs,
  listFiscalYears,
  PAGE_SIZE,
  registerCounts,
} from '@/lib/saraban-store';
import { getUnit } from '@/lib/saraban-units-store';
import type { SarabanFile } from '@/types/saraban';

// GET  /api/admin/saraban/docs?register=in[&year=2570][&view=pending][&page=2]
//      ทะเบียนหนึ่งหน้า + ตัวเลขบนปุ่มกรอง + ปีที่เลือกได้ + เรื่องค้างข้ามปี + today
//      (หน้าจอต้องส่ง today ตัวนี้เข้า displayStatus ป้ายบนแถวกับตัวเลขบนปุ่มจะได้ไม่ขัดกัน)
// POST /api/admin/saraban/docs?kind=receive|send — ลงรับ / ออกเลขส่งหรือเวียน
//      201 = ออกเลขใหม่ · 200 = ส่งซ้ำ ได้เรื่องเดิม (idempotency สเปกข้อ 4)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') return create(req, res, admin);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function list(req: NextApiRequest, res: NextApiResponse) {
  const parsed = docListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  try {
    const { register, view, page } = parsed.data;
    const today = bangkokDateOf(new Date());
    const currentYear = fiscalYearOf(today);
    const fiscalYear = parsed.data.year ?? currentYear;
    const [result, counts, years, carryOver] = await Promise.all([
      listDocs({ register, fiscalYear, view }, page, today),
      registerCounts(register, fiscalYear, today),
      listFiscalYears(register, currentYear),
      countDocs({ register, beforeFiscalYear: fiscalYear, statusIn: OPEN_STATUSES }, today),
    ]);
    return res.status(200).json({
      ...result,
      page,
      pageSize: PAGE_SIZE,
      fiscalYear,
      years,
      counts,
      carryOver,
      today,
    });
  } catch (err) {
    console.error('GET /api/admin/saraban/docs failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function create(req: NextApiRequest, res: NextApiResponse, admin: AdminIdentity) {
  const kind = docKindSchema.safeParse(req.query.kind);
  const input = kind.success
    ? (kind.data === 'receive' ? receiveInputSchema : sendInputSchema).safeParse(req.body)
    : null;
  if (!kind.success || !input?.success) {
    await discardUnattached(looseKeysOf(req.body));
    return res
      .status(400)
      .json({ error: 'invalid_input', issues: input && !input.success ? input.error.issues : [] });
  }
  const data = input.data;
  const fileKeys = data.files.map((f) => f.key);
  const reject = async (status: number, body: object) => {
    await discardUnattached(fileKeys);
    return res.status(status).json(body);
  };

  try {
    // ส่งซ้ำ — ตอบเรื่องเดิมก่อนตรวจไฟล์ (key ของเรื่องเดิมนับเป็น "แนบแล้ว" จะทำให้การส่งซ้ำล้ม)
    const existing = await getDoc(data.id);
    if (existing) {
      return existing.registeredBy === admin.userId
        ? res.status(200).json(existing)
        : res.status(409).json({ error: 'id_conflict' });
    }

    // หน่วย: รับ = "เสนอถึง" ต้องมีและเปิดอยู่ · ส่ง/เวียน = เจ้าของเรื่องต้องมีรหัสส่วนราชการ
    const unitId = 'holderUnitId' in data ? data.holderUnitId : data.ownerUnitId;
    const unit = await getUnit(unitId);
    if (!unit || !unit.isActive || (kind.data === 'send' && !unit.refCode)) {
      return reject(400, { error: 'invalid_unit' });
    }

    const files = await checkFiles(data.files, admin.userId);
    if (files === 'storage_not_configured') return reject(503, { error: 'storage_not_configured' });
    if (files === 'invalid_file') return reject(400, { error: 'invalid_file' });

    const actor = await resolveActor(admin);
    const result =
      'holderUnitId' in data
        ? await createDoc({
            id: data.id,
            fields: receiveFields(data),
            files,
            actor,
            eventNote: `ลงรับ เสนอ${unit.name}`,
          })
        : await createDoc({
            id: data.id,
            fields: {
              register: data.circular ? 'circular' : 'out',
              ref: '',
              docDate: data.docDate,
              party: data.party,
              subject: data.subject,
              level: data.level,
              dueDate: '',
              holderUnitId: unit.id,
            },
            refFor: (no) => composeRef(unit.refCode, data.circular ? 'circular' : 'out', no),
            files,
            actor,
            eventNote: `ออกเลข${data.circular ? 'หนังสือเวียน' : 'หนังสือส่ง'} ${unit.name}`,
          });

    if (!result.ok) {
      return reject(result.error === 'number_busy' ? 503 : 409, { error: result.error });
    }
    return res.status(result.created ? 201 : 200).json(result.doc);
  } catch (err) {
    console.error('POST /api/admin/saraban/docs failed', err);
    return reject(500, { error: 'server_error' });
  }
}

function receiveFields(data: ReceiveInput): NewDocFields {
  return {
    register: 'in',
    ref: data.ref,
    docDate: data.docDate,
    party: data.party,
    subject: data.subject,
    level: data.level,
    dueDate: data.dueDate,
    holderUnitId: data.holderUnitId,
  };
}

/**
 * ตรวจไฟล์ที่ฟอร์มอ้างถึงกับ object จริงใน bucket (สเปกข้อ 5) — key ซ้ำในคำขอเดียว · แนบกับ
 * เรื่องอื่นแล้ว · ไม่มี object · ไม่ผ่าน checkAttachment → invalid_file ทั้งคำขอ ไม่แนบครึ่ง ๆ
 */
async function checkFiles(
  refs: FileRef[],
  userId: string
): Promise<SarabanFile[] | 'invalid_file' | 'storage_not_configured'> {
  if (refs.length === 0) return [];
  if (!isStorageConfigured()) return 'storage_not_configured';
  const keys = refs.map((f) => f.key);
  if (new Set(keys).size !== keys.length) return 'invalid_file';
  if ((await attachedKeys(keys)).size > 0) return 'invalid_file';

  const now = new Date().toISOString();
  const files: SarabanFile[] = [];
  for (const ref of refs) {
    const head = await headObject(ref.key);
    const check = head ? checkAttachment(head) : null;
    if (!check?.ok) return 'invalid_file';
    files.push({ id: crypto.randomUUID(), name: ref.name, ...check.file, uploadedAt: now, uploadedBy: userId });
  }
  return files;
}
