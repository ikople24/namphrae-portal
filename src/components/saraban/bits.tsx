// ชิ้นส่วนร่วมของหน้าจอสารบรรณ — ค่าสี/ขนาดตาม handoff § Design Tokens
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { LEVEL_LABELS, statusLabel } from '@/lib/saraban-labels';
import { dateHint, fileSizeLabel, precheckFile, thaiDateTime } from '@/lib/saraban-view';
import type { DisplayStatus, SarabanLevel, SarabanRegister } from '@/types/saraban';

const STATUS_TONE: Record<DisplayStatus, string> = {
  pending: 'bg-sb-warning-bg text-sb-warning-ink',
  'in-progress': 'bg-sb-accent-light text-sb-accent',
  done: 'bg-sb-success-bg text-sb-success',
  void: 'bg-sb-subtle text-sb-muted',
  overdue: 'bg-sb-danger-bg text-sb-danger',
};

export function StatusPill({ register, status }: { register: SarabanRegister; status: DisplayStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${STATUS_TONE[status]}`}>
      {statusLabel(register, status)}
    </span>
  );
}

const LEVEL_TONE: Record<SarabanLevel, string> = {
  normal: 'text-sb-muted',
  urgent: 'text-sb-warning',
  'very-urgent': 'text-sb-danger',
  'most-urgent': 'text-sb-danger',
};

export function LevelText({ level }: { level: SarabanLevel }) {
  return <span className={`text-xs font-semibold ${LEVEL_TONE[level]}`}>{LEVEL_LABELS[level]}</span>;
}

export const inputClass =
  'w-full rounded-[10px] border border-sb-line-input bg-white px-3 py-2.5 text-sm text-sb-ink disabled:bg-sb-panel disabled:text-sb-muted';
export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-sb-accent px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-sb-accent-hover disabled:opacity-60';
export const outlineButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-sb-line bg-white px-[18px] py-2.5 text-sm text-sb-ink hover:bg-sb-hover disabled:opacity-60';
export const card = 'rounded-2xl border border-sb-line bg-white';

export function Field({
  label,
  required,
  children,
  hint,
  warn,
  wide,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  warn?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-[13px] font-medium text-sb-ink ${wide ? 'sm:col-span-2' : ''}`}>
      <span>
        {label}
        {required ? <span className="text-sb-danger"> *</span> : null}
      </span>
      {children}
      {hint ? <span className={`text-xs font-normal ${warn ? 'text-sb-danger' : 'text-sb-muted'}`}>{hint}</span> : null}
    </label>
  );
}

/** ช่องวันที่พร้อมป้าย พ.ศ. ใต้ช่อง (dateHint) */
export function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const hint = dateHint(value);
  return (
    <Field label={label} required={required} hint={hint.text} warn={hint.warn}>
      <input type="date" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/**
 * เลือกไฟล์แนบ: ลากวาง หรือกดเลือกหลายไฟล์ · ไฟล์อยู่ในเบราว์เซอร์จนกว่าจะกดบันทึก (สเปกข้อ 5)
 * precheckFile กันไฟล์ที่ไม่ผ่านแน่ ๆ ตั้งแต่ตอนเลือก
 */
export function FilePicker({
  files,
  onChange,
  max = MAX_FILES_PER_DOC,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const bad = picked.map(precheckFile).filter((p): p is string => p !== null);
    const good = picked.filter((f) => precheckFile(f) === null);
    const next = [...files, ...good].slice(0, max);
    if (files.length + good.length > max) bad.push(`แนบได้ไม่เกิน ${max} ไฟล์`);
    setProblems(bad);
    onChange(next);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) add(e.dataTransfer.files);
      }}
      className={`rounded-xl border-[1.5px] border-dashed px-5 py-[22px] text-center text-[13px] text-sb-muted ${
        over ? 'border-sb-accent bg-sb-accent-light' : 'border-[#C4CDD8] bg-[#FAFBFD]'
      }`}
    >
      <p className="font-semibold text-sb-ink">แนบไฟล์หนังสือ (PDF / สแกน)</p>
      <p>
        ลากไฟล์มาวาง หรือ{' '}
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="font-medium text-sb-accent hover:underline">
          เลือกไฟล์
        </button>{' '}
        · PDF, JPG, PNG ไม่เกิน 10 MB · สูงสุด {max} ไฟล์
      </p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      {files.length > 0 ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-2 rounded-lg border border-sb-line bg-white px-2.5 py-1.5 text-sb-ink">
              <Icon name="attach_file" size={16} />
              {f.name}
              <span className="text-sb-muted">{fileSizeLabel(f.size)}</span>
              <button
                type="button"
                aria-label={`เอา ${f.name} ออก`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-sb-muted hover:text-sb-danger"
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {problems.length > 0 ? (
        <ul className="mt-2 text-xs text-sb-danger">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// นาฬิกาเป็น external store: ตอน SSR ได้ '' (ไม่ให้เซิร์ฟเวอร์กับเบราว์เซอร์วาดเวลาต่างกัน) แล้วเดินทุก 30 วินาที
function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}
const clockLabel = () => thaiDateTime(new Date().toISOString());
const serverClockLabel = () => '';

/** วันเวลาปัจจุบันแบบ '13 ก.ย. 2569 09:42' — ใช้บนตราลงรับตัวอย่าง */
export function useNowLabel(): string {
  return useSyncExternalStore(subscribeClock, clockLabel, serverClockLabel);
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] bg-sb-danger-bg px-3.5 py-2.5 text-[13px] text-sb-danger">{children}</div>;
}
