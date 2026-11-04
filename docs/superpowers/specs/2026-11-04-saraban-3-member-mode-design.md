# ระบบสารบรรณรอบ 3 — ผูกคนเข้าตำแหน่ง · โหมดเจ้าหน้าที่ · เจ้าตัวกดเอง

**วันที่:** 2026-11-04
**สเปกแม่:** [2026-09-13-saraban-design.md](2026-09-13-saraban-design.md) ข้อ 1.2–1.4, 2 (สิทธิ์), 9–10 (รอบ 3)
**ต้นแบบ:** [design_handoff_esaraban/README.md](../../design_handoff_esaraban/README.md) "โหมดเจ้าหน้าที่" จอ A งานของฉัน · จอ B หน้าหนังสือ
**พึ่ง:** รอบ 2 ([2026-11-03-saraban-2-annotate-design.md](2026-11-03-saraban-2-annotate-design.md)) — branch `feat/saraban-2` / PR #9

---

## คำถามตั้งต้น

> "ฉันลองทดสอบแล้วแต่ เป็นการดำเนินการเพียงคนเดียว" → "ดำเนินการรอบ 3 ต่อ"

รอบ 2 ให้ธุรการบันทึกแทนทุกตำแหน่ง ตำแหน่งยังไม่ผูกกับคน รอบนี้ให้ **ผู้ถือตำแหน่งล็อกอินแล้วทำเอง**
— เห็นงานของตำแหน่งตัวเอง เกษียน/ส่งต่อ/แจ้งเวียน/ทราบได้จากมือถือ

---

## 1. การตัดสินใจที่ตกลงแล้ว

1. **ลงรับในโหมดเจ้าหน้าที่ = เฉพาะผู้มีสิทธิ์ `saraban`** — การลงรับออกเลขทะเบียนราชการที่ย้อนไม่ได้
   คนที่ผูกตำแหน่งอย่างเดียวไม่เห็นปุ่ม ปุ่มพาไป `/saraban/receive` เดิม (ไม่ทำฟอร์มมือถือแยกรอบนี้)
2. **เจ้าหน้าที่เห็นเรื่องที่ตำแหน่งตัวเองเคยเกี่ยว** — ถืออยู่ตอนนี้ · เคยเกษียน/ส่งต่อในนามตำแหน่งนี้ ·
   ถูกแจ้งเวียนถึง — ครบ 3 แท็บตามต้นแบบ
3. **API แยกใต้ `/api/admin/saraban/me/*` (แนวทาง A)** — route ใหม่ทุกตัวใช้ `requireSarabanMember`
   และกรองตั้งแต่ query · route โหมดเต็มไม่แตะ · transition ใช้ `annotateTransition`/`ackTransition`
   ของรอบ 2 ตัวเดิม ไม่เขียนกฎซ้ำ
4. **ผูกคน = ผู้จัดการเท่านั้น** (สเปกแม่ข้อ 2) — ผูกคนเท่ากับให้สิทธิ์เห็นหนังสือของตำแหน่งนั้น
   ธุรการยังแก้ชื่อ/สังกัด/รหัสตำแหน่งได้เหมือนเดิม
5. **ไม่เปลี่ยนรูปข้อมูล event** — เจ้าตัวกดเอง = `by` คือคนกด และ `onBehalfUnitId` คือตำแหน่งของเขา
   (รอบ 2 ข้อ 1 เตรียมไว้แล้ว) ธุรการในโหมดเต็มยังบันทึกแทนได้
6. **คนที่ผูกตำแหน่งแต่ไม่มีฟีเจอร์ใดเลยยังต้องเป็นสมาชิก active ในทะเบียน** — ผ่าน `checkAdmin` ก่อนเสมอ
   การผูกตำแหน่งไม่ใช่ทางลัดข้ามทะเบียน

---

## 2. สิทธิ์และการผูกตำแหน่ง

### ข้อมูล

ใช้ `SarabanUnit.memberClerkIds: string[]` ที่มีอยู่ (รอบ 1 สร้างเป็น `[]`) — ไม่มี collection ใหม่

- คนหนึ่งผูกได้หลายตำแหน่ง · ตำแหน่งหนึ่งผูกได้หลายคน (รักษาราชการแทน) — สูงสุด 10 คนต่อตำแหน่ง
- ตำแหน่งที่ `isActive: false` ไม่นับ — คนที่ผูกไว้กับตำแหน่งที่ปิดใช้ไม่ผ่าน guard ด้วยตำแหน่งนั้น
- ถอดคนออก = หนังสือยังอยู่กับตำแหน่ง คนนั้นแค่เปิดไม่ได้อีก (หนังสืออยู่กับตำแหน่ง ไม่ใช่คน — สเปกแม่ 1.2)
- store: `memberUnitIds(clerkId)` คืน id ของตำแหน่งที่เปิดใช้และมีคนนี้ · Mongo ใช้ index
  `{ memberClerkIds: 1 }` · `setUnitMembers(unitId, clerkIds)`

### Guard `requireSarabanMember(req, res)`

```ts
type SarabanMember = { admin: AdminIdentity; unitIds: string[]; canReceive: boolean };
```

1. `requireAdmin` (สมาชิก active ในทะเบียน) — ไม่ผ่าน → 401/403 ตามเดิม
2. `memberUnitIds(admin.userId)` ว่าง → `403 not_member`
3. `canReceive = hasFeature(admin, 'saraban')`

**dev-open** (ไม่มี Clerk): ทุกคนคือ `dev-open` ซึ่งไม่ได้ผูกกับอะไร — guard อ่าน query `as=<unitId>`
แล้วถือว่าผูกกับตำแหน่งนั้นตำแหน่งเดียว (ต้องเป็นตำแหน่งที่เปิดใช้) ไม่มี `as` → `403 not_member`
หน้าจอส่ง `?as=` ของ URL หน้าต่อไปยังทุก API ใต้ `me/` · **ใช้ได้เฉพาะ dev-open** — ตั้ง Clerk แล้ว
`as` ถูกเพิกเฉยเสมอ (มีเทสต์ตรึง)

`api-guard-coverage.test.ts` รับ `requireSarabanMember(` เป็น guard · เทสต์ใหม่ตรึงว่าทุกไฟล์ใต้
`api/admin/saraban/me/` เรียก `requireSarabanMember` (ไม่ใช่ `requireFeature('saraban')` — คนละสิทธิ์)

### การเห็นและการทำ — `src/lib/saraban-member.ts` (บริสุทธิ์ client-safe มีเทสต์)

```ts
canSeeDoc(doc, unitIds): boolean
// holderUnitId ∈ unitIds  ||  circulation.some(c => unitIds.includes(c.unitId))
//   ||  events.some(e => e.onBehalfUnitId && unitIds.includes(e.onBehalfUnitId))

memberTab(doc, unitIds): 'todo' | 'forwarded' | 'done' | null
// null     = ไม่เกี่ยว หรือ void
// 'todo'   = (register 'in' && isOpen && holder ∈ mine) || มีแถวเวียนของฉันที่ ackAt ว่าง
// 'done'   = status 'done' (และเกี่ยว และไม่มีแถวเวียนของฉันค้าง)
// 'forwarded' = เกี่ยว ยังเปิด แต่ไม่เข้า todo

memberActions(doc, unitIds): { annotateAs: string | null; ackUnitIds: string[] }
// annotateAs = holderUnitId ถ้า canAnnotate(doc) && holder ∈ mine
// ackUnitIds = แถวเวียนของตำแหน่งฉันที่ยังไม่ทราบ (และ canAck(doc))
```

แถวเวียนค้างชนะสถานะ `done` — เรื่องที่จบแล้วแต่ฉันยังไม่กดทราบยังอยู่ใน "รอฉันทำ" (รอบ 2 ข้อ 5:
ทราบย้อนหลังได้)

### ทางเข้าและสวิตช์โหมด

- หน้า `/saraban/me*` ใช้ SSR guard ใหม่ `getSarabanMemberSsrProps`: ผ่านเมื่อมีสิทธิ์ `saraban`
  **หรือ** ผูกตำแหน่งอย่างน้อย 1 (คนมีสิทธิ์ `saraban` ที่ไม่ได้ผูกเข้าได้ เห็นจอว่างพร้อมข้อความ
  "ยังไม่ได้ผูกกับตำแหน่งใด" + ปุ่มกลับโหมดเต็ม — ใน dev-open คือหน้าเลือกตำแหน่ง `?as=`)
- `buildSsrGuard`: เมื่อ `firstAllowedPath` คืน `null` (ไม่มีฟีเจอร์ใดเลย) ให้เช็ค `memberUnitIds`
  ก่อนตัดสินเป็น forbidden — ผูกอยู่ → redirect `/saraban/me` · ทำเฉพาะกรณีนี้ จึงไม่เพิ่ม query
  ให้คำขอทั่วไป · `firstAllowedPath` (บริสุทธิ์) ไม่แก้
- หน้าโหมดเต็ม `/saraban/*` ที่คนไม่มีสิทธิ์ `saraban` เข้า → เด้งตามกฎเดิม ซึ่งตอนนี้จะถึง `/saraban/me`
  สำหรับคนที่ผูกตำแหน่งแต่ไม่มีฟีเจอร์อื่น
- สวิตช์ "โหมดเต็ม ⇄ งานของฉัน": header ของ shell โหมดเต็มแสดงปุ่ม "งานของฉัน" เมื่อผู้ใช้ผูกตำแหน่ง
  (ได้จาก `GET /me` แบบเงียบ — 403 = ซ่อนปุ่ม) · header โหมดเจ้าหน้าที่แสดง "โหมดเต็ม" เมื่อ `canReceive`
  · ไม่จำโหมดล่าสุด — ทางเข้าตัดสินจากสิทธิ์เสมอ (YAGNI)

---

## 3. API — ใต้ `/api/admin/saraban/me/`

| Route | ทำอะไร |
|---|---|
| `GET me/index.ts` | `{ units: {id,name}[], canReceive, counts: {todo, forwarded, done} }` |
| `GET me/docs/index.ts?tab=&page=` | `{ items: SarabanDoc[], page, total }` หน้าละ 20 เรียง `updatedAt` ใหม่ก่อน · `tab` ผิด → 400 `invalid_input` |
| `GET me/docs/[id]/index.ts` | `{ doc, actions: memberActions(...), units }` (units = สมุดตำแหน่งที่เปิดใช้ สำหรับชิปส่งต่อ/เวียน) · `!canSeeDoc` → **404 `not_found`** ไม่ใช่ 403 — ไม่บอกว่ามีเรื่องนี้ |
| `PATCH me/docs/[id]/index.ts` | `action: 'annotate'` (body รูปเดียวกับรอบ 2) · `action: 'ack', unitId` |
| `GET me/docs/[id]/files/[fileId].ts` | redirect ลิงก์ชั่วคราว — เงื่อนไขเห็นเดียวกับข้างบน · ไม่มี bucket → 503 `storage_not_configured` |

### PATCH

- โหลด doc → `!canSeeDoc` → 404
- `annotate`: `holderUnitId ∉ unitIds` → **`403 not_holder`** · ไม่รับ `onBehalfUnitId` จาก client —
  `annotateTransition` ตั้งเป็น holder อยู่แล้ว · จากนั้นเหมือนรอบ 2 ทุกอย่าง (`applyPatch` ด้วย
  `updatedAt` → 409 `stale` · error ของ flow ตาม `FLOW_ERROR_STATUS`)
- `ack`: `unitId ∉ unitIds` → **`403 not_holder`** · จากนั้น `ackTransition`
- schema: ใช้ `docPatchSchema` ของรอบ 2 แล้ว narrow ให้รับเฉพาะ `annotate | ack` (`edit`/`void`/`sent`/
  ไฟล์ → 400 `invalid_input`)

### Store

- `listMemberDocs(unitIds, tab, page)` — Mongo: query หยาบ (`$or` ของ holder / `circulation.unitId` /
  `events.onBehalfUnitId`, ไม่เอา void) แล้วกรอง `memberTab` ใน memory · ไฟล์: กรองด้วย `memberTab` ตรง ๆ
  · ผู้ใช้หลักสิบ หนังสือหลักพันต่อปี ตำแหน่งหนึ่งเกี่ยวหลักร้อย — กรองใน memory พอ (บันทึกเพดานไว้ใน
  คอมเมนต์ เปลี่ยนเป็น aggregate เมื่อเกินหลักพันต่อตำแหน่ง)
- `countMemberDocs(unitIds)` ใช้ชุดเดียวกัน — ตรรกะแท็บอยู่ที่ `memberTab` ที่เดียว สองแบ็กเอนด์ได้ผลเท่ากันโดยโครงสร้าง
- index ใหม่: `{ holderUnitId: 1 }` · `{ 'circulation.unitId': 1 }` · `{ 'events.onBehalfUnitId': 1 }`

### ผูกคน — `PUT /api/admin/saraban/units/[id]/members.ts`

- `requireManager` · body `{ clerkIds: string[] }` (≤ 10, ไม่ซ้ำ — zod refine) → ผิด → 400 `invalid_input`
- ทุก id ต้องเป็นสมาชิก active ในทะเบียน (`activeRegistryFilter`) — ไม่ครบ → 400 `invalid_member`
- ไม่มีทะเบียน (dev / file backend): ข้ามการตรวจทะเบียน (แนวเดียวกับ `allowAdminWithoutRegistry`)
- ตอบ unit ที่อัปเดตแล้ว

---

## 4. หน้าจอ

### `/saraban/me` — งานของฉัน (ต้นแบบ A)

- คอนเทนเนอร์ max-w 720px กึ่งกลาง ไม่มี sidebar · header sticky ขาว: โลโก้ · "งานของฉัน" + ชื่อ ·
  ชื่อตำแหน่ง (หลายตำแหน่งคั่นด้วย ·) · ปุ่ม "โหมดเต็ม" (เมื่อ `canReceive`)
- แท็บนับ 3 ปุ่ม: **รอฉันทำ / ส่งต่อแล้ว / จบเรื่อง** ตัวเลข 22px · แท็บเก็บใน query `?tab=`
- การ์ดหนังสือ radius 16: รับที่ · วันที่ · ชั้นความเร็ว · ป้ายสถานะ · เรื่อง 15/600 · จาก
  - แท็บ "รอฉันทำ" มีปุ่ม 44px ตาม `memberActions`:
    - ถือหนังสือ → **ทราบ · จบเรื่อง** (outline เขียว — `annotate` route `close` note "ทราบ" ทำทันที
      แล้ว toast) และ **สั่งการ / ส่งต่อ** (accent — เปิดหน้าหนังสือ)
    - เวียนถึงอย่างเดียว → **ทราบ** (`ack` ทำทันที)
  - แตะการ์ด = เปิดหน้าหนังสือ
- empty state ต่อแท็บ · ล่าง: "+ ลงรับหนังสือใหม่" 52px (เมื่อ `canReceive`) → `/saraban/receive`
- "โหลดเพิ่ม" เมื่อ `items.length < total`

### `/saraban/me/doc/[id]` — หน้าหนังสือ (ต้นแบบ B)

- การ์ดข้อมูล (ที่ · เรื่อง · จาก · ชั้นความเร็ว · กำหนดแล้วเสร็จ · อยู่กับ) + ไฟล์แนบ แตะเปิดแท็บใหม่ผ่าน
  `me/docs/[id]/files/[fileId]`
- การ์ด "ที่ผ่านมา": ไทม์ไลน์ย่อ ใช้ `EventDetail`/`eventByline` ของรอบ 2
- การ์ดดำเนินการ (เมื่อ `annotateAs`):
  1. **ต้องการทำอะไร** 3 ปุ่ม 48px — ทราบ·จบเรื่อง (route `close`) · ส่งต่อ/สั่งการ (route `forward`) ·
     แจ้งเวียน (route `stay` + `circulateTo` ≥ 1)
  2. **ส่งถึงใคร** (ซ่อนเมื่อ "ทราบ·จบเรื่อง") ชิป pill 40px — ส่งต่อเลือก 1 (ไม่รวม holder) · แจ้งเวียน
     เลือกหลาย (≤ `MAX_CIRCULATE`) · ไม่มี "เพิ่มคนใหม่" (รอบ 2 ข้อ 7)
  3. **ข้อความ** ชิป `QUICK_NOTES` + textarea 2 แถว (≤ 1000)
  - กล่องสรุปสิ่งที่จะเกิด ("ส่งถึง กองช่าง · แจ้งเวียน 2 ตำแหน่ง")
- เวียนถึงอย่างเดียว (`ackUnitIds` ไม่ว่าง ไม่มี `annotateAs`) → การ์ดมีปุ่ม "ทราบ" ปุ่มเดียว
- ไม่มีทั้งสอง → ไม่มีการ์ดดำเนินการ (ดูอย่างเดียว)
- bottom bar sticky blur: ปุ่มยืนยันเขียว 52px ข้อความตามแอ็กชัน · สำเร็จ → กลับ `/saraban/me` + toast
- error: `not_holder`/`stale` → ข้อความ + revalidate doc (การ์ดดำเนินการหายเองถ้าหนังสือไปแล้ว)

### `/saraban/units` — ผูกคน

- คอลัมน์ "ผู้ถือตำแหน่ง" ชิปชื่อ (ชื่อจากรายชื่อสมาชิก · ไม่พบชื่อ → แสดง clerkId ย่อ)
- ปุ่ม "ผูกคน" เฉพาะผู้จัดการ (`isManager` จาก `/api/admin/me`) → แผงค้นหา + ติ๊กเลือกจาก
  `GET /api/admin/users` (มี `requireManager` อยู่แล้ว) → `PUT units/[id]/members`
- ไม่ใช่ผู้จัดการ: เห็นชิปอย่างเดียว

### a11y และสัดส่วน

- ปุ่มทุกปุ่ม ≥ 44px · ปุ่มยืนยันหลัก 52px · ชิปเลือกใช้ `aria-pressed` · แท็บใช้ `role="tablist"`
- โทเคน `--color-sb-*` ชุดเดิม · ไอคอนจาก `ICON_NAMES` (เพิ่มชื่อใหม่ในไฟล์นั้นถ้าต้องใช้)

---

## 5. ข้อผิดพลาด

| รหัส | เมื่อไหร่ | ข้อความ (`ERROR_MESSAGES`) |
|---|---|---|
| `403 not_member` | ไม่ได้ผูกตำแหน่งที่เปิดใช้เลย | ยังไม่ได้ผูกกับตำแหน่งใด ติดต่อผู้ดูแลระบบ |
| `404 not_found` | เปิดหนังสือที่ตำแหน่งตัวเองไม่เคยเกี่ยว | (เดิม) ไม่พบหนังสือ |
| `403 not_holder` | เกษียนเรื่องที่ไม่ได้อยู่กับตำแหน่งตัวเองแล้ว · ทราบแทนตำแหน่งอื่น | หนังสือนี้ไม่ได้อยู่กับตำแหน่งของคุณแล้ว |
| `400 invalid_member` | ผูกคนที่ไม่อยู่ในทะเบียน | มีรายชื่อที่ไม่ใช่สมาชิกในระบบ |
| รอบ 2 ทั้งหมด | `stale` · `same_holder` · `already_circulated` · `already_acknowledged` · `invalid_transition` · `invalid_unit` | (เดิม) |

---

## 6. ไฟล์

### เพิ่ม

```
src/lib/saraban-member.ts                         canSeeDoc · memberTab · memberActions (บริสุทธิ์)
src/lib/saraban-member.test.ts
src/lib/saraban-member-guard.ts                    requireSarabanMember · getSarabanMemberSsrProps (SERVER ONLY)
src/lib/saraban-member-guard.test.ts               dev-open `as` · Clerk เพิกเฉย `as` · not_member
src/pages/api/admin/saraban/me/index.ts
src/pages/api/admin/saraban/me/docs/index.ts
src/pages/api/admin/saraban/me/docs/[id]/index.ts
src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts
src/pages/api/admin/saraban/units/[id]/members.ts
src/pages/saraban/me/index.tsx
src/pages/saraban/me/doc/[id].tsx
src/components/saraban/MemberShell.tsx             header 720px + bottom bar
src/components/saraban/MemberDocCard.tsx
src/components/saraban/MemberActionForm.tsx
src/components/saraban/UnitMembersPanel.tsx
```

### แก้

| ไฟล์ | แก้อะไร |
|---|---|
| `src/lib/saraban-units-store.ts` | `memberUnitIds` · `setUnitMembers` · index `memberClerkIds` |
| `src/lib/saraban-store.ts` | `listMemberDocs` · `countMemberDocs` · index 3 ตัว |
| `src/lib/saraban-schema.ts` | `memberPatchSchema` (annotate/ack) · `unitMembersSchema` · `memberDocsQuerySchema` |
| `src/lib/saraban-view.ts` | ข้อความ error ใหม่ · `memberDocsKey` (ต่อ `as` เมื่อมี) |
| `src/lib/saraban-api.ts` | ตัวเรียก `me/*` และ `setUnitMembers` |
| `src/lib/auth-server.ts` | `buildSsrGuard` ไม่มีฟีเจอร์ → เช็คผูกตำแหน่ง → `/saraban/me` |
| `src/lib/api-guard-coverage.test.ts` | รับ `requireSarabanMember(` + เทสต์ `me/` ทุกไฟล์ใช้ guard นี้ |
| `src/pages/saraban/units.tsx` | คอลัมน์ผู้ถือตำแหน่ง + ปุ่มผูกคน |
| `src/components/saraban/SarabanLayout.tsx` | ปุ่ม "งานของฉัน" เมื่อผูกตำแหน่ง |

---

## 7. การทดสอบ

- **`saraban-member.test.ts`** — `canSeeDoc`/`memberTab`/`memberActions` ทุกกรณี: ถือ · เวียนค้าง ·
  เวียนทราบแล้ว · ส่งต่อไปแล้ว · จบเรื่อง · จบเรื่องแต่เวียนค้าง (→ todo) · void · ไม่เกี่ยว ·
  หลายตำแหน่ง · หนังสือส่ง/เวียน (ไม่มี annotate) · input ถูก freeze ไม่ถูกแก้
- **guard** — dev-open + `as` ถูก → ผ่าน · `as` ตำแหน่งปิดใช้/ไม่มี → 403 · Clerk on + `as` → เพิกเฉย ·
  ไม่ผูก → `not_member` · `canReceive` ตามสิทธิ์
- **schema** — `memberPatchSchema` ปฏิเสธ `edit`/`void` · `unitMembersSchema` ซ้ำ/เกิน 10
- **guard coverage** — ไฟล์ใต้ `me/` ทุกไฟล์มี `requireSarabanMember(` · `members.ts` มี `requireManager(`
- **store** — `listMemberDocs` บนแบ็กเอนด์ไฟล์: แท็บ · แบ่งหน้า · ไม่รั่วเรื่องของตำแหน่งอื่น
- **smoke บน dev server (dev-open)** ด้วย `?as=`:
  ธุรการลงรับ → ปลัด (`as=ปลัด`) เห็นใน "รอฉันทำ" → ส่งต่อกองช่าง + เวียนกองคลัง → ปลัดเห็นใน
  "ส่งต่อแล้ว" · กองช่างเห็นใน "รอฉันทำ" · กองคลังกด "ทราบ" · ตำแหน่งที่ไม่เกี่ยวเปิด → 404 ·
  ปลัดเกษียนซ้ำ → 403 `not_holder` · ไทม์ไลน์แสดงตำแหน่ง (ไม่มี "บันทึกโดย" ต่างคน — dev-open
  เป็นคนเดียว แต่บน Clerk จะแสดงชื่อคนกด)

---

## 8. ไม่รวมในรอบนี้

- ฟอร์มลงรับบนมือถือ (ต้นแบบ C) · ถ่ายรูป/สแกน · OCR
- ตัวเลข "ประหยัดกระดาษ" · แจ้งเตือน LINE/อีเมล → รอบ 6
- บรรทัด "ลงนามดิจิทัล + ประทับเวลา" · ปากกา/ตรา → รอบ 4
- "+ เพิ่มคนใหม่" ในชิปผู้รับ (รอบ 2 ข้อ 7)
- จำโหมดล่าสุดของผู้ใช้
