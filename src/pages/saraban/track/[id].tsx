// หน้าติดตามหนังสือ (สเปกรอบ 2 ข้อ 5 · ต้นแบบจอ 6) — ข้อมูล · ไฟล์แนบ · แก้ไข/ยกเลิก/ส่งแล้ว ·
// เส้นทางหนังสือจาก events · ทุกปุ่มโชว์ตามฟังก์ชันของ 1A (editableFieldsOf / canVoid / canMarkSent /
// canAddFile / canRemoveFile / canReopen) ที่ API ใช้ตัดสินจริง หน้าจอกับเซิร์ฟเวอร์จึงเห็นตรงกัน
// ผู้จัดการ (จาก /api/admin/me แบบหน้าสมุดผู้รับ) แก้หนังสือรับที่จบแล้วได้ และดึงเรื่องกลับได้
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { DateField, ErrorBox, Field, LevelText, StatusPill, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import CirculationCard from '@/components/saraban/CirculationCard';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import FlowSteps from '@/components/saraban/FlowSteps';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { adminFetcher } from '@/lib/admin-api';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  ackCirculation,
  addDocFile,
  docKey,
  fileUrl,
  messageOf,
  patchDoc,
  removeDocFile,
  sarabanFetcher,
  SarabanApiError,
  revalidateSaraban,
  clearMemberLists,
  SUMMARY_KEY,
  UNITS_KEY,
  uploadFile,
  type DocListResponse,
  type SummaryResponse,
} from '@/lib/saraban-api';
import { canAnnotate, flowStep } from '@/lib/saraban-flow';
import { isFileReferenced } from '@/lib/saraban-mark';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { canAddFile, canMarkSent, canRemoveFile, canReopen, canVoid, displayStatus, editableFieldsOf, type DocEdit, type EditableField } from '@/lib/saraban-doc';
import { EVENT_KIND_LABELS, fieldLabel, LEVEL_LABELS, SEND_METHOD_LABELS } from '@/lib/saraban-labels';
import { formatNo } from '@/lib/saraban-number';
import { changeValue, docsKey, fileSizeLabel, precheckFile, thaiDate, thaiDateTime } from '@/lib/saraban-view';
import { SARABAN_LEVELS, SEND_METHODS, type SarabanDoc, type SarabanUnit, type SendMethod } from '@/types/saraban';

const NO_PREFIX = { in: 'รับที่', out: 'ส่งที่', circular: 'เวียนที่' } as const;
type Panel = 'none' | 'edit' | 'void' | 'sent' | 'reopen';

function TrackPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: doc, error, mutate } = useSWR<SarabanDoc>(id ? docKey(id) : null, sarabanFetcher);
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  const { data: me } = useSWR<{ isManager: boolean }>('/api/admin/me', adminFetcher, { revalidateOnFocus: false });
  const isManager = me?.isManager === true;
  // รายการซ้าย: หนังสือรับที่ยังเปิดอยู่ทุกปีงบ (หน้าแรก 50 เรื่อง) — ซ่อนบนจอแคบ
  const { data: openList } = useSWR<DocListResponse>(docsKey({ register: 'in', scope: 'open' }), sarabanFetcher);
  const { mutate: globalMutate } = useSWRConfig();
  const [panel, setPanel] = useState<Panel>('none');
  // Pages Router ใช้ instance เดิมเมื่อ [id] เปลี่ยน (กดสลับจากรายการซ้าย) — ถ้าไม่รีเซ็ต แผงแก้ไขที่เปิดค้างจะ
  // ถือค่าของเรื่องก่อนหน้าแล้วไปบันทึกทับอีกเรื่อง
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setPanel('none');
  }
  const [busy, setBusy] = useState(false);

  const unitName = (unitId: string) => units?.find((u) => u.id === unitId)?.name ?? '—';

  // stale = มีคนแก้ไปก่อน — โหลดฉบับล่าสุดให้เลย ผู้ใช้จะได้เห็นว่าเปลี่ยนอะไร
  async function run(action: () => Promise<SarabanDoc>, done: string) {
    setBusy(true);
    try {
      await mutate(await action(), { revalidate: false });
      setPanel('none');
      showToast(done);
      // รายการซ้าย ทะเบียนทุกหน้า และตัวเลขสรุปต้องตามสถานะใหม่ — ทุก key ของรายการขึ้นต้นด้วย docs?
      // (รวม scope=open) predicate เดียวกับหน้าเกษียน
      void globalMutate((k) => typeof k === 'string' && k.startsWith('/api/admin/saraban/docs?'));
      void globalMutate(SUMMARY_KEY);
      // โหมดเจ้าหน้าที่ (งานของฉัน) เห็นเรื่องเดียวกัน — ล้างแคชของมันด้วย
      void revalidateSaraban(globalMutate);
      void clearMemberLists(globalMutate, undefined);
    } catch (err) {
      showToast(messageOf(err));
      if (err instanceof SarabanApiError && err.code === 'stale') await mutate();
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(list: FileList | null) {
    if (!doc || !list) return;
    const picked = Array.from(list).slice(0, MAX_FILES_PER_DOC - doc.files.length);
    const bad = picked.map(precheckFile).find((p) => p !== null);
    if (bad) return showToast(bad);
    setBusy(true);
    try {
      for (const file of picked) {
        const { key } = await uploadFile(file);
        await mutate(await addDocFile(doc.id, { key, name: file.name }), { revalidate: false });
      }
      showToast(`แนบไฟล์แล้ว ${picked.length} ไฟล์`);
    } catch (err) {
      showToast(messageOf(err));
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <SarabanLayout title="หนังสือ">
        <ErrorBox>{messageOf(error)}</ErrorBox>
      </SarabanLayout>
    );
  }
  if (!doc) {
    return (
      <SarabanLayout title="หนังสือ">
        <p className="text-[13px] text-sb-muted">กำลังโหลด…</p>
      </SarabanLayout>
    );
  }

  const today = summary?.today;
  const status = today ? displayStatus(doc, today) : doc.status;
  const step = flowStep(doc);
  const editable = editableFieldsOf(doc, { isManager });
  const storageOn = summary?.storageConfigured !== false;
  const back = doc.register === 'in' ? '/saraban/inbox' : '/saraban/outbox';

  return (
    <SarabanLayout title={`${NO_PREFIX[doc.register]} ${formatNo(doc.register, doc.no)}`}>
      <Link href={back} className="self-start text-[13px] text-sb-muted hover:text-sb-accent">
        ‹ กลับทะเบียน
      </Link>

      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${card} hidden max-h-[80vh] overflow-y-auto p-2 xl:block`} aria-label="หนังสือที่ยังเปิดอยู่">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold text-sb-muted">หนังสือรับที่ยังเปิดอยู่</p>
          {!openList ? (
            <p className="px-2 text-[13px] text-sb-muted">กำลังโหลด…</p>
          ) : openList.docs.length ? (
            openList.docs.map((d) => (
              <Link
                key={d.id}
                href={`/saraban/track/${d.id}`}
                className={`mb-1 block rounded-[10px] border px-3 py-2 text-[13px] ${
                  d.id === doc.id ? 'border-sb-accent bg-sb-accent-light' : 'border-transparent hover:bg-sb-hover'
                }`}
              >
                <span className="text-xs font-semibold text-sb-accent">รับที่ {formatNo(d.register, d.no)}</span>
                <span className="block truncate">{d.subject}</span>
              </Link>
            ))
          ) : (
            <p className="px-2 text-[13px] text-sb-muted">ไม่มีหนังสือค้าง</p>
          )}
        </aside>

        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5">
            <section className={`${card} p-[22px]`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-sb-muted">
                    {NO_PREFIX[doc.register]} {formatNo(doc.register, doc.no)} · ปีงบ {doc.fiscalYear} · ที่ {doc.ref || '—'}
                  </p>
                  <h2 className="mt-0.5 text-[17px] font-bold">{doc.subject}</h2>
                  <p className="mt-0.5 text-[13px] text-sb-muted">
                    {doc.register === 'in' ? 'จาก' : 'ถึง'} {doc.party} · ลงวันที่ {thaiDate(doc.docDate)}
                  </p>
                </div>
                <StatusPill register={doc.register} status={status} />
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-sb-muted">ชั้นความเร็ว</dt>
                  <dd>
                    <LevelText level={doc.level} />
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-sb-muted">{doc.register === 'in' ? 'อยู่กับ' : 'เจ้าของเรื่อง'}</dt>
                  <dd>{unitName(doc.holderUnitId)}</dd>
                </div>
                {doc.register === 'in' ? (
                  <div className="flex gap-2">
                    <dt className="text-sb-muted">กำหนดแล้วเสร็จ</dt>
                    <dd>{doc.dueDate ? thaiDate(doc.dueDate) : 'ไม่กำหนด'}</dd>
                  </div>
                ) : null}
                {doc.sendMethod ? (
                  <div className="flex gap-2">
                    <dt className="text-sb-muted">วิธีส่ง</dt>
                    <dd>{SEND_METHOD_LABELS[doc.sendMethod]}</dd>
                  </div>
                ) : null}
                {doc.voidReason ? (
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="text-sb-muted">เหตุที่ยกเลิก</dt>
                    <dd className="text-sb-danger">{doc.voidReason}</dd>
                  </div>
                ) : null}
              </dl>
              {step ? <FlowSteps step={step} overdue={status === 'overdue'} /> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {canAnnotate(doc) ? (
                  <Link href={`/saraban/annotate/${doc.id}`} className={primaryButton}>
                    <Icon name="assignment" size={18} />
                    เกษียน
                  </Link>
                ) : null}
                {editable.length > 0 ? (
                  <button type="button" className={outlineButton} disabled={busy} onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}>
                    <Icon name="edit" size={18} />
                    แก้ไข
                  </button>
                ) : null}
                {canMarkSent(doc) ? (
                  <button type="button" className={outlineButton} disabled={busy} onClick={() => setPanel(panel === 'sent' ? 'none' : 'sent')}>
                    <Icon name="send" size={18} />
                    บันทึกว่าส่งแล้ว
                  </button>
                ) : null}
                {isManager && canReopen(doc) ? (
                  <button type="button" className={outlineButton} disabled={busy} onClick={() => setPanel(panel === 'reopen' ? 'none' : 'reopen')}>
                    <Icon name="history" size={18} />
                    ดึงเรื่องกลับ
                  </button>
                ) : null}
                {canVoid(doc) ? (
                  <button
                    type="button"
                    className={`${outlineButton} text-sb-danger`}
                    disabled={busy}
                    onClick={() => setPanel(panel === 'void' ? 'none' : 'void')}
                  >
                    <Icon name="block" size={18} />
                    ยกเลิกเลขทะเบียน
                  </button>
                ) : null}
              </div>
            </section>

            {panel === 'edit' ? (
              <EditPanel
                key={doc.id}
                doc={doc}
                fields={editable}
                units={(units ?? []).filter((u) => u.isActive || u.id === doc.holderUnitId)}
                busy={busy}
                onCancel={() => setPanel('none')}
                onSave={(edit) => run(() => patchDoc(doc.id, { action: 'edit', updatedAt: doc.updatedAt, edit }), 'บันทึกการแก้ไขแล้ว')}
              />
            ) : null}
            {panel === 'void' ? (
              <VoidPanel key={doc.id} busy={busy} onCancel={() => setPanel('none')} onSave={(reason) => run(() => patchDoc(doc.id, { action: 'void', updatedAt: doc.updatedAt, reason }), 'ยกเลิกเลขทะเบียนแล้ว')} />
            ) : null}
            {panel === 'reopen' ? (
              <ReopenPanel
                key={doc.id}
                holder={unitName(doc.holderUnitId)}
                busy={busy}
                onCancel={() => setPanel('none')}
                onSave={(reason) => run(() => patchDoc(doc.id, { action: 'reopen', updatedAt: doc.updatedAt, reason }), 'ดึงเรื่องกลับแล้ว')}
              />
            ) : null}
            {panel === 'sent' ? (
              <SentPanel key={doc.id} busy={busy} onCancel={() => setPanel('none')} onSave={(method) => run(() => patchDoc(doc.id, { action: 'sent', updatedAt: doc.updatedAt, method }), 'บันทึกว่าส่งแล้ว')} />
            ) : null}

            <CirculationCard
              doc={doc}
              busy={busy}
              onAck={(unitId) => {
                const name = doc.circulation.find((c) => c.unitId === unitId)?.unitName ?? unitId;
                void run(() => ackCirculation(doc, unitId), `บันทึกว่า ${name} ทราบแล้ว`);
              }}
            />

            <section className={`${card} p-[22px]`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">ไฟล์แนบ ({doc.files.length})</h3>
                {storageOn && canAddFile(doc) && doc.files.length < MAX_FILES_PER_DOC ? (
                  <label className={`${outlineButton} cursor-pointer px-3 py-1.5 text-[13px]`}>
                    <Icon name="upload_file" size={18} />
                    เพิ่มไฟล์
                    <input
                      type="file"
                      multiple
                      hidden
                      disabled={busy}
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {doc.files.length === 0 ? (
                <p className="text-[13px] text-sb-muted">ยังไม่มีไฟล์แนบ</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {doc.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-[10px] border border-sb-line px-3 py-2 text-[13px]">
                      <Icon name="attach_file" size={18} className="text-sb-muted" />
                      <a href={fileUrl(doc.id, f.id)} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-medium text-sb-accent hover:underline">
                        {f.name}
                      </a>
                      <span className="whitespace-nowrap text-xs text-sb-muted">
                        {f.format.toUpperCase()} · {fileSizeLabel(f.bytes)}
                        {f.format === 'pdf' && f.pages > 0 ? ` · ${f.pages} หน้า` : ''}
                      </span>
                      {canRemoveFile(doc) && !isFileReferenced(doc, f.id) ? (
                        <button
                          type="button"
                          aria-label={`ลบ ${f.name}`}
                          disabled={busy}
                          className="text-sb-muted hover:text-sb-danger"
                          onClick={() => {
                            if (confirm(`ลบไฟล์ “${f.name}” ออกจากหนังสือนี้?`)) {
                              void run(() => removeDocFile(doc.id, f.id), 'ลบไฟล์แนบแล้ว');
                            }
                          }}
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={`${card} p-[22px]`}>
            <h3 className="mb-3.5 flex items-center gap-1.5 font-semibold">
              <Icon name="history" size={18} />
              เส้นทางหนังสือ
            </h3>
            {doc.events.map((ev, i) => (
              <div key={ev.id} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <div
                    className={`mt-[3px] h-3.5 w-3.5 flex-none rounded-full border-[3px] bg-white ${
                      i === doc.events.length - 1 ? 'border-sb-accent' : 'border-sb-success'
                    }`}
                  />
                  {i < doc.events.length - 1 ? <div className="w-0.5 flex-1 bg-[#C9E3D5]" /> : null}
                </div>
                <div className="flex-1 pb-[18px]">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold">{EVENT_KIND_LABELS[ev.kind]}</p>
                    <p className="text-xs text-sb-muted">{thaiDateTime(ev.at)}</p>
                  </div>
                  <p className="mt-0.5 text-[13px] text-sb-muted">{eventByline(ev)}</p>
                  <EventDetail event={ev} />
                  {ev.note ? <p className="mt-1.5 rounded-lg bg-sb-panel px-3 py-2 text-[13px] leading-normal">{ev.note}</p> : null}
                  {ev.changes?.length ? (
                    <ul className="mt-1.5 flex flex-col gap-0.5 rounded-lg bg-sb-panel px-3 py-2 text-[13px]">
                      {ev.changes.map((c) => (
                        <li key={c.field}>
                          <span className="text-sb-muted">{fieldLabel(doc.register, c.field)}:</span> {changeValue(c.field, c.from)} → {changeValue(c.field, c.to)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </SarabanLayout>
  );
}

function EditPanel({
  doc,
  fields,
  units,
  busy,
  onCancel,
  onSave,
}: {
  doc: SarabanDoc;
  fields: readonly EditableField[];
  units: SarabanUnit[];
  busy: boolean;
  onCancel: () => void;
  onSave: (edit: DocEdit) => void;
}) {
  const [values, setValues] = useState<Record<EditableField, string>>({
    ref: doc.ref,
    docDate: doc.docDate,
    party: doc.party,
    subject: doc.subject,
    level: doc.level,
    dueDate: doc.dueDate,
    holderUnitId: doc.holderUnitId,
  });
  const has = (f: EditableField) => fields.includes(f);
  const set = (f: EditableField) => (v: string) => setValues({ ...values, [f]: v });

  function submit(e: FormEvent) {
    e.preventDefault();
    // ส่งเฉพาะช่องที่แก้ได้ในสถานะนี้ — buildEdit ฝั่งเซิร์ฟเวอร์ข้ามช่องที่ค่าไม่เปลี่ยนเอง
    const edit = Object.fromEntries(fields.map((f) => [f, values[f].trim()])) as DocEdit;
    onSave(edit);
  }

  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-3.5 p-[22px]`}>
      <h3 className="font-semibold">แก้ไขข้อมูลหนังสือ</h3>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {has('ref') ? (
          <Field label={fieldLabel(doc.register, 'ref')}>
            <input className={inputClass} maxLength={100} value={values.ref} onChange={(e) => set('ref')(e.target.value)} />
          </Field>
        ) : null}
        {has('docDate') ? <DateField label="ลงวันที่" value={values.docDate} onChange={set('docDate')} /> : null}
        {has('party') ? (
          <Field label={fieldLabel(doc.register, 'party')} wide>
            <input className={inputClass} maxLength={200} value={values.party} onChange={(e) => set('party')(e.target.value)} />
          </Field>
        ) : null}
        {has('subject') ? (
          <Field label="เรื่อง" wide>
            <input className={inputClass} maxLength={500} value={values.subject} onChange={(e) => set('subject')(e.target.value)} />
          </Field>
        ) : null}
        {has('level') ? (
          <Field label="ชั้นความเร็ว">
            <select className={inputClass} value={values.level} onChange={(e) => set('level')(e.target.value)}>
              {SARABAN_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {has('holderUnitId') ? (
          <Field label="เสนอถึง">
            <select className={inputClass} value={values.holderUnitId} onChange={(e) => set('holderUnitId')(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {has('dueDate') ? <DateField label="กำหนดแล้วเสร็จ (ว่าง = ไม่กำหนด)" value={values.dueDate} onChange={set('dueDate')} /> : null}
      </div>
      <p className="text-xs text-sb-muted">เลขทะเบียน ทะเบียน และปีงบแก้ไม่ได้ทุกกรณี · ถ้าเลขผิดให้ยกเลิกแล้วลงทะเบียนใหม่</p>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="submit" className={primaryButton} disabled={busy}>
          บันทึก
        </button>
      </div>
    </form>
  );
}

function VoidPanel({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className={`${card} flex flex-col gap-3 border-sb-danger/30 p-[22px]`}>
      <h3 className="font-semibold text-sb-danger">ยกเลิกเลขทะเบียน</h3>
      <p className="text-[13px] text-sb-muted">เลขที่ยกเลิกแล้วไม่ถูกนำกลับมาใช้ และหนังสือยังอยู่ในทะเบียนพร้อมเหตุผล — ย้อนกลับไม่ได้</p>
      <Field label="เหตุผล" required>
        <textarea className={inputClass} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ไม่ยกเลิก
        </button>
        <button
          type="button"
          className="rounded-[10px] bg-sb-danger px-[18px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || !reason.trim()}
          onClick={() => onSave(reason.trim())}
        >
          ยืนยันยกเลิก
        </button>
      </div>
    </div>
  );
}

function ReopenPanel({
  holder,
  busy,
  onCancel,
  onSave,
}: {
  holder: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className={`${card} flex flex-col gap-3 p-[22px]`}>
      <h3 className="font-semibold">ดึงเรื่องกลับ</h3>
      <p className="text-[13px] text-sb-muted">หนังสือจะกลับเป็น “ดำเนินการ” ที่ {holder} และบันทึกเหตุผลไว้ในเส้นทางหนังสือ</p>
      <Field label="เหตุผล" required>
        <textarea className={inputClass} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="button" className={primaryButton} disabled={busy || !reason.trim()} onClick={() => onSave(reason.trim())}>
          ยืนยันดึงเรื่องกลับ
        </button>
      </div>
    </div>
  );
}

function SentPanel({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (method: SendMethod) => void }) {
  const [method, setMethod] = useState<SendMethod>('system');
  return (
    <div className={`${card} flex flex-col gap-3 p-[22px]`}>
      <h3 className="font-semibold">บันทึกว่าส่งแล้ว</h3>
      <Field label="วิธีส่ง">
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as SendMethod)}>
          {SEND_METHODS.map((m) => (
            <option key={m} value={m}>
              {SEND_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="button" className={primaryButton} disabled={busy} onClick={() => onSave(method)}>
          <Icon name="check" size={18} />
          บันทึก
        </button>
      </div>
    </div>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(TrackPage);
