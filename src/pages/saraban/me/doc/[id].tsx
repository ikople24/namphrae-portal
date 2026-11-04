// หน้าหนังสือของเจ้าตัว (สเปกรอบ 3 ข้อ 4 · ต้นแบบ B) — ดู · ประวัติย่อ · ดำเนินการในจอเดียว
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import type { AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import MemberActionForm from '@/components/saraban/MemberActionForm';
import MemberShell from '@/components/saraban/MemberShell';
import { LevelText, StatusPill } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getSarabanMemberSsrProps } from '@/lib/auth-server';
import {
  memberAck,
  memberAnnotate,
  messageOf,
  sarabanFetcher,
  SarabanApiError,
  type MemberDocResponse,
} from '@/lib/saraban-api';
import { EVENT_KIND_LABELS } from '@/lib/saraban-labels';
import { memberDocKey, memberFileUrl, thaiDate, thaiDateTime, withAs } from '@/lib/saraban-view';

function MemberDocPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const as = typeof router.query.as === 'string' ? router.query.as : undefined;
  const home = withAs('/saraban/me', as);
  const { data, error, mutate } = useSWR<MemberDocResponse>(id ? memberDocKey(id, as) : null, sarabanFetcher, {
    shouldRetryOnError: false,
  });
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      showToast(done);
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
    <MemberShell title={`รับที่ ${doc.no}`} canFull={false} back={home}>
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
        {doc.files.length ? (
          <div className="mt-3 flex flex-col gap-1.5">
            {doc.files.map((f) => (
              <a
                key={f.id}
                href={memberFileUrl(doc.id, f.id, as)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-sb-line px-3 text-sm hover:bg-sb-hover"
              >
                <Icon name="attach_file" size={18} />
                <span className="truncate">{f.name}</span>
              </a>
            ))}
          </div>
        ) : null}
      </section>

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
          doc={doc}
          units={units}
          busy={busy}
          onSubmit={(body: AnnotateSubmit) =>
            void run(
              () => memberAnnotate(doc, body, as),
              body.route.kind === 'close' ? 'จบเรื่องแล้ว' : body.route.kind === 'forward' ? 'ส่งต่อแล้ว' : 'แจ้งเวียนแล้ว'
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
