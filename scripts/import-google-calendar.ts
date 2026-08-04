/**
 * นำเข้างานจากปฏิทิน Google เดิม (หน้า namphraesmartcity.ai/calendar) เข้า
 * collection `calendarJobs`
 *
 *   npm run import:gcal                    # ดูผลก่อน ไม่เขียนจริง (ค่าเริ่มต้น)
 *   npm run import:gcal -- --write         # เขียนลง Mongo จริง
 *   npm run import:gcal -- --month=2026-08 # ระบุเดือน (ไม่ใส่ = เดือนนี้ตามเวลาไทย)
 *
 * ต้องมี MONGODB_URI ใน .env.local
 *
 * รันซ้ำได้ปลอดภัย: `id` ของแต่ละงาน derive มาจาก UID ของ event ใน Google
 * Calendar แบบคงที่ การรันซ้ำจึงเป็นการ upsert ทับของเดิม ไม่ใช่สร้างซ้ำ
 *
 * ⚠️ ข้อมูลที่ดึงมาเป็นข้อมูลผู้ป่วยจริง — สคริปต์นี้ไม่เขียนอะไรลงไฟล์ในโปรเจกต์
 * และ log แค่จำนวนกับวันเวลา ไม่พิมพ์ชื่อหรือเบอร์ออกมา
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { jobInputSchema } from '../src/lib/schema';
import type { CalendarJob, JobKind, JobStatus } from '../src/types/portal';

// ปฏิทินสองอันที่หน้าเดิมฝังไว้ (ดู docs/superpowers/specs/...-design.md)
const CALENDARS: Array<{ kind: JobKind; id: string }> = [
  {
    kind: 'ems',
    id: 'fce10da151b4d123bb36b1def1f4bdac93bfb5612ce9f472dba35f7444c3cead@group.calendar.google.com',
  },
  {
    kind: 'rescue',
    id: 'b2534846b68e6283cf8d66115da2f27ad2bd45da6c82cb697cf5e445a4830b67@group.calendar.google.com',
  },
];

const IMPORT_ACTOR = 'google-calendar-import';

// ---- ICS ------------------------------------------------------------------

/** คลี่บรรทัดที่ถูกตัดขึ้นบรรทัดใหม่ตามสเปค iCalendar (บรรทัดต่อขึ้นต้นด้วยช่องว่าง) */
function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, '');
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

type IcsEvent = {
  uid: string;
  startUtc: Date | null;
  /** 'YYYY-MM-DD' จาก DTSTART ดิบ — มีเสมอแม้ event จะเป็นแบบทั้งวัน (ไม่มีเวลา)
   *  ใช้กรองเดือนก่อน จะได้รายงานยอดที่ข้ามเฉพาะในเดือนที่นำเข้าจริง */
  rawDate: string;
  summary: string;
  description: string;
};

function parseEvents(ics: string): IcsEvent[] {
  const body = unfold(ics);
  const blocks = body.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  return blocks.map((block) => {
    const field = (name: string): string => {
      const m = block.match(new RegExp(`^${name}(?:;[^:\\r\\n]*)?:([^\\r\\n]*)`, 'm'));
      return m ? unescapeIcs(m[1]) : '';
    };
    const raw = block.match(/^DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})/m);
    return {
      uid: field('UID'),
      startUtc: parseDtStart(block),
      rawDate: raw ? `${raw[1]}-${raw[2]}-${raw[3]}` : '',
      summary: field('SUMMARY').trim(),
      description: field('DESCRIPTION'),
    };
  });
}

/**
 * DTSTART มีได้สามรูปแบบ: UTC (ลงท้าย Z), มี TZID, และแบบทั้งวัน (VALUE=DATE)
 * แบบทั้งวันไม่มีเวลา จึงข้ามไป — งานรับส่งผู้ป่วยต้องมีเวลานัดเสมอ
 */
function parseDtStart(block: string): Date | null {
  const line = block.match(/^DTSTART([^:\r\n]*):([^\r\n]+)/m);
  if (!line) return null;
  const params = line[1];
  const value = line[2].trim();

  if (/VALUE=DATE(?!-TIME)/.test(params)) return null; // งานทั้งวัน — ไม่มีเวลานัด

  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;

  if (z === 'Z') {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  // ไม่มี Z: ถือว่าเป็นเวลาไทย (ปฏิทินตั้ง ctz=Asia/Bangkok) → ลบ 7 ชม.เป็น UTC
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 7, +mi, +s));
}

// ---- เวลาไทย ---------------------------------------------------------------

const BKK = 'Asia/Bangkok';

function bangkokParts(date: Date): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: BKK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BKK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ---- แปลง event → งาน ------------------------------------------------------

/**
 * DESCRIPTION ของปฏิทินเดิมมีรูปแบบคงที่:
 *   🏠︎ - ม.หมู่ 3 ต.น้ำแพร่
 *   ➤ บ้านที่อาศัย - รพ.สวนดอก
 *   ☎︎ 08xxxxxxxx
 * บรรทัดไหนไม่มีก็ปล่อยว่าง — schema เติม '' ให้เอง
 */
function parseDescription(desc: string): {
  village: string;
  origin: string;
  destination: string;
  phone: string;
} {
  const village = desc.match(/🏠[^\S\n]*[︎]?\s*-?\s*([^\n]*)/)?.[1]?.trim() ?? '';
  const route = desc.match(/➤\s*([^\n]*)/)?.[1]?.trim() ?? '';
  const phone = desc.match(/☎[︎]?\s*([^\n]*)/)?.[1]?.trim() ?? '';

  const dash = route.indexOf(' - ');
  const origin = dash >= 0 ? route.slice(0, dash).trim() : route;
  const destination = dash >= 0 ? route.slice(dash + 3).trim() : '';

  return { village, origin, destination, phone };
}

/** id คงที่จาก UID ของ Google — รันซ้ำแล้ว upsert ทับ ไม่สร้างซ้ำ */
function stableId(uid: string): string {
  return 'gcal-' + crypto.createHash('sha1').update(uid).digest('hex').slice(0, 16);
}

// ---- main ------------------------------------------------------------------

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'namphrae_portal';
  const write = process.argv.includes('--write');
  const monthArg = process.argv.find((a) => a.startsWith('--month='))?.slice(8);
  const month = monthArg ?? todayInBangkok().slice(0, 7);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    console.error(`✗ --month ต้องเป็นรูปแบบ YYYY-MM (ได้รับ "${month}")`);
    process.exit(1);
  }
  // ต้องมี URI เฉพาะตอนเขียนจริง — dry-run ดูผลได้โดยไม่ต้องมี credential
  if (write && !uri) {
    console.error('✗ ยังไม่ได้ตั้ง MONGODB_URI — ใส่ใน .env.local ก่อนใช้ --write');
    process.exit(1);
  }

  const today = todayInBangkok();
  const jobs: CalendarJob[] = [];
  let skippedAllDay = 0;
  let skippedInvalid = 0;

  for (const cal of CALENDARS) {
    const url =
      'https://calendar.google.com/calendar/ical/' +
      encodeURIComponent(cal.id) +
      '/public/basic.ics';
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`✗ ดึงปฏิทิน ${cal.kind} ไม่สำเร็จ: HTTP ${res.status}`);
      process.exit(1);
    }

    for (const ev of parseEvents(await res.text())) {
      // กรองเดือนด้วย "วันที่ตามเวลาไทย" เสมอ ห้ามใช้ DTSTART ดิบซึ่งเป็น UTC —
      // งาน 06:00 น. วันที่ 1 ของเดือน คือ 23:00Z ของวันสุดท้ายเดือนก่อน ถ้ากรอง
      // จากค่าดิบงานเช้าต้นเดือนจะหายไปเงียบ ๆ (ข้อมูลจริงเป็นงานเช้าทั้งหมด)
      // งานแบบทั้งวันไม่มีเวลา ค่าดิบจึงเป็นวันที่ตามปฏิทินอยู่แล้ว
      const bkkDate = ev.startUtc ? bangkokParts(ev.startUtc).date : ev.rawDate;
      if (!bkkDate.startsWith(month)) continue;

      if (!ev.startUtc) {
        skippedAllDay += 1;
        continue;
      }
      const { date, time } = bangkokParts(ev.startUtc);

      const parsed = jobInputSchema.safeParse({
        kind: cal.kind,
        date,
        time,
        title: ev.summary,
        ...parseDescription(ev.description),
      });
      if (!parsed.success) {
        // ไม่พิมพ์เนื้อหา event ออกมา — เป็นข้อมูลผู้ป่วย
        console.warn(`  ! ข้าม event วันที่ ${date} ${time}: ${parsed.error.issues[0]?.message}`);
        skippedInvalid += 1;
        continue;
      }

      // ปฏิทินเดิมคือแหล่งความจริงของงานที่นัดไว้แล้ว = ผ่านการอนุมัติมาแล้ว
      // งานที่วันผ่านไปแล้วถือว่าดำเนินการเสร็จ
      const status: JobStatus = date < today ? 'done' : 'approved';
      const now = new Date().toISOString();

      jobs.push({
        id: stableId(ev.uid),
        status,
        ...parsed.data,
        createdAt: now,
        createdBy: IMPORT_ACTOR,
        decidedAt: now,
        decidedBy: IMPORT_ACTOR,
        ...(status === 'done' ? { doneAt: now, doneBy: IMPORT_ACTOR } : {}),
      });
    }
  }

  jobs.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  console.log(`เดือน ${month} · พบงาน ${jobs.length} รายการ`);
  for (const kind of ['ems', 'rescue'] as JobKind[]) {
    const n = jobs.filter((j) => j.kind === kind).length;
    console.log(`  ${kind}: ${n}`);
  }
  console.log(
    `  อนุมัติแล้ว ${jobs.filter((j) => j.status === 'approved').length} · ` +
      `ดำเนินการแล้ว ${jobs.filter((j) => j.status === 'done').length}`
  );
  if (skippedAllDay) console.log(`  ข้ามงานแบบทั้งวัน (ไม่มีเวลานัด): ${skippedAllDay}`);
  if (skippedInvalid) console.log(`  ข้ามเพราะข้อมูลไม่ผ่าน schema: ${skippedInvalid}`);

  if (!write) {
    console.log('\n(dry-run — ยังไม่เขียนลง Mongo ใส่ --write เพื่อเขียนจริง)');
    return;
  }
  if (jobs.length === 0) {
    console.log('\nไม่มีอะไรให้เขียน');
    return;
  }

  const client = await new MongoClient(uri!).connect();
  try {
    const col = client.db(dbName).collection<CalendarJob>('calendarJobs');
    const res = await col.bulkWrite(
      jobs.map((job) => ({
        replaceOne: { filter: { id: job.id }, replacement: job, upsert: true },
      }))
    );
    console.log(
      `\n✓ เขียน ${dbName}.calendarJobs — เพิ่มใหม่ ${res.upsertedCount} · ทับของเดิม ${res.modifiedCount}`
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
