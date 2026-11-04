// การ์ดหนังสือของงานของฉัน (ต้นแบบ A) — แตะการ์ด = เปิดหน้าหนังสือ · ปุ่มลัดทำได้ทันทีไม่ต้องเข้า
import Link from 'next/link';
import Icon from '@/components/Icon';
import { LevelText, StatusPill } from '@/components/saraban/bits';
import type { MemberActions } from '@/lib/saraban-member';
import { thaiDate } from '@/lib/saraban-view';
import type { SarabanDoc } from '@/types/saraban';

export default function MemberDocCard({
  doc,
  href,
  actions,
  busy,
  onQuickClose,
  onQuickAck,
}: {
  doc: SarabanDoc;
  href: string;
  actions: MemberActions | null; // null = แท็บที่ไม่มีปุ่มลัด
  busy: boolean;
  onQuickClose: () => void;
  onQuickAck: (unitId: string) => void;
}) {
  const ackUnit = actions?.ackUnitIds[0];
  return (
    <article className="rounded-2xl border border-sb-line bg-white p-4">
      <Link href={href} className="block">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sb-muted">
          <span className="font-semibold text-sb-ink-2">รับที่ {doc.no}</span>
          <span>{thaiDate(doc.docDate)}</span>
          {doc.level !== 'normal' ? <LevelText level={doc.level} /> : null}
          <span className="flex-1" />
          <StatusPill register={doc.register} status={doc.status} />
        </div>
        <h2 className="mt-1.5 text-[15px] font-semibold leading-snug">{doc.subject}</h2>
        <p className="mt-0.5 text-[13px] text-sb-muted">จาก {doc.party}</p>
      </Link>
      {actions && (actions.annotateAs || ackUnit) ? (
        <div className="mt-3 flex gap-2">
          {actions.annotateAs ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onQuickClose}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-sb-success text-sm font-semibold text-sb-success hover:bg-[#F1F5FA] disabled:opacity-50"
              >
                <Icon name="check" size={18} />
                ทราบ · จบเรื่อง
              </button>
              <Link
                href={href}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-sb-accent text-sm font-semibold text-white hover:bg-sb-accent-hover"
              >
                <Icon name="arrow_forward" size={18} />
                สั่งการ / ส่งต่อ
              </Link>
            </>
          ) : ackUnit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuickAck(ackUnit)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-sb-success text-sm font-semibold text-sb-success hover:bg-[#F1F5FA] disabled:opacity-50"
            >
              <Icon name="check" size={18} />
              ทราบ (แจ้งเวียน)
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
