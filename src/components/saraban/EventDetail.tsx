// บรรทัดรายละเอียดของ event บนไทม์ไลน์ (หน้าติดตาม หน้าเกษียน งานของฉันใช้ร่วม) — แสดงจากชื่อที่เก็บ
// ใน event ณ เวลาที่ทำ ไม่ค้นสมุดใหม่ (สเปกแม่ข้อ 3) · รอบ 4: ตรา · ลายมือ · ลงนามในระบบ
import Icon from '@/components/Icon';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { inkPageCount } from '@/lib/saraban-mark';
import { thaiDateTime } from '@/lib/saraban-view';
import { STAMP_KINDS, type SarabanEvent } from '@/types/saraban';

export default function EventDetail({ event }: { event: SarabanEvent }) {
  if (event.kind === 'acknowledged') {
    return <p className="mt-0.5 text-[13px]">{event.unitName} ทราบแล้ว</p>;
  }
  if (event.kind !== 'annotated') return null;
  const marks = event.marks ?? [];
  // ชนิดตราที่ใช้ เรียงตาม STAMP_KINDS ไม่ซ้ำ
  const stamps = STAMP_KINDS.filter((k) => marks.some((m) => m.type === 'stamp' && m.stamp === k));
  const inkPages = inkPageCount(marks);
  const routeLine = event.route === 'forward' || event.route === 'close';
  if (!routeLine && !event.circulateTo?.length && !stamps.length && !inkPages && !event.signature) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[13px]">
      {event.route === 'forward' ? <p className="font-medium text-sb-accent"><span aria-hidden>→</span> ส่งต่อ {event.toUnitName}</p> : null}
      {event.route === 'close' ? <p className="font-medium text-sb-success"><span aria-hidden>→</span> ส่งคืนสารบรรณ (จบเรื่อง)</p> : null}
      {event.circulateTo?.length ? (
        <p className="text-sb-warning-ink">เวียนให้ทราบ: {event.circulateTo.map((c) => c.unitName).join(' · ')}</p>
      ) : null}
      {stamps.length ? (
        <p>
          ตรา:{' '}
          {stamps.map((k, i) => (
            <span key={k} className="font-semibold" style={{ color: STAMP_COLORS[k] }}>
              {i > 0 ? ', ' : ''}
              {STAMP_LABELS[k]}
            </span>
          ))}
        </p>
      ) : null}
      {inkPages ? <p className="text-sb-muted">มีลายมือ {inkPages} หน้า</p> : null}
      {event.signature ? (
        <div className="mt-0.5 rounded-lg border border-sb-line px-2.5 py-1.5">
          <p className="flex items-center gap-1 font-medium">
            <Icon name="check_circle" size={16} className="text-sb-success" />
            ลงนามในระบบ · {event.byName} · {thaiDateTime(event.at)}
          </p>
          {event.signature.files.length === 0 ? (
            <p className="text-xs text-sb-muted">ลงนามข้อความเกษียน (ไม่มีไฟล์แนบ)</p>
          ) : (
            event.signature.files.map((f) => (
              <details key={f.fileId} className="text-xs text-sb-muted">
                <summary className="cursor-pointer">
                  {f.name} · <code>{f.sha256.slice(0, 8)}</code>
                </summary>
                <code className="block break-all">{f.sha256}</code>
              </details>
            ))
          )}
        </div>
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
