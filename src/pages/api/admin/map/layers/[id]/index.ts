import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getLayer, listVersions, patchLayer } from '@/lib/map-store';
import { layerPatchSchema } from '@/lib/schema';

// ตั้งค่าเลเยอร์ — keyFields / keyComposition / visibility / publicFields
//
// การเปลี่ยน publicFields ไม่ไปแตะไฟล์สาธารณะที่เผยแพร่ไปแล้ว เพราะการกรองเกิด
// ตอนเผยแพร่ ไม่ใช่ตอนเสิร์ฟ ต้องกดเผยแพร่ใหม่ถึงจะมีผล — response จึงบอกกลับไป
// ด้วยว่ามีเวอร์ชันที่เผยแพร่อยู่ค้างด้วยนโยบายเก่าหรือไม่ ไม่งั้นเจ้าหน้าที่จะปิด
// ฟิลด์ PII แล้วเข้าใจว่ามันหายจากอินเทอร์เน็ตทันที ซึ่งไม่จริง
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = String(req.query.id);

  if (req.method === 'GET') {
    const layer = await getLayer(id);
    if (!layer) return res.status(404).json({ error: 'layer_not_found' });
    return res.status(200).json({ layer, versions: await listVersions(id) });
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = layerPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues });
  }

  const before = await getLayer(id);
  if (!before) return res.status(404).json({ error: 'layer_not_found' });

  const layer = await patchLayer(id, {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: admin.email ?? admin.userId,
  });

  const publicFieldsChanged =
    parsed.data.publicFields !== undefined &&
    JSON.stringify([...parsed.data.publicFields].sort()) !==
      JSON.stringify([...before.publicFields].sort());

  return res.status(200).json({
    layer,
    // true = ไฟล์ที่เสิร์ฟอยู่ยังใช้นโยบายเดิม ต้องกดเผยแพร่ใหม่
    republishNeeded: publicFieldsChanged && before.currentVersionNo !== null,
  });
}
