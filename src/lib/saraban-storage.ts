// src/lib/saraban-storage.ts
// ไฟล์แนบของสารบรรณใน Railway Storage Bucket (S3-compatible) — SERVER ONLY (สเปกข้อ 5)
// เซิร์ฟเวอร์เป็นผู้เดียวที่เขียนลง bucket: ContentType กับ metadata pages ที่ putObject ตั้งไว้
// จึงเป็นสิ่งที่ checkAttachment เชื่อได้ · bucket เป็น private เสมอ เปิดดูผ่านลิงก์ชั่วคราวเท่านั้น

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { inlineDisposition, SARABAN_PREFIX, type StoredObject } from '@/lib/saraban-attachment';
import { attachedKeys } from '@/lib/saraban-store';

const ENV_KEYS = [
  'BUCKET_NAME',
  'BUCKET_ENDPOINT',
  'BUCKET_REGION',
  'BUCKET_ACCESS_KEY_ID',
  'BUCKET_SECRET_ACCESS_KEY',
] as const;

/** ไม่ครบ = แนบไฟล์ไม่ได้ แต่ลงรับได้ตามปกติ (หลัก zero-config · route ตอบ 503 storage_not_configured) */
export function isStorageConfigured(): boolean {
  return ENV_KEYS.every((key) => Boolean(process.env[key]));
}

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    region: process.env.BUCKET_REGION,
    endpoint: process.env.BUCKET_ENDPOINT,
    credentials: {
      accessKeyId: process.env.BUCKET_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY as string,
    },
    // Railway bucket ใหม่ใช้ virtual-hosted style (ชื่อ bucket เป็น subdomain)
    forcePathStyle: false,
    // SDK v3 รุ่นใหม่แนบ checksum CRC32 ทุกคำขอเป็นค่าเริ่มต้น บริการ S3-compatible บางเจ้ายังไม่รองรับ
    // แล้วปฏิเสธทั้งคำขอ — ส่งเฉพาะเมื่อ operation บังคับ
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return client;
}

function bucket(): string {
  return process.env.BUCKET_NAME as string;
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
  pages: number
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
      Metadata: { pages: String(pages) },
    })
  );
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

/** null = ไม่มี object นี้ · error อื่น (bucket ล่ม สิทธิ์ผิด) โยนต่อให้ route ตอบ 500 */
export async function headObject(key: string): Promise<StoredObject | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { key, bytes: r.ContentLength ?? 0, contentType: r.ContentType, pages: r.Metadata?.pages };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export const VIEW_URL_TTL_SECONDS = 300;

/**
 * ลิงก์ชั่วคราวสำหรับเปิดดู (สเปกข้อ 5 "เปิดดู") — route redirect ไปที่นี่ ไม่ stream ผ่านแอป
 * ส่ง ContentType ซ้ำจาก object เพื่อให้เบราว์เซอร์ไม่ต้องเดาจากเนื้อไฟล์
 */
export async function viewUrl(
  key: string,
  name: string,
  contentType: string,
  ttlSeconds: number = VIEW_URL_TTL_SECONDS
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: inlineDisposition(name),
      ResponseContentType: contentType,
    }),
    { expiresIn: ttlSeconds }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/**
 * กวาดไฟล์ของคำขอที่บันทึกล้ม — ลบเฉพาะ key ใต้ prefix ที่ยังไม่ผูกกับหนังสือเรื่องใด
 * (สเปกข้อ 5: ไม่งั้นคนส่ง key ของหนังสือคนอื่นมาในคำขอที่ตั้งใจให้ล้ม แล้วไฟล์ราชการถูกลบ)
 * ไม่โยน: ลบไม่สำเร็จ = เหลือไฟล์กำพร้า ซึ่งต้องไม่กลบ error เดิมของคำขอ
 */
export async function discardUnattached(keys: readonly string[]): Promise<void> {
  const ours = keys.filter((key) => key.startsWith(SARABAN_PREFIX));
  if (ours.length === 0 || !isStorageConfigured()) return;
  try {
    const attached = await attachedKeys(ours);
    await Promise.all(
      ours
        .filter((key) => !attached.has(key))
        .map((key) =>
          deleteObject(key).catch((err) =>
            console.warn('discardUnattached: ลบไม่สำเร็จ เหลือไฟล์กำพร้า', key, err)
          )
        )
    );
  } catch (err) {
    console.warn('discardUnattached: ตรวจ key ไม่สำเร็จ ไม่ลบอะไร', ours, err);
  }
}

// ---- ใช้โดยสคริปต์สำรองไฟล์ ------------------------------------------------

/** key ทั้งหมดใต้ prefix ของสารบรรณ (ไล่ทุกหน้าของ ListObjectsV2) */
export async function listKeys(): Promise<{ key: string; bytes: number }[]> {
  const out: { key: string; bytes: number }[] = [];
  let token: string | undefined;
  do {
    const page = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: SARABAN_PREFIX, ContinuationToken: token })
    );
    for (const o of page.Contents ?? []) if (o.Key) out.push({ key: o.Key, bytes: o.Size ?? 0 });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!r.Body) throw new Error(`object ว่าง: ${key}`);
  return r.Body.transformToByteArray();
}
