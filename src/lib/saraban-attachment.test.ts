// src/lib/saraban-attachment.test.ts
import { describe, expect, it } from 'vitest';
import {
  checkAttachment,
  MAX_FILE_BYTES,
  SARABAN_FOLDER,
  type CloudinaryResource,
} from '@/lib/saraban-attachment';
import { SARABAN_FILE_FORMATS } from '@/types/saraban';

function resource(overrides: Partial<CloudinaryResource> = {}): CloudinaryResource {
  return {
    public_id: `${SARABAN_FOLDER}/2570/abc123`,
    type: 'authenticated',
    resource_type: 'image',
    format: 'pdf',
    bytes: 1_200_000,
    pages: 2,
    ...overrides,
  };
}

describe('checkAttachment — เชื่อ Cloudinary ไม่เชื่อ client', () => {
  it('PDF แบบ image ผ่าน และขนาด/จำนวนหน้ามาจาก resource', () => {
    expect(checkAttachment(resource())).toEqual({
      ok: true,
      file: {
        publicId: `${SARABAN_FOLDER}/2570/abc123`,
        resourceType: 'image',
        format: 'pdf',
        bytes: 1_200_000,
        pages: 2,
      },
    });
  });

  it('ไฟล์เต็มของแผนที่ (มีข้อมูลส่วนบุคคล) แนบเป็นไฟล์ของสารบรรณไม่ได้', () => {
    const r = resource({ public_id: 'namphrae-portal/map/full/land-parcels' });
    expect(checkAttachment(r)).toEqual({ ok: false, error: 'wrong_folder' });
  });

  it('โฟลเดอร์ที่ชื่อขึ้นต้นเหมือนกันแต่ไม่ใช่ของเรา — ต้องเช็ค "/" ต่อท้ายด้วย', () => {
    const r = resource({ public_id: 'namphrae-portal/saraban-evil/x' });
    expect(checkAttachment(r)).toEqual({ ok: false, error: 'wrong_folder' });
  });

  it('ไฟล์ type upload (ใครรู้ URL ก็เปิดได้) ไม่รับ', () => {
    expect(checkAttachment(resource({ type: 'upload' }))).toEqual({
      ok: false,
      error: 'not_authenticated',
    });
  });

  it('resource_type อื่นนอกจาก image/raw ไม่รับ', () => {
    expect(checkAttachment(resource({ resource_type: 'video' }))).toEqual({
      ok: false,
      error: 'bad_resource_type',
    });
  });

  it('นามสกุลนอกรายการไม่รับ — รวมชื่อที่ชนกับ property ของ Object', () => {
    expect(checkAttachment(resource({ format: 'gif' }))).toEqual({ ok: false, error: 'bad_format' });
    expect(checkAttachment(resource({ format: 'constructor' }))).toEqual({
      ok: false,
      error: 'bad_format',
    });
  });

  it('jpeg เก็บเป็น jpg และรูปภาพนับเป็น 1 หน้า', () => {
    const result = checkAttachment(resource({ format: 'jpeg', pages: undefined }));
    expect(result.ok && result.file.format).toBe('jpg');
    expect(result.ok && result.file.pages).toBe(1);
  });

  it('PDF แบบ raw: นามสกุลมาจาก public_id และไม่รู้จำนวนหน้า = 0', () => {
    const result = checkAttachment(
      resource({
        public_id: `${SARABAN_FOLDER}/2570/scan.pdf`,
        resource_type: 'raw',
        format: undefined,
        pages: undefined,
      })
    );
    expect(result).toEqual({
      ok: true,
      file: {
        publicId: `${SARABAN_FOLDER}/2570/scan.pdf`,
        resourceType: 'raw',
        format: 'pdf',
        bytes: 1_200_000,
        pages: 0,
      },
    });
  });

  it('เพดาน 10MB พอดีผ่าน เกินหนึ่งไบต์ไม่ผ่าน', () => {
    expect(checkAttachment(resource({ bytes: MAX_FILE_BYTES })).ok).toBe(true);
    expect(checkAttachment(resource({ bytes: MAX_FILE_BYTES + 1 }))).toEqual({
      ok: false,
      error: 'too_large',
    });
  });

  it('ทุกนามสกุลใน SARABAN_FILE_FORMATS ผ่านและเก็บเป็นค่าเดิม — FORMATS ต้องครอบรายการกลางครบ', () => {
    for (const format of SARABAN_FILE_FORMATS) {
      const result = checkAttachment(resource({ format }));
      expect(result.ok && result.file.format, format).toBe(format);
    }
  });
});
