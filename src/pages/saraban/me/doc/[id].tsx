// หน้าหนังสือของเจ้าตัว (สเปกรอบ 3 ข้อ 4 · ต้นแบบ B) — ดู · ประวัติย่อ · ดำเนินการในจอเดียว
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Icon from '@/components/Icon';
import type { AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import DocViewer from '@/components/saraban/DocViewer';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import MemberActionForm from '@/components/saraban/MemberActionForm';
import MemberShell from '@/components/saraban/MemberShell';
import { LevelText, StatusPill } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getSarabanMemberSsrProps } from '@/lib/auth-server';
import {
  clearMemberLists,
  memberAck,
  memberAnnotate,
  messageOf,
  revalidateSaraban,
  sarabanFetcher,
  SarabanApiError,
  type MemberDocResponse,
} from '@/lib/saraban-api';
import { EVENT_KIND_LABELS } from '@/lib/saraban-labels';
import type { SarabanMark } from '@/types/saraban';
import { memberDocKey, memberFileUrl, thaiDate, thaiDateTime, withAs, withRaw } from '@/lib/saraban-view';

function MemberDocPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const as = typeof router.query.as === 'string' ? router.query.as : undefined;
  const home = withAs('/saraban/me', as);
  const { data, error, mutate } = useSWR<MemberDocResponse>(id ? memberDocKey(id, as) : null, sarabanFetcher, {
    shouldRetryOnError: false,
  });
  const { mutate: globalMutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  // ร่างตรา/ลายมืออยู่ที่หน้า — stale/not_holder แล้ว refetch ของที่วาดไว้ไม่หาย
  const [marks, setMarks] = useState<SarabanMark[]>([]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      showToast(done);
      // ล้างแคชทั้งแบบธรรมดาและ infinite ก่อนกลับ ไม่งั้นรายการเห็นของเก่า
      await Promise.all([revalidateSaraban(globalMutate), clearMemberLists(globalMutate, as)]);
      await router.push(home);
    } catch (err) {
      showToast(messageOf(err));
      // not_holder / stale: หนังสือเปลี่ยนไปแล้ว โหลดใหม่ การ์ดดำเนินการจะหายเองถ้าไม่ใช่ของเราแล้ว
      if (err instanceof SarabanApiError) void mutate();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <MemberShell title="หนังสือ" canFull={false} back={home}>
        <p className="rounded-2xl border border-sb-line bg-white p-6 text-center text-sm text-sb-muted">{messageOf(error)}</p>
      </MemberShell>
    );
  }
  if (!data) {
    return (
      <MemberShell title="หนังสือ" canFull={false} back={home}>
        <p className="p-6 text-center text-sm text-sb-muted">กำลังโหลด…</p>
      </MemberShell>
    );
  }

  const { doc, actions, units } = data;
  const holderName = units.find((u) => u.id === doc.holderUnitId)?.name ?? doc.holderUnitId;
  const events = [...doc.events].reverse();

  return (
    <MemberShell title={`รับที่ ${doc.no}`} canFull={data.canReceive} back={home}>
      <section className="rounded-2xl border border-sb-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-sb-muted">
          <span>{doc.ref}</span>
          <span>{thaiDate(doc.docDate)}</span>
          {doc.level !== 'normal' ? <LevelText level={doc.level} /> : null}
          <span className="flex-1" />
          <StatusPill register={doc.register} status={doc.status} />
        </div>
        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug">{doc.subject}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-sb-muted">จาก</dt>
          <dd>{doc.party}</dd>
          <dt className="text-sb-muted">อยู่กับ</dt>
          <dd>{holderName}</dd>
          {doc.dueDate ? (
            <>
              <dt className="text-sb-muted">กำหนดแล้วเสร็จ</dt>
              <dd>{thaiDate(doc.dueDate)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {doc.files.length ? (
        <section className="overflow-hidden rounded-2xl border border-sb-line bg-white" aria-label="เอกสาร">
          <DocViewer
            files={doc.files}
            events={doc.events}
            rawUrl={(fileId) => withRaw(memberFileUrl(doc.id, fileId, as))}
            openUrl={(fileId) => memberFileUrl(doc.id, fileId, as)}
            tools={actions.annotateAs ? 'stamp+ink' : 'none'}
            draft={marks}
            onDraftChange={setMarks}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-sb-line bg-white p-4" aria-label="ที่ผ่านมา">
        <h3 className="mb-2 text-sm font-semibold">ที่ผ่านมา</h3>
        <ol className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id} className="border-l-2 border-[#C9E3D5] pl-3">
              <p className="text-xs text-sb-muted">
                {thaiDateTime(e.at)} · {eventByline(e)}
              </p>
              <p className="text-[13px] font-semibold">{EVENT_KIND_LABELS[e.kind]}</p>
              {e.note ? <p className="text-[13px]">{e.note}</p> : null}
              <EventDetail event={e} />
            </li>
          ))}
        </ol>
      </section>

      {actions.annotateAs ? (
        <MemberActionForm
          key={doc.id}
          doc={doc}
          units={units}
          busy={busy}
          onSubmit={(body: AnnotateSubmit) =>
            void run(
              () => memberAnnotate(doc, { ...body, marks }, as),
              `${body.route.kind === 'close' ? 'จบเรื่องแล้ว' : body.route.kind === 'forward' ? 'ส่งต่อแล้ว' : 'แจ้งเวียนแล้ว'}${body.sign ? ' · ลงนามในระบบแล้ว' : ''}`
            )
          }
        />
      ) : null}

      {actions.ackUnitIds.map((unitId) => (
        <button
          key={unitId}
          type="button"
          disabled={busy}
          onClick={() => void run(() => memberAck(doc, unitId, as), 'บันทึกว่าทราบแล้ว')}
          className="flex h-[52px] items-center justify-center gap-1.5 rounded-xl bg-sb-success text-base font-semibold text-white disabled:opacity-50"
        >
          <Icon name="check" size={20} />
          ทราบ (แจ้งเวียนถึง {doc.circulation.find((c) => c.unitId === unitId)?.unitName ?? unitId})
        </button>
      ))}
    </MemberShell>
  );
}

export const getServerSideProps = getSarabanMemberSsrProps;
export default withMemberGuard(MemberDocPage);
