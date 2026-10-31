// ชิ้นส่วนร่วมของหน้าจอสารบรรณ — ค่าสี/ขนาดตาม handoff § Design Tokens
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import { buildMonthGrid, shiftMonth, THAI_DOW, THAI_MONTHS, todayInBangkok } from '@/lib/calendar-grid';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { LEVEL_LABELS, statusLabel } from '@/lib/saraban-labels';
import { fileSizeLabel, isoToThaiInput, parseThaiInput, precheckFile, thaiDate, thaiDateTime } from '@/lib/saraban-view';
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

/**
 * ช่องวันที่ปฏิทินไทย — พิมพ์ 'วว/ดด/ปปปป' (พ.ศ.) หรือกดเลือกจากปฏิทิน · ค่าที่ส่งออกเป็น ISO ค.ศ. เสมอ
 * <input type="date"> แสดงตามภาษาของเครื่อง บังคับเป็นปี พ.ศ. ไม่ได้ จึงทำเอง
 * พิมพ์ไม่ครบหรือผิด → ส่ง '' ให้ฟอร์ม (ถือว่ายังไม่กรอก) แต่ข้อความที่พิมพ์ยังอยู่ให้แก้ต่อ
 */
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
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => isoToThaiInput(value));
  const [emitted, setEmitted] = useState(value);
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);

  // ค่าจากข้างนอกเปลี่ยน (เช่น "วันนี้" มาถึงหลังโหลด หรือฟอร์มถูกล้าง) → แสดงตาม
  // ปรับ state ระหว่าง render ตามแนวที่ React แนะนำ ไม่ใช่ใน effect
  if (value !== emitted) {
    setEmitted(value);
    setText(isoToThaiInput(value));
  }

  function emit(iso: string) {
    setEmitted(iso);
    onChange(iso);
  }

  function type(next: string) {
    setText(next);
    const parsed = parseThaiInput(next);
    emit(parsed.ok ? parsed.iso : '');
  }

  function pick(iso: string) {
    setText(isoToThaiInput(iso));
    setTouched(false);
    setOpen(false);
    emit(iso);
  }

  // ปิดปฏิทินเมื่อคลิกนอกกล่องหรือกด Esc — setState อยู่ใน callback ของ event ไม่ใช่ตัว effect
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const parsed = parseThaiInput(text);
  const problem = touched && !parsed.ok ? parsed.error : '';

  return (
    <div ref={box} className="relative flex flex-col gap-1.5 text-[13px] font-medium text-sb-ink">
      <label htmlFor={id}>
        {label}
        {required ? <span className="text-sb-danger"> *</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`${inputClass} pr-11 ${problem ? 'border-sb-danger' : ''}`}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="วว/ดด/ปปปป เช่น 31/10/2569"
          value={text}
          onChange={(e) => type(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={problem ? true : undefined}
        />
        <button
          type="button"
          aria-label={`เลือก${label}จากปฏิทิน`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-sb-muted hover:bg-sb-hover hover:text-sb-accent"
        >
          <Icon name="calendar_month" size={20} />
        </button>
      </div>
      {problem ? <span className="text-xs font-normal text-sb-danger">{problem}</span> : null}
      {open ? <ThaiCalendar value={parsed.ok ? parsed.iso : ''} onPick={pick} /> : null}
    </div>
  );
}

/** ปฏิทินไทยของ DateField — เดือนไทย ปี พ.ศ. สัปดาห์เริ่มวันจันทร์ตาม buildMonthGrid ของปฏิทินงาน */
function ThaiCalendar({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const today = todayInBangkok();
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const year = Number(month.slice(0, 4));
  const monthNo = Number(month.slice(5, 7));
  const thisYear = Number(today.slice(0, 4));
  // ย้อนหลัง 10 ปีพอสำหรับหนังสือเก่า เดินหน้า 1 ปีสำหรับกำหนดแล้วเสร็จ · ปีที่เลือกอยู่ต้องอยู่ในรายการเสมอ
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 10 + i);
  if (!years.includes(year)) years.push(year);
  years.sort((a, b) => a - b);
  const select = 'rounded-lg border border-sb-line-input bg-white px-2 py-1 text-[13px]';

  return (
    <div
      role="dialog"
      aria-label="ปฏิทิน"
      className="absolute left-0 top-full z-30 mt-1 w-[300px] rounded-xl border border-sb-line bg-white p-3 font-normal shadow-[0_8px_24px_rgba(0,0,0,.12)]"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <button type="button" aria-label="เดือนก่อน" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg p-1 text-sb-muted hover:bg-sb-hover">
          <Icon name="chevron_left" size={20} />
        </button>
        <select aria-label="เดือน" className={`${select} flex-1`} value={monthNo} onChange={(e) => setMonth(`${year}-${e.target.value.padStart(2, '0')}`)}>
          {THAI_MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="ปี พ.ศ." className={select} value={year} onChange={(e) => setMonth(`${e.target.value}-${month.slice(5, 7)}`)}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y + 543}
            </option>
          ))}
        </select>
        <button type="button" aria-label="เดือนถัดไป" onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg p-1 text-sb-muted hover:bg-sb-hover">
          <Icon name="chevron_right" size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {THAI_DOW.map((d) => (
          <span key={d} className="py-1 text-sb-muted">
            {d}
          </span>
        ))}
        {buildMonthGrid(year, monthNo)
          .flat()
          .map((cell) => {
            const selected = cell.date === value;
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                type="button"
                aria-label={thaiDate(cell.date)}
                aria-pressed={selected}
                onClick={() => onPick(cell.date)}
                className={`h-8 rounded-lg text-[13px] ${
                  selected
                    ? 'bg-sb-accent font-semibold text-white'
                    : `${cell.inMonth ? 'text-sb-ink' : 'text-sb-muted/50'} hover:bg-sb-accent-light ${isToday ? 'font-semibold ring-1 ring-sb-accent' : ''}`
                }`}
              >
                {Number(cell.date.slice(8))}
              </button>
            );
          })}
      </div>
      <div className="mt-2 flex justify-between border-t border-sb-line pt-2 text-[13px]">
        <button type="button" onClick={() => onPick(today)} className="rounded-lg px-2 py-1 font-medium text-sb-accent hover:bg-sb-accent-light">
          วันนี้
        </button>
        <button type="button" onClick={() => onPick('')} className="rounded-lg px-2 py-1 text-sb-muted hover:bg-sb-hover">
          ล้าง
        </button>
      </div>
    </div>
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
