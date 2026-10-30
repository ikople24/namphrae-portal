# ร่างเริ่มลงมือ — ระบบสารบรรณ `/saraban` (namphrae-portal)

**สถานะ ณ 25 ต.ค. 2569 (จากการอ่าน repo):** สเปกและแผน 1A มีแล้ว · โค้ดทำไปถึง **Task 5 ของแผน 1A**

| แผน 1A | ไฟล์ | สถานะ |
|---|---|---|
| Task 1 ชนิดข้อมูล | `src/types/saraban.ts` | ✅ |
| Task 2 ปีงบ/เลข | `src/lib/saraban-number.ts` + test | ✅ |
| Task 3 ป้าย | `src/lib/saraban-labels.ts` + test | ✅ |
| Task 4–5 สร้างหนังสือ · เกินกำหนด · ตัวกรอง | `src/lib/saraban-doc.ts` + test | ✅ |
| **Task 6** กฎแก้ไข/ยกเลิก/ส่งแล้ว | `saraban-doc.ts` (ส่วนที่ 3) — ยังไม่มี `canVoid` / `canMarkSent` / `editableFieldsOf` | ⏭ **เริ่มที่นี่** |
| Task 7 ตรวจไฟล์แนบ | `saraban-attachment.ts` | ☐ |
| Task 8 zod | `saraban-schema.ts` | ☐ |
| Task 9 สิทธิ์ | `user-access.ts` — `FEATURES` ยังไม่มี `saraban` | ☐ |
| Task 10 แบ็กเอนด์ไฟล์ + สมุดผู้รับ | `saraban-file.ts` · `saraban-units-store.ts` · `data/saraban-units.seed.json` | ☐ |
| Task 11–12 store ออกเลข/อ่านเขียน | `saraban-store.ts` | ☐ |
| Task 13 smoke + ตรวจทั้งโปรเจกต์ | — | ☐ |

---

## 0. ก่อนเริ่ม (ครั้งเดียว)

```bash
cd namphrae-portal
git checkout -b feat/saraban-1a        # ถ้ายังไม่มี branch
npm install
npm test                               # baseline ต้องผ่านทั้งหมด
npx tsc --noEmit -p .                  # ต้องไม่มี error
```

> AGENTS.md: Next.js เวอร์ชันนี้ต่างจากที่รู้จัก — อ่าน `node_modules/next/dist/docs/` ก่อนแตะหน้า/route (รอบ 1B–1C)

## 1. ลำดับลงมือ

1. **ปิดรอบ 1A** — Task 6 → 13 ตามแผนเดิมทีละ task (เขียนเทสต์ก่อน → รันให้ล้ม → เขียนโค้ด → ผ่าน → commit `feat(saraban): …`)
2. **เขียนแผน 1B** `docs/superpowers/plans/YYYY-MM-DD-saraban-1b-api.md` — API ใต้ `/api/admin/saraban/*` + Railway Bucket + `proxy.ts`
   - ก่อน 1B: แผน 1A Task 14 — ปรับไฟล์แนบจาก Cloudinary เป็น Railway Bucket (สเปก §5 · บันทึกการเปลี่ยนแปลง 2026-10-30)
   - งานแรกของ 1B: ตรวจ 3 ข้อในสเปก §12 (bucket ตั้งครบ + smoke · ลิงก์ชั่วคราวหมดอายุจริง · ที่สำรองไฟล์)
3. **เขียนแผน 1C** — หน้าจอ: `SarabanLayout` · inbox · outbox · receive · send · track/[id] · units + โทเคน `--color-sb-*` + ฟอนต์ IBM Plex Sans Thai แยกไฟล์
4. รอบ 2–6 ตามสเปก §9 (เกษียน → โหมดเจ้าหน้าที่ → ปากกา/ตรา/ลงนาม → ค้นหา/รายงาน → แดชบอร์ด)

## 2. ต้นแบบล่าสุด vs สเปก — สิ่งที่ต้องตัดสิน

ต้นแบบได้เพิ่ม 2 เรื่องหลังสเปกเขียนเสร็จ สเปกตอบไว้แล้ว ให้ **ยึดสเปก**:

- **แจ้งเวียน: ติ๊กผู้รับ + เพิ่มผู้รับใหม่ด้วยรหัส `NP-xxxx`** → สเปก §10 รอบ 2: เพิ่มเป็น *ตำแหน่งในสมุด* (ชื่อ + สังกัด) ไม่สร้างผู้ใช้/รหัสเอง
- **2 โหมดในไฟล์เดียว (สวิตช์บน sidebar)** → สเปก §1.4 + รอบ 3: โหมดเต็ม = สิทธิ์ `saraban` · โหมดเจ้าหน้าที่ = ถูกผูกตำแหน่ง · สวิตช์โผล่เมื่อมีทั้งสอง

ส่วนที่ต้นแบบ "จำลอง" ห้ามติดไปโค้ดจริง: ตัวเลขสถิติ (4 แผ่น/เรื่อง ฯลฯ) · OCR · ป้าย "ลงนามดิจิทัล · ตรวจสอบแล้ว" (ใช้ "ลงนามในระบบ")

## 3. รอยืนยันจากเทศบาล (ขอคู่ขนานไปได้เลย)

- [ ] ผังตำแหน่ง/กองจริง + `refCode` ของแต่ละกอง (ตอนนี้มีแค่สำนักปลัด `ชม 55201`)
- [ ] หนังสือเวียนแยกชุดเลข ใช่หรือไม่
- [ ] วันเริ่มใช้จริง (ถ้ากลางปีงบ 2570 ต้องได้เลขล่าสุดของทะเบียนกระดาษ)
- [ ] Railway: สร้าง bucket ตัวจริง + ตัวทดสอบ และผูกตัวแปร `BUCKET_*` (สเปก §5 "ตั้งค่า bucket")
- [ ] ปลายทางสำรองไฟล์ของ bucket — Railway ไม่ backup ให้ ต้องเลือกก่อนเปิดใช้จริง

---

## 4. Prompt สำหรับวางใน Claude Code (ในโฟลเดอร์ namphrae-portal)

```
อ่าน AGENTS.md, docs/superpowers/specs/2026-09-13-saraban-design.md
และ docs/superpowers/plans/2026-09-13-saraban-1a-data-layer.md

Task 1–5 ของแผน 1A ทำเสร็จแล้ว (types, saraban-number, saraban-labels,
saraban-doc ส่วนที่ 1–2 พร้อมเทสต์) — ตรวจด้วย npm test ก่อน

ทำต่อตั้งแต่ Task 6 ถึง Task 13 ทีละ task ตามแผนแบบเคร่งครัด:
- TDD: เขียนเทสต์ → รันให้ล้ม → เขียนโค้ด → รันให้ผ่าน
- ห้ามแก้เทสต์เดิม ยกเว้น src/lib/user-access.test.ts
- ไฟล์ saraban-{number,labels,doc,attachment,schema}.ts ห้าม import mongodb/cloudinary/fs/node:*
- คอมเมนต์ภาษาไทยอธิบาย "ทำไม" · commit ทีละ task: feat(saraban): …
- จบแต่ละ task ให้ติ๊ก checkbox ในไฟล์แผน และรายงานผล npm test + tsc

หยุดถามเมื่อแผนกับโค้ดจริงไม่ตรงกัน อย่าเดา
```

หลังจบ 1A ใช้ prompt ถัดไป:

```
เขียนแผนรอบ 1B (API + Railway Bucket + proxy) ตามสเปก §2, §4, §5, §8
ในรูปแบบเดียวกับแผน 1A — งานแรกคือตรวจ 2 ข้อของสเปก §12
ยังไม่ต้องลงมือเขียนโค้ด ให้ผมรีวิวแผนก่อน
```
