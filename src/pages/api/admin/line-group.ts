import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import {
  getLineGroupId,
  isLineConfigured,
  isLinePushConfigured,
  isLineWebhookConfigured,
  setLineGroupId,
} from '@/lib/line';

// GET   /api/admin/line-group  → { lineGroupId, configured, push, webhook }
// `configured` คือ push && webhook เก็บไว้เพื่อไม่ให้ผู้ใช้เดิมของฟิลด์นี้พัง —
// `push`/`webhook` คือสองความพร้อมที่แยกจากกันจริง (ดู isLinePushConfigured/
// isLineWebhookConfigured ใน line.ts) ตั้งแค่ token อย่างเดียวก็ส่งแจ้งเตือน
// ได้แล้ว แม้ webhook (รับ groupId ตอนเชิญบอทเข้ากลุ่ม) จะยังไม่พร้อมก็ตาม
// PATCH /api/admin/line-group  body { lineGroupId: string }
//
// ปกติ webhook เก็บ groupId ให้เองตอนบอทถูกเชิญเข้ากลุ่ม PATCH ไว้กรอกเองเมื่อ
// webhook ยังไม่ได้ตั้ง หรือต้องย้ายไปกลุ่มอื่นโดยไม่เชิญบอทใหม่
//
// GET มีไว้เพราะ LINE_CHANNEL_SECRET ไม่ใช่ NEXT_PUBLIC_ หน้า settings ที่รันฝั่ง
// client จึงเรียก isLineConfigured() เองไม่ได้ ต้องถามผ่านเส้นทางนี้ — ถ้าไม่มี
// ตัวบอก เจ้าหน้าที่จะไม่รู้เลยว่าระบบแจ้งเตือนพร้อมทำงานหรือยัง จนกว่างานจะ
// ถูกสร้างแล้วไม่มีใครได้รับแจ้ง
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      return res.status(200).json({
        lineGroupId: (await getLineGroupId()) ?? null,
        configured: isLineConfigured(),
        push: isLinePushConfigured(),
        webhook: isLineWebhookConfigured(),
      });
    } catch (err) {
      console.error('GET /api/admin/line-group failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'PATCH') {
    const value = (req.body as { lineGroupId?: unknown })?.lineGroupId;
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'invalid_group_id' });
    }

    const trimmed = value.trim();
    try {
      await setLineGroupId(trimmed || undefined, admin.email ?? admin.userId);
      return res.status(200).json({ lineGroupId: trimmed || null });
    } catch (err) {
      console.error('PATCH /api/admin/line-group failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'method_not_allowed' });
}
