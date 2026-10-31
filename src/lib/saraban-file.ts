// src/lib/saraban-file.ts
// แบ็กเอนด์ไฟล์ของสารบรรณ (dev fallback เมื่อไม่มี MONGODB_URI) — ใช้ร่วมสอง store
//
// ปฏิเสธตัวเองตอน production ที่ไม่มี MONGODB_URI เหตุผลเดียวกับ jobs-store.ts:
// Railway เขียนไฟล์ได้จริงแต่ไม่คงอยู่ข้าม deploy — ทะเบียนราชการที่หายเงียบ ๆ ตอน deploy
// รอบถัดไปแย่กว่า 500 ดัง ๆ ทุกครั้งที่เรียกมาก
//
// ไม่มี lock: อ่าน-แก้-เขียนทั้งอาเรย์ สอง request ที่เขียนพร้อมกันแข่งกันได้ — ยอมรับได้
// เพราะเป็น dev fallback คนเดียวใช้ ไม่ใช่โมเดลของ production (เหมือน jobs-store)

import { promises as fs } from 'fs';
import path from 'path';
import { isMongoConfigured } from '@/lib/mongodb';

export const DATA_DIR = path.join(process.cwd(), 'data');

export function assertSarabanFileBackendAllowed(): void {
  if (process.env.NODE_ENV === 'production' && !isMongoConfigured()) {
    throw new Error(
      'ไม่ได้ตั้งค่า MONGODB_URI — ระบบสารบรรณปฏิเสธการเก็บทะเบียนลงไฟล์ในเครื่องตอน ' +
        'production เพราะ filesystem ของ hosting ส่วนใหญ่ไม่คงอยู่ข้าม deploy ' +
        'ตั้งค่า MONGODB_URI ก่อนใช้งานจริง'
    );
  }
}

/**
 * อ่านอาเรย์จากไฟล์ใน data/ — ไม่มีไฟล์ = ผลของ onMissing (ค่าเริ่มต้น [])
 * error อื่นโยนต่อเสมอ: ไฟล์ที่ถูกตัดกลางคัน (fs.writeFile ไม่ atomic) ต้องไม่กลายเป็น []
 * เงียบ ๆ แล้วถูกการเขียนครั้งถัดไปทับทั้งทะเบียน (บทเรียนเดียวกับ jobs-store fileRead)
 */
export async function readJsonArray<T>(
  file: string,
  onMissing: () => Promise<T[]> | T[] = () => []
): Promise<T[]> {
  assertSarabanFileBackendAllowed();
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8')) as T[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return onMissing();
    throw err;
  }
}

export async function writeJsonArray<T>(file: string, rows: T[]): Promise<void> {
  assertSarabanFileBackendAllowed();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(rows, null, 2) + '\n', 'utf8');
}
