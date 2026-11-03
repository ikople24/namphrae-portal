// บรรทัดรายละเอียดของ event รอบ 2 บนไทม์ไลน์ (หน้าติดตามและหน้าเกษียนใช้ร่วม) — แสดงจากชื่อที่เก็บ
// ใน event ณ เวลาที่ทำ ไม่ค้นสมุดใหม่ (สเปกแม่ข้อ 3)
import type { SarabanEvent } from '@/types/saraban';

export default function EventDetail({ event }: { event: SarabanEvent }) {
  if (event.kind === 'acknowledged') {
    return <p className="mt-0.5 text-[13px]">{event.unitName} ทราบแล้ว</p>;
  }
  if (event.kind !== 'annotated') return null;
  if (event.route !== 'forward' && event.route !== 'close' && !event.circulateTo?.length) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[13px]">
      {event.route === 'forward' ? <p className="font-medium text-sb-accent"><span aria-hidden>→</span> ส่งต่อ {event.toUnitName}</p> : null}
      {event.route === 'close' ? <p className="font-medium text-sb-success"><span aria-hidden>→</span> ส่งคืนสารบรรณ (จบเรื่อง)</p> : null}
      {event.circulateTo?.length ? (
        <p className="text-sb-warning-ink">เวียนให้ทราบ: {event.circulateTo.map((c) => c.unitName).join(' · ')}</p>
      ) : null}
    </div>
  );
}

/** หัวบรรทัดผู้ทำ — เกษียนแสดง "ตำแหน่ง · บันทึกโดย ชื่อ" เพราะธุรการบันทึกแทน (สเปกรอบ 2 ข้อ 1.1) */
export function eventByline(event: SarabanEvent): string {
  return event.kind === 'annotated' && event.onBehalfName
    ? `${event.onBehalfName} · บันทึกโดย ${event.byName}`
    : event.byName;
}
