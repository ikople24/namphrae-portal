// src/lib/saraban-attachment.ts
// ตรวจไฟล์แนบจากข้อมูลที่ Cloudinary Admin API คืนมา ไม่ใช่จากที่ client ส่ง (สเปกข้อ 5)
// client-safe ไม่ import SDK — cloudinary.ts เป็นคนเรียก API แล้วส่งผลมาให้ที่นี่ตัดสิน
//
// ทำไมต้องตรวจโฟลเดอร์: client ส่ง publicId มาเองได้ ถ้าไม่ตรวจ คนจะแนบ publicId ของไฟล์
// แผนที่ฉบับเต็ม (type authenticated เหมือนกัน และมีข้อมูลส่วนบุคคล) เข้ามาเป็นไฟล์แนบ
// แล้วเปิดผ่าน URL ชั่วคราวของสารบรรณได้ — ผู้มีสิทธิ์สารบรรณไม่จำเป็นต้องมีสิทธิ์แผนที่

import {
  SARABAN_RESOURCE_TYPES,
  type SarabanFile,
  type SarabanFileFormat,
} from '@/types/saraban';

// โฟลเดอร์แยกจากโดเมนอื่น — บทเรียนจากป่าไม้ที่เคยใช้โฟลเดอร์ร่วมกับแผนที่แล้วไฟล์ถูก
// เขียนทับ (ดูคอมเมนต์ FOREST_FOLDER_FULL ใน cloudinary.ts)
export const SARABAN_FOLDER = 'namphrae-portal/saraban';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_DOC = 10;

/** ส่วนที่ใช้ของผลลัพธ์ cloudinary.api.resource() */
export type CloudinaryResource = {
  public_id: string;
  type: string;
  resource_type: string;
  format?: string;
  bytes: number;
  pages?: number;
};

export type CheckedAttachment = Pick<
  SarabanFile,
  'publicId' | 'resourceType' | 'format' | 'bytes' | 'pages'
>;

export type AttachmentError =
  | 'wrong_folder'
  | 'not_authenticated'
  | 'bad_resource_type'
  | 'bad_format'
  | 'too_large';

export type AttachmentCheck =
  | { ok: true; file: CheckedAttachment }
  | { ok: false; error: AttachmentError };

// Map ไม่ใช่ object literal — FORMATS['constructor'] ของ object literal คืนฟังก์ชันของ
// Object.prototype ซึ่ง truthy แล้วหลุดด่านไป
const FORMATS = new Map<string, SarabanFileFormat>([
  ['pdf', 'pdf'],
  ['jpg', 'jpg'],
  ['jpeg', 'jpg'],
  ['png', 'png'],
]);

// ไฟล์ raw ไม่มีช่อง format แยก นามสกุลติดมากับ public_id
function extensionOf(r: CloudinaryResource): string {
  if (r.format) return r.format.toLowerCase();
  const dot = r.public_id.lastIndexOf('.');
  return dot === -1 ? '' : r.public_id.slice(dot + 1).toLowerCase();
}

export function checkAttachment(r: CloudinaryResource): AttachmentCheck {
  // ต้องมี '/' ต่อท้าย — 'namphrae-portal/saraban-evil/x' ขึ้นต้นด้วยชื่อโฟลเดอร์เราเหมือนกัน
  if (!r.public_id.startsWith(`${SARABAN_FOLDER}/`)) return { ok: false, error: 'wrong_folder' };
  if (r.type !== 'authenticated') return { ok: false, error: 'not_authenticated' };
  // find() บนอาเรย์กลางแทน ternary — ได้ชนิด SarabanResourceType กลับมาเลย และรายการไม่ถูก
  // พิมพ์ซ้ำ (หัวไฟล์ types/saraban.ts)
  const resourceType = SARABAN_RESOURCE_TYPES.find((t) => t === r.resource_type) ?? null;
  if (!resourceType) return { ok: false, error: 'bad_resource_type' };
  const format = FORMATS.get(extensionOf(r));
  if (!format) return { ok: false, error: 'bad_format' };
  if (r.bytes > MAX_FILE_BYTES) return { ok: false, error: 'too_large' };
  return {
    ok: true,
    file: {
      publicId: r.public_id,
      resourceType,
      format,
      bytes: r.bytes,
      // PDF แบบ image: Cloudinary นับหน้าให้ · รูปภาพ = 1 หน้า · PDF แบบ raw ไม่รู้ = 0
      pages: r.pages ?? (format === 'pdf' ? 0 : 1),
    },
  };
}
