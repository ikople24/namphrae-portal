// ลงรับหนังสือ (สเปกข้อ 6 "/saraban/receive") — ฟอร์มถือไฟล์ไว้จนกดบันทึก แล้วอัปทีละไฟล์ก่อนส่งข้อมูล
// id สร้างครั้งเดียวต่อฟอร์ม (idempotency key): เน็ตหลุดแล้วกดซ้ำได้หนังสือเดิม ไม่ได้เลขที่สอง
import { useRouter } from 'next/router';
import { useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { DateField, ErrorBox, Field, FilePicker, card, inputClass, outlineButton, primaryButton, useNowLabel } from '@/components/saraban/bits';
import { flashToast, useToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  createDoc,
  messageOf,
  sarabanFetcher,
  setStartNo,
  SUMMARY_KEY,
  UNITS_KEY,
  uploadAll,
  yearKey,
  type SummaryResponse,
  type YearInfo,
} from '@/lib/saraban-api';
import { LEVEL_LABELS } from '@/lib/saraban-labels';
import { formatNo } from '@/lib/saraban-number';
import { SARABAN_LEVELS, type SarabanLevel, type SarabanUnit } from '@/types/saraban';

const EMPTY = { ref: '', docDate: '', party: '', subject: '', level: 'normal' as SarabanLevel, holderUnitId: '', dueDate: '' };

function ReceivePage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [startNo, setStart] = useState('');
  const now = useNowLabel();
  const id = useRef<string | null>(null);

  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: year, mutate: reloadYear } = useSWR<YearInfo>(yearKey('in'), sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  const active = (units ?? []).filter((u) => u.isActive);
  // เสนอถึงปลัดเป็นค่าเริ่มต้น (สเปกข้อ 6) — ถ้าปลัดถูกปิดใช้หน่วยแรกที่เปิดอยู่ · คำนวณจากข้อมูล
  // ไม่ตั้งใน effect (ผู้ใช้ยังไม่เลือก = form.holderUnitId ว่าง)
  const holderUnitId = form.holderUnitId || ((active.find((u) => u.id === 'palad') ?? active[0])?.id ?? '');
  const holder = active.find((u) => u.id === holderUnitId);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const missing = [
      !form.ref.trim() && 'ที่หนังสือ',
      !form.docDate && 'ลงวันที่',
      !form.party.trim() && 'จาก',
      !form.subject.trim() && 'เรื่อง',
      !holderUnitId && 'เสนอถึง',
    ].filter(Boolean);
    if (missing.length > 0) return setError(`กรุณากรอก ${missing.join(' · ')}`);
    setError('');
    id.current ??= crypto.randomUUID();
    try {
      setBusy(files.length > 0 ? `กำลังอัปไฟล์ 0/${files.length}` : 'กำลังบันทึก…');
      const refs = await uploadAll(files, (done) => setBusy(`กำลังอัปไฟล์ ${done}/${files.length}`));
      setBusy('กำลังบันทึก…');
      const doc = await createDoc('receive', { id: id.current, ...form, holderUnitId, files: refs });
      flashToast(`ลงรับที่ ${formatNo('in', doc.no)} แล้ว · เสนอ${holder?.name ?? ''}`);
      await router.push('/saraban/inbox');
    } catch (err) {
      setError(messageOf(err));
      setBusy('');
    }
  }

  async function saveStartNo() {
    if (!year) return;
    try {
      await setStartNo({ register: 'in', fiscalYear: year.fiscalYear, startNo: Number(startNo) });
      await reloadYear();
      setStart('');
      toast(`ตั้งเลขเริ่มต้นปีงบ ${year.fiscalYear} แล้ว`);
    } catch (err) {
      toast(messageOf(err));
    }
  }

  const nextNo = year ? formatNo('in', year.nextNo) : '—';

  return (
    <SarabanLayout title="ลงรับหนังสือ">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <form onSubmit={submit} className={`${card} flex flex-col gap-4 p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">ลงรับหนังสือใหม่</h2>
            <p className="text-[13px] text-sb-muted">
              เลขรับถัดไป <b className="text-sb-accent">{nextNo}</b>
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="ที่หนังสือ" required>
              <input className={inputClass} maxLength={100} placeholder="เช่น ชม 0023.1/ว 1245" value={form.ref} onChange={(e) => set('ref')(e.target.value)} />
            </Field>
            <DateField label="ลงวันที่" required value={form.docDate} onChange={set('docDate')} />
            <Field label="จาก (หน่วยงาน)" required wide>
              <input className={inputClass} maxLength={200} placeholder="ชื่อหน่วยงานผู้ส่ง" value={form.party} onChange={(e) => set('party')(e.target.value)} />
            </Field>
            <Field label="เรื่อง" required wide>
              <input className={inputClass} maxLength={500} placeholder="ชื่อเรื่องตามหนังสือ" value={form.subject} onChange={(e) => set('subject')(e.target.value)} />
            </Field>
            <Field label="ชั้นความเร็ว">
              <select className={inputClass} value={form.level} onChange={(e) => set('level')(e.target.value)}>
                {SARABAN_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="เสนอถึง" required>
              <select className={inputClass} value={holderUnitId} onChange={(e) => set('holderUnitId')(e.target.value)}>
                {active.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <DateField label="กำหนดแล้วเสร็จ (ถ้ามี)" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <p className="text-xs text-sb-muted">
            หนังสือชั้นลับขึ้นไปให้ดำเนินการนอกระบบตามระเบียบว่าด้วยการรักษาความลับของทางราชการ
          </p>
          {summary?.storageConfigured === false ? (
            <p className="rounded-xl bg-sb-subtle px-4 py-3 text-[13px] text-sb-muted">ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — แนบไฟล์ไม่ได้ (ลงรับได้ตามปกติ)</p>
          ) : (
            <FilePicker files={files} onChange={setFiles} disabled={Boolean(busy)} />
          )}
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <div className="flex items-center justify-end gap-2.5">
            {busy ? <span className="mr-auto text-[13px] text-sb-muted">{busy}</span> : null}
            <button type="button" className={outlineButton} disabled={Boolean(busy)} onClick={() => router.push('/saraban/inbox')}>
              ยกเลิก
            </button>
            <button type="submit" className={primaryButton} disabled={Boolean(busy)}>
              ลงรับและเสนอ
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3.5">
          <div className={`${card} p-5`}>
            <h3 className="mb-2.5 font-semibold">ตัวอย่างตราลงรับ</h3>
            <div className="max-w-[280px] rounded-lg border-2 border-sb-accent px-3.5 py-3 text-[13px] font-medium leading-relaxed text-sb-accent">
              <p className="font-bold">เทศบาลตำบลน้ำแพร่พัฒนา</p>
              <p>
                เลขรับ <b>{nextNo}</b>
              </p>
              <p>วันที่ {now || '—'}</p>
              <p>เสนอ {holder?.name ?? '—'}</p>
            </div>
            <p className="mt-2.5 text-xs text-sb-muted">
              เลขรับเป็นการคาดเดา — ถ้ามีคนลงรับตัดหน้า เลขจริงคือเลขที่แจ้งหลังบันทึก
            </p>
          </div>
          <div className="rounded-2xl bg-sb-success-bg px-5 py-[18px] text-[13px] leading-relaxed text-sb-success-ink">
            <p className="text-sm font-bold">ลงรับแบบไร้กระดาษ</p>
            หนังสือที่แนบไฟล์และเสนอผ่านระบบไม่ต้องพิมพ์สำเนา และจะเข้าสถิติลดกระดาษจากจำนวนหน้าจริงของไฟล์
          </div>
          {year && year.count === 0 ? (
            <div className={`${card} flex flex-col gap-2.5 p-5`}>
              <h3 className="flex items-center gap-1.5 font-semibold">
                <Icon name="tag" size={18} />
                ตั้งเลขเริ่มต้นปีงบ {year.fiscalYear}
              </h3>
              <p className="text-xs text-sb-muted">
                ใช้เมื่อเริ่มใช้ระบบกลางปี — ใส่เลขถัดจากเลขล่าสุดของทะเบียนกระดาษ ตั้งได้เฉพาะตอนปีนี้ยังไม่มีหนังสือ
              </p>
              <div className="flex gap-2">
                <input type="number" min={1} className={inputClass} placeholder="เช่น 422" value={startNo} onChange={(e) => setStart(e.target.value)} />
                <button type="button" className={outlineButton} disabled={!startNo || Number(startNo) < 1} onClick={saveStartNo}>
                  ตั้งค่า
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </SarabanLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(ReceivePage);
