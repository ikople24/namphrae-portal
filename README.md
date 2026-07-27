# Namphrae Portal

Landing page รวมบริการ Smart City ของ **เทศบาลตำบลน้ำแพร่พัฒนา** (อ.หางดง จ.เชียงใหม่) พร้อมระบบหลังบ้านให้เจ้าหน้าที่เพิ่ม/แก้/ลบ/จัดลำดับลิงก์บริการได้เอง โดยไม่ต้องแก้โค้ดหรือทำรูปใหม่

แทนที่หน้า static เดิม (ปุ่มเป็นรูปภาพล้วน) ด้วย Next.js app ที่ข้อความบนการ์ดเป็น **text จริง** → ดีต่อ SEO, screen reader และแก้ชื่อได้ทันที เก็บ config ทั้งหมดเป็น **JSON ก้อนเดียว** (export/import/backup ง่าย) และเก็บสถิติการคลิกต่อบริการ

---

## Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 (Pages Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | MongoDB (single document `portalConfig`) — มี **local JSON fallback** สำหรับ dev |
| Auth | Clerk (optional — ถ้าไม่ตั้งค่าจะเป็นโหมด dev-open) |
| Media | Cloudinary (signed direct upload) |
| Deploy | Vercel |

> โครงตั้งเป้าตามแผนที่ Next.js 15 — สร้างจริงด้วย Next 16 (เวอร์ชันล่าสุดของ `create-next-app`) ซึ่ง Pages Router / `getStaticProps` / ISR ยังใช้ได้เหมือนเดิม

---

## เริ่มใช้งาน (zero-config)

รันได้ทันทีโดย **ไม่ต้องตั้งค่าอะไรเลย** — จะใช้ไฟล์ JSON ในเครื่องเป็นฐานข้อมูล และเปิดหลังบ้านแบบไม่ต้องล็อกอิน (dev-open)

```bash
npm install
npm run dev
# เปิด http://localhost:3000        (หน้าเว็บ)
#     http://localhost:3000/admin   (หลังบ้าน)
```

ข้อมูลเริ่มต้นมาจาก [`data/portal-config.seed.json`](data/portal-config.seed.json) (บริการ 18 รายการ + ตัวนับผู้เข้าชมต่อจากของเดิม 51,051) ครั้งแรกที่รัน ระบบจะคัดลอกไปเป็น `data/portal-config.json` (ถูก gitignore ไว้) แล้วอ่าน/เขียนไฟล์นั้น

---

## ตั้งค่าสำหรับ production

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า (ดูคำอธิบายแต่ละตัวในไฟล์)

### 1. MongoDB (จำเป็นบน Vercel)
filesystem บน Vercel เป็น read-only ตอน runtime — หลังบ้านเขียนทับไฟล์ไม่ได้ จึงต้องใช้ Mongo

```bash
MONGODB_URI=mongodb+srv://...
MONGODB_DB=namphrae_portal
```

Seed ข้อมูลเข้า Mongo (ครั้งเดียว):
```bash
npm run seed            # insert ถ้ายังไม่มี
npm run seed -- --force # เขียนทับของเดิม
```
> ถ้าไม่ seed ก็ได้ — แอปจะ auto-seed จาก `data/portal-config.seed.json` ครั้งแรกที่มีการอ่าน config

### 2. Clerk (ป้องกันหลังบ้าน)
ถ้าไม่ตั้งค่า `/admin` จะเปิดให้ทุกคนเข้า (มี banner เตือน) — **ห้ามขึ้น production โดยไม่ตั้งค่า**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
```

> สิทธิ์เข้าหลังบ้าน: ล็อกอิน Clerk อย่างเดียวไม่พอ — ต้องมี record ใน MongoDB
> db `db_namphrae` collection `users` (จับคู่ด้วย `clerkId`) ซึ่งเป็นทะเบียนผู้ใช้
> ชุดเดียวกับ namphrae-map (เพิ่มผู้ใช้ที่เดียว ใช้ได้ทั้งสองแอป)

### 3. Cloudinary (อัปโหลดรูป/วิดีโอ)
ถ้าไม่ตั้งค่า ปุ่มอัปโหลดจะแจ้งเตือน แต่ยัง **วาง URL รูปเองได้**
```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## โครงสร้าง

```
src/
  pages/
    index.tsx                     หน้า public (SSG + ISR revalidate 60)
    admin/                        หลังบ้าน (CSR)
      index.tsx                   ตารางลิงก์ + ลากจัดลำดับ + toggle + ลบ + ยอดคลิก
      links/new.tsx, [id].tsx     ฟอร์มเพิ่ม/แก้ลิงก์
      settings.tsx                ตั้งค่าเว็บ + hero media + คู่มือ
      data.tsx                    export / import (มี dry-run)
    sign-in/[[...index]].tsx      Clerk sign-in
    api/
      config.ts                   GET public config (เฉพาะ isActive)
      track/[id].ts               POST +1 clickCount (rate-limited)
      visit.ts                    GET/POST ตัวนับผู้เข้าชม
      admin/                      CRUD หลังบ้าน (ต้องเป็น admin)
  components/                     Hero, ServiceCard, CategorySection, Footer, admin/*
  lib/
    config-store.ts               ตัวกลาง Mongo | file store
    schema.ts                     Zod schema ใช้ร่วมทั้ง API และฟอร์ม
    auth-server.ts / clerk-config.ts   auth (server) / env check (client-safe)
    cloudinary.ts, rate-limit.ts, revalidate.ts, category-accent.ts, fonts.ts
  types/portal.ts                 TypeScript types
data/portal-config.seed.json      ข้อมูลตั้งต้น (committed)
scripts/seed.ts                   seed เข้า Mongo
```

**การ revalidate:** ทุก mutation หลังบ้าน bump `version` + set `updatedAt/updatedBy` แล้วเรียก `res.revalidate('/')` ให้หน้า public อัปเดตภายในไม่กี่วินาที (ไม่ต้องรอ 60s หรือ deploy ใหม่) — ทำจาก API ที่ auth แล้ว จึงไม่ต้องใช้ `REVALIDATE_SECRET` แยก

**Hero media:** `site.hero.mediaType` = `none` (ไล่สี + ลายเส้น contour), `image`, หรือ `video` (autoplay/muted/loop + poster, เคารพ `prefers-reduced-motion`) อัปโหลดวิดีโอใหม่ได้ทีหลังผ่าน `/admin/settings` โดยไม่ต้อง deploy — ข้อกำหนด ≤ 1080p, 10–20 วินาที, ไม่มีเสียง, ต้องมี poster คู่กัน

---

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # รัน production build
npm run seed    # seed Mongo จาก seed.json
npm run lint    # eslint
```

---

## ⚠️ รอยืนยันจากเทศบาลก่อน go-live

จาก `namphrae-portal-PLAN.md` §8–§9 — ข้อมูล seed บางส่วนมาจากการเดา (ของเดิมเป็นรูปภาพล้วนไม่มี alt text):

- [ ] **ยืนยันชื่อบริการทั้ง 18 รายการ** โดยเฉพาะ `baimai`, `npdrh-calendar`, `smart-namphrae`
- [ ] `placeholder-15` (เดิมลิงก์ไป `#`) ตั้ง `isActive: false` ไว้ — รอยืนยันว่าคือบริการอะไร
- [ ] **รูปการ์ดยัง hotlink จากโดเมนเก่า** — ควรย้ายขึ้น Cloudinary ให้ครบก่อนปิดเซิร์ฟเวอร์เดิม (การ์ดมี fallback เป็นตัวอักษรย่อถ้ารูปโหลดไม่ขึ้น)
- [ ] ชื่อ repo / โดเมนที่จะใช้จริง
- ตัวนับผู้เข้าชมเริ่มต่อจาก 51,051 ตามที่ตกลง / ไม่ทำ popup โปรโมชัน
