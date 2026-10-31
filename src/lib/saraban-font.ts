// src/lib/saraban-font.ts
// ฟอนต์ของระบบสารบรรณตามแบบ — แยกจาก fonts.ts โดยตั้งใจ (สเปกข้อ 7): fonts.ts ถูก _app.tsx import
// ถ้าวางที่นั่น CSS ของฟอนต์นี้จะติดไปทุกหน้าของพอร์ทัล · มีแค่ SarabanLayout ที่ import ไฟล์นี้
import { IBM_Plex_Sans_Thai } from 'next/font/google';

export const sarabanFont = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
