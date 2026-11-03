// การ์ดแจ้งเวียนของหน้าติดตาม — ธุรการติ๊ก "ทราบ" แทนเมื่อกระดาษเวียนกลับมาครบลายเซ็น (สเปกรอบ 2 ข้อ 1.2)
import Icon from '@/components/Icon';
import { card } from '@/components/saraban/bits';
import { canAck } from '@/lib/saraban-flow';
import { thaiDateTime } from '@/lib/saraban-view';
import type { SarabanDoc } from '@/types/saraban';

export default function CirculationCard({
  doc,
  busy,
  onAck,
}: {
  doc: SarabanDoc;
  busy: boolean;
  onAck: (unitId: string) => void;
}) {
  if (doc.circulation.length === 0) return null;
  const acked = doc.circulation.filter((c) => c.ackAt).length;
  const ackable = canAck(doc);
  return (
    <section className={`${card} p-[22px]`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-semibold">
          <Icon name="campaign" size={18} />
          แจ้งเวียนภายใน
        </h3>
        <span className="text-[13px] text-sb-muted">
          ทราบแล้ว {acked}/{doc.circulation.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {doc.circulation.map((c) => (
          <li key={c.unitId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-sb-line px-3 py-2 text-[13px]">
            <span className="min-w-0 flex-1 font-medium">{c.unitName}</span>
            <span className="text-xs text-sb-muted">เวียน {thaiDateTime(c.sentAt)}</span>
            {c.ackAt ? (
              <span className="inline-flex items-center gap-1 text-xs text-sb-success">
                <Icon name="check_circle" size={16} />
                ทราบ {thaiDateTime(c.ackAt)} · {c.ackByName}
              </span>
            ) : ackable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAck(c.unitId)}
                className="rounded-lg border border-sb-success px-2.5 py-1 text-xs font-medium text-sb-success hover:bg-sb-success-bg disabled:opacity-60"
              >
                ทราบ
              </button>
            ) : (
              <span className="text-xs text-sb-muted">ยังไม่ทราบ</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
