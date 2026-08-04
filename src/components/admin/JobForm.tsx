import { useState } from 'react';
import { useRouter } from 'next/router';
import { createCalendarJob, updateCalendarJob } from '@/lib/admin-api';
import { jobInputSchema, type JobInput } from '@/lib/schema';
import { todayInBangkok } from '@/lib/calendar-grid';
import { JOB_KIND_COLOR, JOB_KIND_LABEL, type JobKind } from '@/types/portal';

const EMPTY: JobInput = {
  kind: 'ems',
  date: '',
  time: '',
  title: '',
  village: '',
  origin: '',
  destination: '',
  phone: '',
  note: '',
};

export default function JobForm({
  mode,
  jobId,
  initial,
}: {
  mode: 'new' | 'edit';
  jobId?: string;
  initial?: JobInput;
}) {
  const router = useRouter();
  const [form, setForm] = useState<JobInput>({
    ...EMPTY,
    date: todayInBangkok(),
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);

    const parsed = jobInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'new') {
        const { lineNotified } = await createCalendarJob(parsed.data);
        if (!lineNotified) {
          // งานถูกบันทึกแล้ว บอกตรง ๆ ว่าอะไรสำเร็จอะไรไม่สำเร็จ
          setWarning('บันทึกงานแล้ว แต่ส่งแจ้งเตือน LINE ไม่สำเร็จ');
          setSaving(false);
          return;
        }
      } else if (jobId) {
        await updateCalendarJob(jobId, parsed.data);
      }
      router.push('/admin/calendar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-300/60 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
          {warning}{' '}
          <button
            type="button"
            onClick={() => router.push('/admin/calendar')}
            className="font-semibold underline"
          >
            ไปหน้ารายการ
          </button>
        </p>
      ) : null}

      <fieldset className="mb-4">
        <legend className="mb-1.5 block font-display text-[13px] font-medium text-ink-soft">
          ประเภทงาน
        </legend>
        <div className="flex gap-2">
          {(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((kind) => (
            <label
              key={kind}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] transition ${
                form.kind === kind
                  ? 'border-green bg-green-050 font-medium text-green-deep'
                  : 'border-black/[0.12] text-ink-soft hover:bg-black/[0.03]'
              }`}
            >
              <input
                type="radio"
                name="kind"
                className="sr-only"
                checked={form.kind === kind}
                onChange={() => set('kind', kind)}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: JOB_KIND_COLOR[kind] }}
              />
              {JOB_KIND_LABEL[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="วันที่ *">
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="เวลา *">
          <input
            type="time"
            required
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field label={form.kind === 'ems' ? 'ชื่อผู้ป่วย *' : 'ชื่องาน *'}>
          <input
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={
              form.kind === 'ems' ? 'สมชาย ใจดี' : 'ตัดต้นไม้ล้มขวางถนน'
            }
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field label="หมู่บ้าน / พื้นที่">
          <input
            value={form.village}
            onChange={(e) => set('village', e.target.value)}
            placeholder="ม.3 ต.น้ำแพร่"
            className={INPUT}
          />
          <p className="mt-1 text-[11.5px] text-ink-faint">
            ช่องนี้แสดงบนปฏิทินสาธารณะ — ช่องอื่นที่เหลือเห็นเฉพาะเจ้าหน้าที่
          </p>
        </Field>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="ต้นทาง">
          <input
            value={form.origin}
            onChange={(e) => set('origin', e.target.value)}
            placeholder="บ้านที่อาศัย"
            className={INPUT}
          />
        </Field>
        <Field label="ปลายทาง">
          <input
            value={form.destination}
            onChange={(e) => set('destination', e.target.value)}
            placeholder="รพ.สวนดอก"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field label="เบอร์โทรติดต่อ">
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="0812345678"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-6">
        <Field label="หมายเหตุ">
          <textarea
            rows={3}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-green px-5 py-2.5 font-display text-[14px] font-semibold text-white transition hover:bg-green-deep disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก…' : mode === 'new' ? 'บันทึกและแจ้งกลุ่ม' : 'บันทึกการแก้ไข'}
      </button>
    </form>
  );
}

const INPUT =
  'w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-green';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-[13px] font-medium text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
