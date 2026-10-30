// ทะเบียนหนังสือ (สเปกข้อ 6 "/saraban/inbox · /saraban/outbox") — ใช้ร่วมสองหน้า
// outbox มีแท็บหนังสือส่ง/เวียนเพราะคนละชุดเลข
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { LevelText, StatusPill, card } from '@/components/saraban/bits';
import { sarabanFetcher, type DocListResponse } from '@/lib/saraban-api';
import { displayStatus, type RegisterView } from '@/lib/saraban-doc';
import { fiscalYearOf, formatNo } from '@/lib/saraban-number';
import { docsKey, isUrgentOpen, thaiDate, viewsOf } from '@/lib/saraban-view';
import type { SarabanRegister } from '@/types/saraban';

const TAB_LABELS: Record<SarabanRegister, string> = { in: 'หนังสือรับ', out: 'หนังสือส่ง', circular: 'หนังสือเวียน' };

export default function RegisterPage({ registers, title }: { registers: SarabanRegister[]; title: string }) {
  const [register, setRegister] = useState<SarabanRegister>(registers[0]);
  const [year, setYear] = useState<number | undefined>();
  const [view, setView] = useState<RegisterView>('all');
  const [page, setPage] = useState(1);

  const { data, error, isLoading } = useSWR<DocListResponse>(
    docsKey({ register, year, view, page }),
    sarabanFetcher,
    { keepPreviousData: true }
  );

  const reset = (patch: { register?: SarabanRegister; year?: number; view?: RegisterView }) => {
    if (patch.register) setRegister(patch.register);
    if ('year' in patch) setYear(patch.year);
    setView(patch.view ?? 'all');
    setPage(1);
  };

  const currentYear = data ? fiscalYearOf(data.today) : undefined;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const isIn = register === 'in';

  return (
    <SarabanLayout
      title={title}
      actions={
        !isIn ? (
          <Link href="/saraban/send" className="inline-flex items-center gap-1 rounded-[10px] border border-sb-line bg-white px-3.5 py-2 text-[13px] font-medium hover:bg-sb-hover">
            <Icon name="tag" size={16} />
            ออกเลขหนังสือส่ง
          </Link>
        ) : undefined
      }
    >
      {registers.length > 1 ? (
        <div className="flex gap-1 self-start rounded-[10px] bg-sb-subtle p-[3px]">
          {registers.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => reset({ register: r, year })}
              className={`rounded-lg px-4 py-1.5 text-[13px] ${
                r === register ? 'bg-white font-semibold text-sb-accent shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-sb-muted'
              }`}
            >
              {TAB_LABELS[r]}
            </button>
          ))}
        </div>
      ) : null}

      {data && currentYear && data.fiscalYear === currentYear && data.carryOver > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-sb-warning-bg px-4 py-3 text-[13px] text-sb-warning-ink">
          <Icon name="warning" size={18} />
          มีหนังสือค้างจากปีงบก่อนหน้าอีก {data.carryOver} เรื่อง
          <button type="button" onClick={() => reset({ year: currentYear - 1 })} className="font-semibold underline">
            ดูปีงบ {currentYear - 1}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        {data
          ? viewsOf(register, data.counts).map((b) => (
              <button
                key={b.view}
                type="button"
                onClick={() => reset({ year, view: b.view })}
                className={`rounded-full border border-sb-line px-3.5 py-1.5 text-[13px] ${
                  b.view === view ? 'bg-sb-ink font-semibold text-white' : 'bg-white text-sb-ink hover:bg-sb-hover'
                }`}
              >
                {b.label} <span className="opacity-60">{b.count}</span>
              </button>
            ))
          : null}
        <div className="flex-1" />
        {data ? (
          <label className="flex items-center gap-2 text-[13px] text-sb-muted">
            ปีงบ
            <select
              value={data.fiscalYear}
              onChange={(e) => reset({ year: Number(e.target.value) })}
              className="rounded-[10px] border border-sb-line-input bg-white px-3 py-2 text-[13px] text-sb-ink"
            >
              {data.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-sb-panel text-left text-xs text-sb-muted">
                <th className="px-4 py-3 font-semibold">{isIn ? 'เลขรับ' : 'เลขส่ง'}</th>
                <th className="px-2.5 py-3 font-semibold">ลงวันที่</th>
                <th className="px-2.5 py-3 font-semibold">ที่หนังสือ</th>
                <th className="px-2.5 py-3 font-semibold">{isIn ? 'จาก' : 'ถึง'}</th>
                <th className="w-[34%] px-2.5 py-3 font-semibold">เรื่อง</th>
                <th className="px-2.5 py-3 font-semibold">ชั้นความเร็ว</th>
                <th className="px-2.5 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.docs.map((doc) => (
                <tr
                  key={doc.id}
                  className={`border-t border-sb-page hover:bg-sb-panel ${isUrgentOpen(doc) ? 'bg-sb-urgent-row' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-sb-accent">{formatNo(doc.register, doc.no)}</td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-sb-muted">{thaiDate(doc.docDate)}</td>
                  <td className="whitespace-nowrap px-2.5 py-3">{doc.ref}</td>
                  <td className="px-2.5 py-3">{doc.party}</td>
                  <td className="px-2.5 py-3 leading-snug">
                    {doc.subject}
                    {doc.files.length > 0 ? (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-sb-success-bg px-[7px] py-px text-[11px] text-sb-success">ไร้กระดาษ</span>
                    ) : null}
                  </td>
                  <td className="px-2.5 py-3">
                    <LevelText level={doc.level} />
                  </td>
                  <td className="px-2.5 py-3">
                    <StatusPill register={doc.register} status={displayStatus(doc, data.today)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/saraban/track/${doc.id}`}
                      className="rounded-lg border border-sb-line bg-white px-2.5 py-[5px] text-xs hover:bg-sb-hover"
                    >
                      ติดตาม
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error ? (
          <p className="border-t border-sb-page px-4 py-6 text-center text-[13px] text-sb-danger">โหลดทะเบียนไม่สำเร็จ ลองรีเฟรชหน้า</p>
        ) : isLoading && !data ? (
          <p className="border-t border-sb-page px-4 py-6 text-center text-[13px] text-sb-muted">กำลังโหลด…</p>
        ) : data && data.docs.length === 0 ? (
          <p className="border-t border-sb-page px-4 py-6 text-center text-[13px] text-sb-muted">ยังไม่มีหนังสือในมุมมองนี้</p>
        ) : null}
        {data && data.total > 0 ? (
          <div className="flex items-center justify-between border-t border-sb-page px-4 py-3 text-[13px] text-sb-muted">
            <span>
              แสดง {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + data.docs.length} จาก {data.total} รายการ
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-sb-line bg-white px-2.5 py-1 text-xs disabled:opacity-40"
              >
                ‹
              </button>
              <span className="px-1 text-xs">
                หน้า {page}/{pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-sb-line bg-white px-2.5 py-1 text-xs disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </SarabanLayout>
  );
}
