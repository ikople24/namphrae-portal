import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // ไฟล์แนบสารบรรณอัปผ่าน /api/admin/saraban/uploads ได้ไม่เกิน 10MB และ route นั้นผ่าน proxy
    // ค่าเริ่มต้นของ proxy คือ 10MB พอดี body ที่ยาวกว่าจะถูกตัดเงียบ ๆ แล้ว route เห็นไฟล์ครึ่งเดียว
    // (docs: proxyClientMaxBodySize) จึงเผื่อไว้ 1MB แล้วให้ route ตัดที่ 10MB เองพร้อมตอบ 413
    proxyClientMaxBodySize: '11mb',
  },
};

export default nextConfig;
