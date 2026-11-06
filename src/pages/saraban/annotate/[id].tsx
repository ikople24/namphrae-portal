// หน้าเกษียน (สเปกรอบ 2 ข้อ 5 · ต้นแบบจอ 5) — ซ้าย "เอกสาร": DocViewer วางตราได้ (สเปกรอบ 4 — ลายมือ/
// ลงนามต้องเป็นเจ้าตัวในงานของฉัน ธุรการทำแทนได้แค่ตรา) · ขวา: ประวัติเกษียน + ฟอร์มสั่งการ
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Icon from '@/components/Icon';
import DocViewer from '@/components/saraban/DocViewer';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import AnnotateForm, { type AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import { ErrorBox, StatusPill, card } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  annotateDoc,
  docKey,
  fileUrl,
  messageOf,
  sarabanFetcher,
  SarabanApiError,
  revalidateSaraban,
  clearMemberLists,
  SUMMARY_KEY,
  UNITS_KEY,
  type SummaryResponse,
} from '@/lib/saraban-api';
import { displayStatus } from '@/lib/saraban-doc';
import { canAnnotate } from '@/lib/saraban-flow';
import { formatNo } from '@/lib/saraban-number';
import { thaiDateTime, withRaw } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanMark, SarabanUnit } from '@/types/saraban';

// อักษรแรกของชื่อสำหรับวงกลมอวาตาร์ — ข้ามสระนำ เ แ โ ใ ไ ที่ไม่ควรเป็นตัวแทนชื่อ
function initialOf(name: string): string {
  return Array.from(name).find((c) => !'เแโใไ'.includes(c)) ?? name.slice(0, 1);
}

function AnnotatePage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: doc, error, mutate } = useSWR<SarabanDoc>(id ? docKey(id) : null, sarabanFetcher);
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const { mutate: globalMutate } = useSWRConfig();
  // สำเร็จแล้วเปลี่ยน key เพื่อล้างฟอร์ม (ไม่ผูกกับ updatedAt เพราะ refetch ตอน stale จะล้างตัวเลือกที่กรอกไว้)
  const [formKey, setFormKey] = useState(0);
  // ร่างตราอยู่ที่หน้า (ไม่อยู่ใน viewer) — 409 stale แล้ว refetch ตราที่วางไว้ต้องไม่หาย เหมือน note
  const [marks, setMarks] = useState<SarabanMark[]>([]);

  if (error) {
    return (
      <SarabanLayout title="เกษียนหนังสือ">
        <ErrorBox>{messageOf(error)}</ErrorBox>
      </SarabanLayout>
    );
  }
  if (!doc) {
    return (
      <SarabanLayout title="เกษียนหนังสือ">
        <p className="text-[13px] text-sb-muted">กำลังโหลด…</p>
      </SarabanLayout>
    );
  }

  // GET /units คืนตามลำดับที่ตั้งแล้ว (listUnits เรียงด้วย byUnitOrder ฝั่งเซิร์ฟเวอร์)
  const active = (units ?? []).filter((u) => u.isActive);
  const holderName = units?.find((u) => u.id === doc.holderUnitId)?.name ?? '—';
  const status = summary?.today ? displayStatus(doc, summary.today) : doc.status;
  const annotations = doc.events.filter((e) => e.kind === 'annotated');

  async function submit(body: AnnotateSubmit) {
    if (!doc) return;
    setBusy(true);
    try {
      const updated = await annotateDoc(doc, { ...body, marks });
      setMarks([]);
      setNote('');
      setFormKey((k) => k + 1);
      // ทะเบียน/รายการค้าง/ตัวเลขสรุปต้องตามสถานะใหม่
      void globalMutate(SUMMARY_KEY);
      void globalMutate((k) => typeof k === 'string' && k.startsWith('/api/admin/saraban/docs?'));
      // โหมดเจ้าหน้าที่ (งานของฉัน) เห็นเรื่องเดียวกัน — ล้างแคชของมันด้วย
      void revalidateSaraban(globalMutate);
      void clearMemberLists(globalMutate, undefined);
      const no = formatNo(doc.register, doc.no);
      if (body.route.kind === 'stay') {
        await mutate(updated, { revalidate: false });
        showToast(`บันทึกเกษียนรับที่ ${no} แล้ว`);
      } else {
        const toName = active.find((u) => body.route.kind === 'forward' && u.id === body.route.toUnitId)?.name;
        showToast(body.route.kind === 'forward' ? `รับที่ ${no} ส่งต่อ ${toName} แล้ว` : `รับที่ ${no} จบเรื่องแล้ว`);
        await router.push('/saraban/inbox');
      }
    } catch (err) {
      showToast(messageOf(err));
      // stale: โหลดฉบับล่าสุด — note อยู่ใน state ของหน้า ข้อความที่พิมพ์ไว้จึงไม่หาย
      if (err instanceof SarabanApiError && err.code === 'stale') await mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SarabanLayout title="เกษียนหนังสือ">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/saraban/inbox" className="text-[13px] text-sb-muted hover:text-sb-accent">
          ‹ กลับทะเบียน
        </Link>
        <Link href={`/saraban/track/${doc.id}`} className="text-[13px] text-sb-accent hover:underline">
          ติดตาม
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold">
            รับที่ {formatNo(doc.register, doc.no)} · {doc.subject}
          </h2>
          <p className="mt-0.5 text-[13px] text-sb-muted">
            จาก {doc.party} · ที่ {doc.ref} · อยู่กับ: <span className="font-medium text-sb-ink">{holderName}</span>
          </p>
        </div>
        <StatusPill register={doc.register} status={status} />
      </div>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <section className={`${card} overflow-hidden`}>
          <DocViewer
            files={doc.files}
            events={doc.events}
            rawUrl={(fileId) => withRaw(fileUrl(doc.id, fileId))}
            openUrl={(fileId) => fileUrl(doc.id, fileId)}
            tools={canAnnotate(doc) ? 'stamp' : 'none'}
            draft={marks}
            onDraftChange={setMarks}
          />
        </section>

        <section className={`${card} flex flex-col gap-4 p-[22px]`}>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Icon name="assignment" size={18} />
            บันทึกเกษียน/สั่งการ
          </h3>
          {annotations.length === 0 ? (
            <p className="text-[13px] text-sb-muted">ยังไม่มีการเกษียน</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {annotations.map((ev) => (
                <li key={ev.id} className="flex gap-2.5">
                  <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-sb-accent-light text-xs font-semibold text-sb-accent">
                    {initialOf(ev.onBehalfName ?? ev.byName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-[13px] font-semibold">{eventByline(ev)}</p>
                      <p className="text-xs text-sb-muted">{thaiDateTime(ev.at)}</p>
                    </div>
                    <p className="mt-1 rounded-lg bg-sb-panel px-3 py-2 text-[13px] leading-normal">{ev.note}</p>
                    <EventDetail event={ev} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canAnnotate(doc) ? (
            <div className="border-t border-sb-line pt-4">
              <p className="mb-3 text-xs text-sb-muted">บันทึกในนาม {holderName}</p>
              <AnnotateForm key={formKey} doc={doc} units={active} busy={busy} note={note} onNoteChange={setNote} onSubmit={submit} />
            </div>
          ) : (
            <p className="rounded-[10px] bg-sb-panel px-3 py-2 text-[13px] text-sb-muted">
              {doc.register !== 'in'
                ? 'เกษียนได้เฉพาะหนังสือรับ'
                : doc.status === 'done'
                  ? 'เรื่องนี้จบแล้ว'
                  : 'เลขทะเบียนนี้ถูกยกเลิกแล้ว'}
            </p>
          )}
        </section>
      </div>
    </SarabanLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(AnnotatePage);
