# ระบบสารบรรณรอบ 2 — เกษียน · ส่งต่อ · แจ้งเวียนภายใน · ติดตามเต็ม

**วันที่:** 2026-11-03
**สเปกแม่:** [2026-09-13-saraban-design.md](2026-09-13-saraban-design.md) ข้อ 9–10 (รอบ 2)
**ต้นแบบ:** [design_handoff_esaraban/README.md](../../design_handoff_esaraban/README.md) จอ 5 "เกษียนหนังสือ" · จอ 6 "ติดตามสถานะ"
**พึ่ง:** รอบ 1 (1a ชั้นข้อมูล · 1b API · 1c หน้าจอ) ที่ merge แล้ว

---

## คำถามตั้งต้น

> "ดำเนินการรอบ 2 ต่อเลย"

รอบ 1 ลงรับได้ ออกเลขได้ แต่หนังสือรับค้างที่ "รอเกษียน" ตลอดไป — ไม่มีทางให้หนังสือเดินจากปลัดไป
กองที่รับผิดชอบ และไม่มีทางจบเรื่อง รอบนี้ทำให้หนังสือ **เดินได้** ตามเส้นทางจริงของเทศบาล

---

## 1. การตัดสินใจที่ตกลงแล้ว

1. **ธุรการบันทึกแทน** — ผู้บริหารยังเกษียนบนกระดาษ ธุรการ (สิทธิ์ `saraban`) พิมพ์คำสั่งลงระบบใน
   นามตำแหน่งที่หนังสืออยู่ ประวัติเก็บทั้ง "ใครบันทึก" (`by`/`byName`) และ "ตำแหน่งผู้สั่ง"
   (`onBehalfUnitId`/`onBehalfName`) รอบ 3 ที่ผูกคนเข้าตำแหน่งแล้วจะให้เจ้าตัวกดเองบนโครงเดียวกัน
   — คนกดเองคือกรณีที่ `by` เป็นคนที่ผูกกับ `onBehalfUnitId` ไม่ต้องเปลี่ยนรูปข้อมูล
2. **แจ้งเวียนภายใน ธุรการติ๊ก "ทราบ" แทน** — เมื่อกระดาษเวียนกลับมาครบลายเซ็น รอบ 3 เปิดให้เจ้าตัวกด
3. **เกษียนได้เฉพาะหนังสือรับ** — หนังสือส่ง/เวียนยังใช้วงจร "รอส่ง → ส่งแล้ว" ของรอบ 1
4. **`done` เปิดกลับไม่ได้** — ทะเบียนราชการ บันทึกพลาดก่อนจบให้เกษียนแก้ หลังจบไม่มีทางย้อน
5. **การเวียนไม่ขวางการจบเรื่อง** — ติ๊กทราบย้อนหลังได้แม้เรื่องจบแล้ว
6. **หน้าเกษียนแยก `/saraban/annotate/[id]`** ตามต้นแบบ — ช่อง "เอกสาร" ด้านซ้ายเป็นที่ที่รอบ 4
   วางปากกา/ตรา ไม่ต้องรื้อหน้าติดตาม
7. **ไม่ทำ "+ เพิ่มผู้รับที่ยังไม่ลงทะเบียน" แบบ inline** — เบี่ยงจากต้นแบบและจากสเปกแม่ข้อ 10 โดยตั้งใจ
   ให้ฟอร์มเกษียนสั้น คนที่ต้องเพิ่มตำแหน่งไปที่ `/saraban/units` (สิทธิ์เดียวกัน)
8. **ข้อความสำเร็จรูปเป็นค่าคงที่ในโค้ด** — ยังไม่มีหน้าตั้งค่า

---

## 2. โครงโดเมน

### ไฟล์ที่เพิ่ม

```
src/lib/saraban-flow.ts                 state machine การเกษียน (บริสุทธิ์) แบบ job-status.ts:
                                        canAnnotate · annotateTransition · ackTransition · flowStep
src/lib/saraban-flow.test.ts
src/pages/saraban/annotate/[id].tsx     หน้าเกษียน
src/components/saraban/FlowSteps.tsx    แถบ 5 ขั้น
src/components/saraban/AnnotateForm.tsx ฟอร์มสั่งการ (ชิป · textarea · ปลายทาง · เวียน · สรุป)
src/components/saraban/CirculationCard.tsx  การ์ดแจ้งเวียน + ปุ่มทราบ
```

### ไฟล์ที่แก้

```
src/types/saraban.ts         event kind 'annotated' · 'acknowledged' · ฟิลด์ใหม่ของ event · SarabanCirculation · doc.circulation
src/lib/saraban-schema.ts    docPatchSchema เพิ่ม action 'annotate' · 'ack'
src/lib/saraban-doc.ts       buildNewDoc เขียน circulation: [] · normalize เอกสารเก่าที่ไม่มีคีย์
src/lib/saraban-labels.ts    ป้าย event ใหม่ · ข้อความสำเร็จรูป · ป้ายขั้น 5 ขั้น
src/lib/saraban-api.ts       annotateDoc · ackCirculation
src/pages/api/admin/saraban/docs/[id]/index.ts   รับ action ใหม่
src/pages/saraban/track/[id].tsx                 แถบ 5 ขั้น · รายการหนังสือซ้าย · การ์ดเวียน · ปุ่มเกษียน
src/pages/saraban/inbox.tsx                      ปุ่ม "เกษียน" · คอลัมน์ "อยู่กับ"
```

### สิทธิ์

ไม่มี guard ใหม่ — ทุกอย่างผ่าน `requireFeature(req, res, 'saraban')` ที่ route เดิม เทสต์ guard ไม่ต้องแก้

---

## 3. โมเดลข้อมูล

```ts
// ต่อท้าย SARABAN_EVENT_KINDS
'annotated',     // เกษียน/สั่งการ
'acknowledged',  // ติ๊กทราบแทนตำแหน่งที่ถูกเวียน

type AnnotateRoute =
  | { kind: 'forward'; toUnitId: string }   // ส่งต่อ — เปลี่ยน holderUnitId
  | { kind: 'close' }                       // ส่งคืนสารบรรณ (จบเรื่อง)
  | { kind: 'stay' };                       // คงไว้ที่เดิม (เวียนอย่างเดียว / บันทึกความคืบหน้า)

type SarabanEvent = {
  // …ฟิลด์เดิมของรอบ 1…
  // ทุกตัวด้านล่าง optional แบบเดียวกับ changes — makeEvent ใส่เฉพาะเมื่อมีค่า
  onBehalfUnitId?: string;   // annotated: ตำแหน่งที่สั่ง = holderUnitId ณ ตอนบันทึก
  onBehalfName?: string;     //            ชื่อตำแหน่ง ณ ตอนนั้น
  route?: 'forward' | 'close' | 'stay';
  toUnitId?: string;         // forward
  toUnitName?: string;
  circulateTo?: { unitId: string; unitName: string }[];  // annotated ที่มีการเวียน
  unitId?: string;           // acknowledged: ตำแหน่งที่ทราบ
  unitName?: string;
};

type SarabanCirculation = {
  unitId: string;
  unitName: string;    // ณ เวลาที่เวียน
  sentAt: string;      // ISO
  sentEventId: string; // event annotated ที่เวียน
  ackAt: string;       // '' = ยังไม่ทราบ
  ackBy: string;       // clerkId · '' ถ้ายังไม่ทราบ
  ackByName: string;
};

type SarabanDoc = {
  // …ฟิลด์เดิม…
  circulation: SarabanCirculation[];
};
```

- **ชื่อเก็บ ณ เวลาที่ทำ** — หลักเดียวกับ `byName` (สเปกแม่ข้อ 3) ตำแหน่งถูกเปลี่ยนชื่อในสมุดภายหลัง
  ประวัติต้องไม่เปลี่ยนตาม
- **เอกสารเก่าไม่มี `circulation`** — store อ่านแล้ว normalize เป็น `[]` ไม่ต้อง migrate · `buildNewDoc`
  เขียน `[]` เสมอ (เหตุผลเดียวกับคีย์อื่นใน `buildNewDoc`)
- **ตำแหน่งหนึ่งอยู่ใน `circulation` ได้ครั้งเดียว** — เวียนซ้ำตำแหน่งเดิมปฏิเสธ

### state machine (`saraban-flow.ts`)

```
pending ──annotate(forward | stay)──▶ in-progress ──annotate(forward | stay)──▶ in-progress
   │                                       │
   └────────annotate(close)────────────────┴──▶ done
pending / in-progress ──void (รอบ 1)──▶ void
```

| ฟังก์ชัน | กฎ |
|---|---|
| `canAnnotate(doc)` | `register === 'in'` และ `status` เป็น `pending` / `in-progress` |
| `annotateTransition(doc, input, units)` | **`note` บังคับเสมอ** (ต้นแบบ: "ต้องมีข้อความ") — `stay` ที่ไม่มีเวียนจึงเป็น "บันทึกความคืบหน้า" ที่ถูกต้อง · forward: ปลายทาง active ในสมุด และ ≠ `holderUnitId` · เวียน: ทุกตำแหน่ง active และยังไม่อยู่ใน `circulation` · ไม่ซ้ำกันเอง · ≤ 30 ตำแหน่ง · คืน `{ set, event fields }` หรือรหัสข้อผิดพลาด |
| `ackTransition(doc, unitId)` | ตำแหน่งอยู่ใน `circulation` และ `ackAt === ''` · ได้ทุกสถานะยกเว้น `void` (ข้อ 1.5) |
| `flowStep(doc)` | คำนวณขั้นปัจจุบัน 1–5 จาก events (ไม่เก็บ): ไม่มี annotated → 2 · forward 1 ครั้ง → 3 · forward ≥ 2 → 4 · `done` → 5 · `void` → `null` (ไม่แสดงแถบ) |

- `stay` บน `pending` → `in-progress` (เริ่มสั่งการแล้ว) · `stay` บน `in-progress` คงเดิม
- `close` เคลียร์อะไรไม่ได้ — `holderUnitId` คงค่าสุดท้าย (= ตำแหน่งที่ส่งคืนสารบรรณ) เพื่อให้รู้ว่าจบที่ใคร
- กฎ edit ของรอบ 1 (`holderUnitId` แก้ได้เฉพาะ `pending`) คงไว้ — เป็นการ **แก้ที่ลงรับผิด** ก่อนเกษียน
  ไม่ใช่การส่งต่อ และไม่นับเป็นขั้นในแถบ

---

## 4. API — `PATCH /api/admin/saraban/docs/[id]`

ต่อ discriminated union เดิม (สเปกแม่ข้อ 6 "กฎการแก้ไข") ไม่สร้าง route ใหม่

| `action` | body | ผล | event |
|---|---|---|---|
| `annotate` | `updatedAt` · `note` (1–1000) · `route` · `circulateTo: string[]` (0–30) | ตาม `annotateTransition` · เวียน = ต่อท้าย `circulation` | `annotated` |
| `ack` | `updatedAt` · `unitId` | เขียน `ackAt`/`ackBy`/`ackByName` ของแถวนั้น | `acknowledged` (`note` = '') |

- `circulation` เขียนทั้งอาเรย์ใน `set` เดียวกับ event — ปลอดภัยเพราะ `applyPatch` เช็ค `updatedAt`
  อยู่แล้ว สองคนกดพร้อมกัน คนที่สองได้ `409 stale` แล้วหน้าจอโหลดใหม่ (พฤติกรรมเดียวกับรอบ 1)
- ชื่อตำแหน่ง (`onBehalfName` / `toUnitName` / `unitName`) เซิร์ฟเวอร์เติมจากสมุด ไม่เชื่อจาก client

---

## 5. หน้าจอ

### `/saraban/annotate/[id]` — ใหม่

- **หัว:** ‹ กลับทะเบียน · "รับที่ 0422 · เรื่อง" 18/700 · ป้ายสถานะ · "อยู่กับ: ปลัดเทศบาล" · ลิงก์ "ติดตาม"
- **grid** `repeat(auto-fit, minmax(min(100%, 480px), 1fr))` ตามต้นแบบ
- **ซ้าย "เอกสาร":** รายการไฟล์แนบ · ไฟล์ที่เลือก (ค่าเริ่มต้นไฟล์แรก) แสดงตัวอย่างจากลิงก์ชั่วคราวเดิม
  PDF → `<iframe>` · รูป → `<img>` · ไม่มีไฟล์ → "หนังสือนี้ไม่มีไฟล์แนบ" · **ไม่มี toolbar ปากกา/ตรา**
  (รอบ 4)
- **ขวา "บันทึกเกษียน/สั่งการ":**
  - ไทม์ไลน์ event `annotated` (avatar อักษรย่อตำแหน่ง 30px · "ปลัดเทศบาล · บันทึกโดย สมศรี" · เวลา ·
    bubble `#F8FAFC` · บรรทัด "→ ผอ.กองช่าง" / "→ จบเรื่อง" / "เวียน: …")
  - ฟอร์ม (`AnnotateForm`): ชิปข้อความสำเร็จรูป (กดแล้วแทรกลง textarea) → textarea → select
    **ส่งต่อถึง** (ตำแหน่ง active เรียงตาม `order` ยกเว้นที่หนังสืออยู่ · "คงไว้ที่เดิม" · "ส่งคืนสารบรรณ
    (จบเรื่อง)") → ☐ **แจ้งเวียน** ติ๊กแล้วกางกริด checkbox `minmax(200px, 1fr)` (ชื่อ / สังกัด) ·
    ตำแหน่งที่เวียนไปแล้วแสดงติ๊กไว้และกดไม่ได้ · ลิงก์ เลือกทั้งหมด / ล้าง
  - **กล่องสรุป** ก่อนกด: "หนังสือจะไปอยู่ที่ ผอ.กองช่าง · เวียนให้ทราบ 2 ตำแหน่ง" / "จะจบเรื่อง
    และส่งคืนสารบรรณ" — กด "จบเรื่อง" ต้องยืนยันอีกครั้งเพราะเปิดกลับไม่ได้
  - ปุ่ม **บันทึกและส่งต่อ** (ป้ายเปลี่ยนตามปลายทาง: บันทึก / บันทึกและส่งต่อ / บันทึกและจบเรื่อง)
- **หลังบันทึก:** forward / close → `/saraban/inbox` + toast "รับที่ 0422 ส่งต่อ ผอ.กองช่าง แล้ว" ·
  stay → อยู่หน้าเดิม รีเฟรชไทม์ไลน์ + toast
- หนังสือที่ `canAnnotate` เป็นเท็จ (ส่ง/เวียน · จบแล้ว · ยกเลิก) → แสดงไทม์ไลน์อย่างเดียว ซ่อนฟอร์ม
  พร้อมข้อความเหตุผล

### `/saraban/track/[id]` — ฉบับเต็ม

- **grid 1fr / 1.6fr** ตามต้นแบบ · จอแคบกว่า `lg` ซ่อนคอลัมน์ซ้าย
- **ซ้าย:** หนังสือรับที่ยังเปิดอยู่ (ทุกปีงบ เรียงเลขมากไปน้อย 50 เรื่องแรก) · active bg `#E8EFF8`
  ขอบ accent · คลิกเปลี่ยน URL ไปเรื่องนั้น
- **ขวา:** การ์ดหัวเดิม + **`FlowSteps`** (ลงรับ → เสนอ/เกษียน → มอบหมาย → ดำเนินการ → จบเรื่อง ·
  ผ่านแล้วเขียว · ปัจจุบัน accent หรือแดงถ้าเกินกำหนด · ที่เหลือ `#E3E8EF`) — เฉพาะหนังสือรับที่ไม่ใช่
  `void`
- **`CirculationCard`:** แสดงเมื่อ `circulation.length > 0` · "ทราบแล้ว 2/5" · แถว: ตำแหน่ง · เวียนเมื่อ ·
  ทราบเมื่อ/โดย หรือปุ่ม "ทราบ" (ไม่แสดงเมื่อ `void`)
- **ไทม์ไลน์เดิม** เพิ่มรูปแบบของ `annotated` / `acknowledged`
- **ปุ่ม "เกษียน"** → `/saraban/annotate/[id]` เมื่อ `canAnnotate`

### ทะเบียนรับ `/saraban/inbox`

- ปุ่มท้ายแถว **"เกษียน"** (bg `#E8EFF8` ตามต้นแบบ) ข้าง "ติดตาม" เฉพาะเรื่องที่ `canAnnotate`
- คอลัมน์ใหม่ **"อยู่กับ"** (ชื่อตำแหน่งจากสมุด) หลังคอลัมน์เรื่อง
- ไม่เพิ่มเมนู "ติดตาม" ใน sidebar — หน้าติดตามต้องมี id เสมอ เข้าจากทะเบียนหรือหน้าเกษียน

---

## 6. ข้อผิดพลาด

ต่อจากตารางสเปกแม่ข้อ 8

| สถานการณ์ | ตอบ |
|---|---|
| body ไม่ผ่าน zod (note ว่าง / ยาวเกิน · เวียนเกิน 30) | `400 invalid_input` + `issues` |
| เกษียนหนังสือส่ง/เวียน · เรื่องจบแล้ว · ยกเลิกแล้ว | `409 invalid_transition` |
| ปลายทาง / ตำแหน่งที่เวียน ไม่มีหรือปิดอยู่ | `400 invalid_unit` + `unitId` |
| ส่งต่อให้ตำแหน่งที่หนังสืออยู่แล้ว | `400 same_holder` |
| เวียนซ้ำตำแหน่งที่อยู่ในรายการแล้ว / ซ้ำกันเองใน body | `400 already_circulated` + `unitId` |
| ack ตำแหน่งที่ไม่ได้ถูกเวียน | `400 not_circulated` |
| ack ซ้ำ | `409 already_acknowledged` |
| `updatedAt` ไม่ตรง | `409 stale` — UI: "มีคนบันทึกเรื่องนี้ก่อน โหลดใหม่แล้ว" แล้ว refetch โดยคงข้อความที่พิมพ์ไว้ |

---

## 7. เทสต์ (vitest ตรรกะบริสุทธิ์)

- **`saraban-flow.test.ts`** — `canAnnotate` ทุกทะเบียน×สถานะ · forward/close/stay จาก `pending` และ
  `in-progress` ได้สถานะถูก · `same_holder` · ปลายทางปิด · เวียนซ้ำ (กับของเดิม และในตัวเอง) ·
  `onBehalfName`/`toUnitName` มาจากสมุดไม่ใช่ input · `ackTransition` ได้แม้ `done` แต่ไม่ได้ถ้า `void` ·
  ack ซ้ำ · `flowStep` ทุกกรณีรวม edit `holderUnitId` ที่ไม่นับเป็นขั้น
- **`saraban-schema.test.ts`** — action `annotate` / `ack` ใน union · `route` สามแบบ · เพดาน note/เวียน
- **`saraban-doc.test.ts`** — `buildNewDoc` มี `circulation: []` · normalize เอกสารที่ไม่มีคีย์
- **`saraban-labels.test.ts`** — ทุก event kind มีป้าย (เทสต์เดิมครอบคีย์ใหม่ให้ถ้าวนจากอาเรย์)
- `api-guard-coverage.test.ts` ไม่ต้องแก้ (ไม่มี route ใหม่)

---

## 8. นอกขอบเขตของรอบนี้

- ปากกา · ตรา · การลงนาม → รอบ 4
- เจ้าตัวกดเกษียน/ทราบเอง · ผูกคนเข้าตำแหน่ง · โหมดเจ้าหน้าที่ → รอบ 3
- แจ้งเตือน LINE เมื่อถูกส่งต่อ/เวียน → รอบ 6
- หน้าตั้งค่าข้อความสำเร็จรูป
- เปิดเรื่องที่จบแล้วกลับมา
