// รูปเหตุการณ์รุ่นเก่าเก็บเป็นชื่อไฟล์เปล่า ๆ ต้องเติม base URL ให้ ส่วนรุ่นใหม่เก็บเป็น
// URL เต็มของ Cloudinary อยู่แล้ว — ยกจาก namphrae-map/lib/types.ts
export function imageUrl(file: string): string {
  if (!file) return '';
  if (file.startsWith('http')) return file;
  return `${process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? ''}/${file}`;
}
