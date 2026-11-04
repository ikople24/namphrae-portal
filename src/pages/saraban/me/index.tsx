// งานของฉัน (สเปกรอบ 3 ข้อ 4 · ต้นแบบ A) — หนังสือที่ตำแหน่งของฉันเกี่ยว แยก 3 แท็บ
// dev-open: ยังไม่ได้เลือกตำแหน่ง (ไม่มี ?as=) → เลือกตำแหน่งที่จะสวมก่อน
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import useSWRInfinite from 'swr/infinite';
import MemberDocCard from '@/components/saraban/MemberDocCard';
import MemberShell from '@/components/saraban/MemberShell';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getSarabanMemberSsrProps } from '@/lib/auth-server';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import {
  memberAck,
  memberAnnotate,
  messageOf,
  sarabanFetcher,
  SarabanApiError,
  UNITS_KEY,
  type MemberDocsResponse,
  type MemberSummary,
} from '@/lib/saraban-api';
import { MEMBER_TABS, memberActions, type MemberTab } from '@/lib/saraban-member';
import { errorMessage, memberDocsKey, memberSummaryKey, withAs } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

const TAB_LABELS: Record<MemberTab, string> = { todo: 'รอฉันทำ', forwarded: 'ส่งต่อแล้ว', done: 'จบเรื่อง' };
const EMPTY: Record<MemberTab, string> = {
  todo: 'ไม่มีหนังสือรอคุณ',
  forwarded: 'ยังไม่มีเรื่องที่ส่งต่อไป',
  done: 'ยังไม่มีเรื่องที่จบ',
};

function MyWorkPage() {
  const router = useRouter();
  const as = typeof router.query.as === 'string' ? router.query.as : undefined;
  const tab: MemberTab = MEMBER_TABS.find((t) => t === router.query.tab) ?? 'todo';
  const { mutate: globalMutate } = useSWRConfig();
  const [busyId, setBusyId] = useState('');

  const { data: summary, error: summaryError } = useSWR<MemberSummary>(memberSummaryKey(as), sarabanFetcher, {
    shouldRetryOnError: false,
  });
  const notMember = summaryError instanceof SarabanApiError && summaryError.code === 'not_member';
  const list = useSWRInfinite<MemberDocsResponse>(
    (index) => (summary ? memberDocsKey({ tab, page: index + 1, as }) : null),
    sarabanFetcher
  );
  const docs = list.data?.flatMap((p) => p.items) ?? [];
  const total = list.data?.[0]?.total ?? 0;
  const unitIds = summary?.units.map((u) => u.id) ?? [];

  const refresh = () => {
    void globalMutate((k) => typeof k === 'string' && k.startsWith('/api/admin/saraban/me'));
    void list.mutate();
  };

  async function run(doc: SarabanDoc, action: () => Promise<unknown>, done: string) {
    setBusyId(doc.id);
    try {
      await action();
      showToast(done);
    } catch (err) {
      showToast(messageOf(err));
    } finally {
      setBusyId('');
      refresh();
    }
  }

  const tabHref = (t: MemberTab) => withAs(`/saraban/me?tab=${t}`, as);
  const docHref = (id: string) => withAs(`/saraban/me/doc/${encodeURIComponent(id)}`, as);

  if (notMember) {
    return (
      <MemberShell title="งานของฉัน" canFull>
        {isClerkPublicConfigured() ? (
          <p className="rounded-2xl border border-sb-line bg-white p-6 text-center text-sm text-sb-muted">{errorMessage('not_member')}</p>
        ) : (
          <DevUnitPicker />
        )}
      </MemberShell>
    );
  }

  return (
    <MemberShell
      title="งานของฉัน"
      subtitle={summary?.units.map((u) => u.name).join(' · ')}
      canFull={summary?.canReceive ?? false}
      bottom={
        summary?.canReceive ? (
          <Link href="/saraban/receive" className="flex h-[52px] items-center justify-center rounded-xl bg-sb-success text-base font-semibold text-white">
            + ลงรับหนังสือใหม่
          </Link>
        ) : undefined
      }
    >
      <div role="tablist" aria-label="แท็บงาน" className="grid grid-cols-3 gap-2">
        {MEMBER_TABS.map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={t === tab}
            href={tabHref(t)}
            replace
            className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl border px-2 py-2 ${
              t === tab ? 'border-[#1B2430] bg-white' : 'border-sb-line bg-white/60 text-sb-muted'
            }`}
          >
            <span className={`text-[22px] font-bold leading-none ${t === tab ? 'text-[#1B2430]' : ''}`}>{summary?.counts[t] ?? '–'}</span>
            <span className="mt-1 text-xs font-semibold">{TAB_LABELS[t]}</span>
          </Link>
        ))}
      </div>

      {summaryError && !notMember ? <p className="text-center text-sm text-sb-danger">{messageOf(summaryError)}</p> : null}
      {list.data && docs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sb-line p-8 text-center text-sm text-sb-muted">{EMPTY[tab]}</p>
      ) : null}
      {docs.map((doc) => (
        <MemberDocCard
          key={doc.id}
          doc={doc}
          href={docHref(doc.id)}
          actions={tab === 'todo' ? memberActions(doc, unitIds) : null}
          busy={busyId === doc.id}
          onQuickClose={() => {
            if (!confirm('ทราบและจบเรื่อง — จบแล้วเปิดกลับไม่ได้ ยืนยัน?')) return;
            void run(doc, () => memberAnnotate(doc, { note: 'ทราบ', route: { kind: 'close' } }, as), 'จบเรื่องแล้ว');
          }}
          onQuickAck={(unitId) => void run(doc, () => memberAck(doc, unitId, as), 'บันทึกว่าทราบแล้ว')}
        />
      ))}
      {docs.length < total ? (
        <button type="button" onClick={() => void list.setSize(list.size + 1)} className="h-11 rounded-xl border border-sb-line bg-white text-sm font-semibold text-sb-ink-2">
          โหลดเพิ่ม
        </button>
      ) : null}
    </MemberShell>
  );
}

/** dev-open เท่านั้น — ทุกคนคือผู้ใช้คนเดียว เลือกตำแหน่งที่จะสวมเพื่อทดสอบ (สเปกรอบ 3 ข้อ 2) */
function DevUnitPicker() {
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  return (
    <div className="rounded-2xl border border-sb-line bg-white p-4">
      <p className="mb-3 text-sm text-sb-muted">โหมดทดสอบ (dev-open): เลือกตำแหน่งที่จะสวม</p>
      <div className="flex flex-wrap gap-2">
        {(units ?? []).filter((u) => u.isActive).map((u) => (
          <Link key={u.id} href={`/saraban/me?as=${encodeURIComponent(u.id)}`} className="inline-flex h-10 items-center rounded-full border border-sb-line px-4 text-sm hover:bg-sb-hover">
            {u.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

export const getServerSideProps = getSarabanMemberSsrProps;
export default withMemberGuard(MyWorkPage);
