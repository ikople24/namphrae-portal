# ระบบสิทธิ์รายฟีเจอร์ + ผู้จัดการ Portal

วันที่: 2026-08-11
สถานะ: อนุมัติแล้ว (brainstorming เสร็จ ผู้ใช้สั่ง implement)

## เป้าหมาย

เปลี่ยนโมเดลสิทธิ์จาก binary "เป็นสมาชิกหรือไม่เป็น" ให้มี **ผู้จัดการ Portal** ที่กำหนดได้ว่าสมาชิกแต่ละคนเห็น/ใช้ฟีเจอร์ไหนได้บ้าง โดยบังคับใช้จริงทั้งระดับหน้า (SSR) และระดับ API ไม่ใช่แค่ซ่อนเมนู

ผู้จัดการคนแรก: `user_2xzFppRzzgHlqfnuTatBJBAAzmF` (ตั้งผ่าน env ไม่ hardcode)

## สิ่งที่ไม่ทำ (Non-goals)

- ไม่แตะ registry ที่แชร์ `db_namphrae.users` — ไม่เพิ่ม field ใหม่ ไม่เปลี่ยนความหมาย `role` (free-text label เดิมคงอยู่เพื่อแสดงผลเท่านั้น)
- ไม่กระทบ smart-namphrae และ namphrae-map
- ไม่ทำระดับสิทธิ์ย่อยในฟีเจอร์ (ดู/แก้แยกกัน) — ได้ฟีเจอร์คือใช้ได้ทั้งฟีเจอร์
- ไม่เปลี่ยนหน้า public และ API public (ยังใช้ data-level redaction เดิม)

## โมเดลสิทธิ์

### ฟีเจอร์ที่มอบสิทธิ์ได้ (6 กลุ่ม)

| key | หน้า | API |
|---|---|---|
| `links` | `/admin` (จัดการลิงก์), `/admin/links/new`, `/admin/links/[id]` | `/api/admin/links/*` (index, [id], reorder) |
| `categories` | `/admin/categories` | `/api/admin/categories` |
| `calendar` | `/admin/calendar`, `/admin/calendar/new`, `/admin/calendar/[id]` | `/api/admin/calendar/*` |
| `map` | `/admin/map`, `/admin/map/viewer`, `/admin/map/[layerId]` | `/api/admin/map/**` (layers, versions, upload-signature, issues, download, publish) |
| `data` | `/admin/data` | API สถิติที่หน้า data ใช้ |
| `settings` | `/admin/settings` | `/api/admin/config`, `/api/admin/site`, `/api/admin/line-group` |

route ที่ใช้ร่วมหลายฟีเจอร์ (เช่น `/api/admin/upload`) → อนุญาตเมื่อมีสิทธิ์ฟีเจอร์ใดฟีเจอร์หนึ่งที่ใช้มัน (mapping สรุปตอนเขียนแผนจากการอ่านโค้ดจริง)

### ผู้จัดการ (isManager)

- เห็นทุกฟีเจอร์เสมอ (ไม่ต้องติ๊กรายฟีเจอร์)
- สิทธิ์เฉพาะผู้จัดการ (มอบให้สมาชิกธรรมดาไม่ได้): หน้า `/admin/users` ทั้งหมด — อนุมัติ/ปฏิเสธผู้สมัคร (`/api/admin/signups/*`), เปิด-ปิดการใช้งานสมาชิก (`/api/admin/users/*`), กำหนดสิทธิ์ฟีเจอร์, ตั้ง/ถอดผู้จัดการคนอื่น
- มอบต่อได้: ผู้จัดการตั้งสมาชิกคนอื่นเป็นผู้จัดการเพิ่มได้

### ค่าเริ่มต้นและ bootstrap

- สมาชิกที่ไม่มี document สิทธิ์ (รวมสมาชิกเก่าทุกคน ณ วัน deploy) → เห็น `['calendar', 'data']`
- env `PORTAL_MANAGER_CLERK_ID` → clerkId นั้นเป็นผู้จัดการเสมอ ถอดไม่ได้ (กันระบบไร้ผู้จัดการ) ตั้งใน Railway ก่อน deploy และเพิ่มใน `.env.example`
- กันล็อกเอาต์: ผู้จัดการถอดสถานะผู้จัดการของตัวเองไม่ได้ (`cannot_demote_self` แบบเดียวกับ `cannot_deactivate_self` เดิม)

## ที่เก็บข้อมูล

Collection ใหม่ **`namphrae_portal.userAccess`** (DB ของ Portal เอง):

```ts
{
  clerkId: string        // unique index
  features: FeatureKey[] // subset ของ 6 key ข้างบน
  isManager: boolean
  updatedAt: Date
  updatedBy: string      // email/userId ของผู้จัดการที่แก้
}
```

ไม่มี document = ใช้ค่าเริ่มต้น (ไม่ต้อง backfill/migrate) การเป็น "สมาชิก" ยังตัดสินจาก `db_namphrae.users` + `activeRegistryFilter` เดิมทุกประการ — `userAccess` เป็นชั้นสิทธิ์เพิ่มของ Portal เท่านั้น

## การบังคับใช้

1. **Pure function** `resolveAccess({ doc, clerkId, managerEnvId })` → `{ features, isManager }` — รวม logic: default set, env bootstrap, manager เห็นทุกฟีเจอร์ แยกไฟล์เพื่อตรึงด้วย unit test (แพทเทิร์นเดียวกับ `admin-registry-gate.ts`)
2. **`checkAdmin()`** (src/lib/auth-server.ts) ขยายให้ query `userAccess` เพิ่ม 1 ครั้ง คืน `AdminIdentity = { userId, email, features, isManager }` อ่านพลาด → 403 fail-closed เหมือน registry gate เดิม
3. **API guards ใหม่** ใน auth-server:
   - `requireFeature(req, res, feature)` — 403 `feature_denied` เมื่อไม่มีสิทธิ์
   - `requireManager(req, res)` — 403 `manager_only`
   - ทั้ง 25 route ใน `/api/admin/**` เปลี่ยนไปใช้ guard ที่ตรงกับฟีเจอร์ ยกเว้น `/api/admin/me` คง `requireAdmin` (สมาชิกทุกคนเรียกได้) และเพิ่ม `features`, `isManager` ใน response
4. **SSR guards ใหม่**: `getFeatureSsrProps(feature)` — สมาชิกแต่ไม่มีสิทธิ์ฟีเจอร์ → redirect ไปหน้าแรกที่มีสิทธิ์ (เรียงลำดับ: links → categories → calendar → map → data → settings) ถ้าไม่มีสิทธิ์เลย → render การ์ด "ยังไม่ได้รับสิทธิ์ ติดต่อผู้จัดการ" (ผ่าน props ไม่ใช่ redirect loop) หน้า `/admin/users` ใช้ `getManagerSsrProps`
5. **Sidebar** (AdminLayout): กรองเมนูตาม `features`/`isManager` ที่ส่งลงมาทาง SSR props
6. **dev-open mode** (ไม่มี Clerk keys): ทุกอย่างเปิดเหมือนเดิม — features ครบ + isManager = true
7. **Middleware (proxy.ts)**: ไม่เปลี่ยน — ยังคุมแค่ signed-in ระดับ route กลุ่ม `/admin(.*)`

## UI ผู้จัดการ

ในหน้า `/admin/users` แต่ละแถวสมาชิก (ที่ active) เพิ่มส่วน "สิทธิ์การเข้าถึง":

- checkbox 6 ฟีเจอร์ + toggle "ผู้จัดการ"
- ติ๊กผู้จัดการ → checkbox ฟีเจอร์ disabled (เห็นหมดโดยนิยาม)
- บันทึกผ่าน API ใหม่ `PATCH /api/admin/users/[id]/access` body `{ features?, isManager? }` (zod validate key แปลก → 400) guard ด้วย `requireManager` + stamp `updatedBy`
- แถวของ env manager: toggle ผู้จัดการ disabled พร้อมคำอธิบาย

สมาชิกที่ไม่ใช่ผู้จัดการ: เมนูสมาชิกหาย + SSR redirect + API 403

## ผลกระทบตอน deploy

- สมาชิกเดิมทุกคนเสียสิทธิ์ links/categories/map/settings ทันที จนกว่าผู้จัดการเปิดให้รายคน (ตั้งใจ — ผู้ใช้เลือก default = calendar + data)
- ต้องตั้ง `PORTAL_MANAGER_CLERK_ID` ใน Railway ก่อน deploy ไม่งั้นไม่มีผู้จัดการและไม่มีใครเข้าหน้า `/admin/users` ได้

## การทดสอบ

- Unit: `resolveAccess` — ไม่มี doc → default, env id → manager เสมอ, manager → features ครบ, doc ปกติ → ตาม doc
- Unit: schema PATCH access — reject feature key ที่ไม่รู้จัก, reject การถอด manager ตัวเอง/env manager (logic ใน handler + test)
- Mapping test: ทุกไฟล์ใน `src/pages/api/admin/**` ต้องเรียก guard ตัวใดตัวหนึ่ง (requireFeature/requireManager/requireAdmin ที่อนุญาตเฉพาะ me) — กัน route หลุด
- คง test เดิมทั้งหมดให้ผ่าน
