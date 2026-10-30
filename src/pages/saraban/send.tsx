// ออกเลขหนังสือส่ง/เวียน (สเปกข้อ 6 "/saraban/send" — handoff ไม่มีจอนี้) — จบที่ "ที่ …" ตัวใหญ่
// เพราะเจ้าหน้าที่ต้องได้เลขก่อนถึงจะพิมพ์ลงหนังสือได้ ไม่ใช่จบที่ทะเบียน
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { DateField, ErrorBox, Field, FilePicker, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import { createDoc, messageOf, sarabanFetcher, SUMMARY_KEY, UNITS_KEY, uploadAll, type SummaryResponse } from '@/lib/saraban-api';
import { LEVEL_LABELS } from '@/lib/saraban-labels';
import { formatNo } from '@/lib/saraban-number';
import { SARABAN_LEVELS, type SarabanDoc, type SarabanLevel, type SarabanUnit } from '@/types/saraban';

// docDate: null = ผู้ใช้ยังไม่แตะ → ใช้วันนี้ (today ของเซิร์ฟเวอร์) · '' = ผู้ใช้ลบเอง
const EMPTY = {
  ownerUnitId: '',
  circular: false,
  docDate: null as string | null,
  party: '',
  subject: '',
  level: 'normal' as SarabanLevel,
};

function SendPage() {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [issued, setIssued] = useState<SarabanDoc | null>(null);
  const id = useRef<string | null>(null);

  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  // ออกเลขได้เฉพาะหน่วยที่มีรหัสส่วนราชการ — ระบบประกอบ "ที่" จากรหัสนี้ (composeRef)
  const owners = (units ?? []).filter((u) => u.isActive && u.refCode);
  // ค่าเริ่มต้นคำนวณจากข้อมูล ไม่ตั้งใน effect — เจ้าของเรื่อง = หน่วยแรกที่มีรหัส · ลงวันที่ = วันนี้
  // (หนังสือส่งลงวันที่วันที่ออกเลข)
  const ownerUnitId = form.ownerUnitId || (owners[0]?.id ?? '');
  const docDate = form.docDate ?? summary?.today ?? '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const missing = [
      !ownerUnitId && 'ส่วนราชการเจ้าของเรื่อง',
      !docDate && 'ลงวันที่',
      !form.party.trim() && 'ถึง',
      !form.subject.trim() && 'เรื่อง',
    ].filter(Boolean);
    if (missing.length > 0) return setError(`กรุณากรอก ${missing.join(' · ')}`);
    setError('');
    id.current ??= crypto.randomUUID();
    try {
      setBusy(files.length > 0 ? `กำลังอัปไฟล์ 0/${files.length}` : 'กำลังออกเลข…');
      const refs = await uploadAll(files, (done) => setBusy(`กำลังอัปไฟล์ ${done}/${files.length}`));
      setBusy('กำลังออกเลข…');
      setIssued(await createDoc('send', { id: id.current, ...form, ownerUnitId, docDate, files: refs }));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy('');
    }
  }

  function again() {
    id.current = null;
    setIssued(null);
    setFiles([]);
    setForm({ ...EMPTY, ownerUnitId: form.ownerUnitId, circular: form.circular });
  }

  if (issued) {
    return (
      <SarabanLayout title="ออกเลขหนังสือส่ง">
        <div className={`${card} mx-auto flex w-full max-w-xl flex-col items-center gap-4 p-8 text-center`}>
          <p className="text-[13px] text-sb-muted">
            ออกเลข{issued.register === 'circular' ? 'หนังสือเวียน' : 'หนังสือส่ง'}แล้ว · เลขทะเบียน {formatNo(issued.register, issued.no)}
          </p>
          <p className="text-4xl font-bold text-sb-accent">ที่ {issued.ref}</p>
          <p className="text-sm">{issued.subject}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              className={outlineButton}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issued.ref);
                  showToast('คัดลอกเลขที่หนังสือแล้ว');
                } catch {
                  showToast('คัดลอกไม่ได้ — เลือกข้อความแล้วคัดลอกเอง');
                }
              }}
            >
              <Icon name="content_copy" size={18} />
              คัดลอก
            </button>
            <Link href="/saraban/outbox" className={outlineButton}>
              ไปทะเบียนส่ง
            </Link>
            <button type="button" className={primaryButton} onClick={again}>
              ออกเลขอีกฉบับ
            </button>
          </div>
        </div>
      </SarabanLayout>
    );
  }

  return (
    <SarabanLayout title="ออกเลขหนังสือส่ง">
      <form onSubmit={submit} className={`${card} flex max-w-3xl flex-col gap-4 p-6`}>
        <h2 className="text-base font-semibold">ออกเลขหนังสือส่ง / หนังสือเวียน</h2>
        {units && owners.length === 0 ? (
          <ErrorBox>ยังไม่มีส่วนราชการที่มีรหัสส่วนราชการ — ตั้งรหัสที่หน้า “สมุดผู้รับ” ก่อน</ErrorBox>
        ) : null}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="ส่วนราชการเจ้าของเรื่อง" required>
            <select className={inputClass} value={ownerUnitId} onChange={(e) => setForm({ ...form, ownerUnitId: e.target.value })}>
              {owners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.refCode})
                </option>
              ))}
            </select>
          </Field>
          <DateField label="ลงวันที่" required value={docDate} onChange={(value) => setForm({ ...form, docDate: value })} />
          <label className="flex items-center gap-2 text-[13px] font-medium sm:col-span-2">
            <input type="checkbox" checked={form.circular} onChange={(e) => setForm({ ...form, circular: e.target.checked })} />
            หนังสือเวียน (ใช้ชุดเลข “ว” แยกจากหนังสือส่ง)
          </label>
          <Field label="ถึง" required wide>
            <input className={inputClass} maxLength={200} placeholder="ผู้รับหนังสือ" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} />
          </Field>
          <Field label="เรื่อง" required wide>
            <input className={inputClass} maxLength={500} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <Field label="ชั้นความเร็ว">
            <select className={inputClass} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as SarabanLevel })}>
              {SARABAN_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {summary?.storageConfigured === false ? null : <FilePicker files={files} onChange={setFiles} disabled={Boolean(busy)} />}
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div className="flex items-center justify-end gap-2.5">
          {busy ? <span className="mr-auto text-[13px] text-sb-muted">{busy}</span> : null}
          <button type="submit" className={primaryButton} disabled={Boolean(busy) || owners.length === 0}>
            <Icon name="tag" size={18} />
            ออกเลข
          </button>
        </div>
      </form>
    </SarabanLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(SendPage);
