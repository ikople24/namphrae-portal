# สารบรรณ — ดึงเรื่องกลับ และล็อกหนังสือรับที่จบเรื่องแล้ว

วันที่ 2026-11-04 · ต่อบน `feat/saraban-3` (PR #10) · ผู้ใช้อนุมัติแบบร่างในแชตแล้ว

## ปัญหา

หนังสือรับที่กด "จบเรื่อง" แล้วย้อนกลับไม่ได้ ถ้าจบผิดหรือมีเรื่องต่อต้องลงรับใหม่ และธุรการทุกคนที่มีสิทธิ์
`saraban` ยังแก้ข้อมูลของเรื่องที่จบแล้วได้เงียบ ๆ

## สิ่งที่ทำ

1. **ดึงเรื่องกลับ — ผู้จัดการเท่านั้น** (`admin.isManager`)
   - เฉพาะหนังสือรับ (`register = 'in'`) สถานะ `done` · ส่ง/เวียนที่ส่งแล้วและหนังสือยกเลิกดึงไม่ได้
   - ต้องมีเหตุผล (1–500 ตัวอักษร) แบบเดียวกับการยกเลิก
   - ผล: `status → 'in-progress'` · `holderUnitId` คงเดิม (ตำแหน่งที่กดจบเรื่อง) · `circulation` คงเดิม
   - event ใหม่ kind `reopened` (ป้าย "ดึงเรื่องกลับ") note = เหตุผล
   - ทางเข้า: action `reopen` ใน `PATCH /api/admin/saraban/docs/[id]` เดิม (ได้ stale check + event + applyPatch)
   - ไม่ใช่ผู้จัดการ → 403 `manager_only` · สถานะไม่ใช่ done/ไม่ใช่หนังสือรับ → 409 `invalid_transition`
   - โหมดเจ้าหน้าที่ไม่มี action นี้ (`memberPatchSchema` ไม่เปลี่ยน)
2. **ล็อกการแก้ข้อมูล** — `editableFieldsOf(doc, { isManager })`: หนังสือรับ `done` + ไม่ใช่ผู้จัดการ → `[]`
   ผู้จัดการได้ช่องเดิม (ไม่รวม `holderUnitId`) · `buildEdit` รับ option เดียวกัน · route ตอบ 409 `field_locked`
   · แนบไฟล์เพิ่มยังได้ (`canAddFile` ไม่เปลี่ยน)
3. **หน้าจอ** `/saraban/track/[id]` — อ่าน `isManager` จาก `/api/admin/me` (แบบหน้าสมุดผู้รับ) · ปุ่มแก้ไขซ่อนตาม
   `editableFieldsOf` ที่ส่ง isManager · ปุ่ม "ดึงเรื่องกลับ" (ผู้จัดการ + `canReopen`) เปิดแผงกรอกเหตุผล + ยืนยัน
   · บันทึกสำเร็จรีเฟรชรายการทั้งโหมดเต็มและงานของฉัน (ใช้ `run()` เดิม)

## ไม่ทำ

เลือกตำแหน่งปลายทางตอนดึงกลับ (เกษียนส่งต่อทีหลังได้) · ดึงกลับหนังสือส่ง/เวียน · ยกเลิกหนังสือที่จบแล้ว

## ทดสอบ

- `saraban-doc.test.ts`: `canReopen`, `reopenTransition`, `editableFieldsOf`/`buildEdit` ตาม isManager
- `saraban-schema` รับ `reopen` (เหตุผลว่าง → ไม่ผ่าน) · `memberPatchSchema` ไม่รับ `reopen`
- `api-guard-coverage.test.ts`: route ของ docs/[id] เช็ค `isManager` ก่อน `reopenTransition`
- smoke บน dev server: ดึงกลับสำเร็จ / done ที่ยังไม่ใช่ผู้จัดการ (ทดสอบผ่านตรรกะ) / ดึงซ้ำ 409 / เรื่องกลับเข้าแท็บรอฉันทำ
