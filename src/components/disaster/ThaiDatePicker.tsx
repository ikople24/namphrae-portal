import { useEffect, useMemo, useRef, useState } from 'react';
import { parseThaiDate } from '@/lib/thai-date';
import { THAI_MONTH_NAMES, THAI_WEEKDAY_HEADERS, formatThaiDate, monthMatrix } from '@/lib/thai-calendar';

export default function ThaiDatePicker({
  value, onChange, fallbackYearBE,
}: {
  value: string;
  onChange: (dateText: string, yearBE: number) => void;
  fallbackYearBE: number;
}) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseThaiDate(value), [value]);
  const [viewYearBE, setViewYearBE] = useState(parsed ? parsed.getUTCFullYear() + 543 : fallbackYearBE);
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getUTCMonth() : 0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Opening the panel re-syncs its view to the current value.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ซิงก์มุมมองปฏิทินกับค่า value ตอนเปิด ไม่ใช่ pattern derive-during-render
      setViewYearBE(parsed ? parsed.getUTCFullYear() + 543 : fallbackYearBE);
      setViewMonth(parsed ? parsed.getUTCMonth() : 0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selectedDay =
    parsed && parsed.getUTCFullYear() + 543 === viewYearBE && parsed.getUTCMonth() === viewMonth
      ? parsed.getUTCDate() : null;

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYearBE((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYearBE((y) => y + 1); } else setViewMonth((m) => m + 1); };

  const weeks = monthMatrix(viewYearBE, viewMonth);
  const trigger = 'w-full rounded-xl border-[1.5px] border-line px-3 py-2.5 text-left text-sm outline-none focus:border-green-deep';

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={trigger}>
        {value || <span className="text-ink-mute">เลือกวันที่</span>}
      </button>
      {open && (
        <div className="absolute z-[60] mt-1 w-[260px] rounded-xl border border-line bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-1">
            <button type="button" onClick={() => setViewYearBE((y) => y - 1)} className="px-1 text-ink-faint" aria-label="ปีก่อนหน้า">«</button>
            <button type="button" onClick={prevMonth} className="px-1 text-ink-faint" aria-label="เดือนก่อนหน้า">‹</button>
            <div className="flex-1 text-center text-[13px] font-semibold text-ink">{THAI_MONTH_NAMES[viewMonth]} {viewYearBE}</div>
            <button type="button" onClick={nextMonth} className="px-1 text-ink-faint" aria-label="เดือนถัดไป">›</button>
            <button type="button" onClick={() => setViewYearBE((y) => y + 1)} className="px-1 text-ink-faint" aria-label="ปีถัดไป">»</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-ink-mute">
            {THAI_WEEKDAY_HEADERS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[12.5px]">
            {weeks.map((week, wi) => week.map((d, di) => d === null
              ? <div key={`${wi}-${di}`} />
              : (
                <button key={`${wi}-${di}`} type="button"
                  onClick={() => { onChange(formatThaiDate(viewYearBE, viewMonth, d), viewYearBE); setOpen(false); }}
                  className={`rounded py-1.5 ${d === selectedDay ? 'bg-green-deep font-semibold text-white' : 'text-ink hover:bg-surface-sunken'}`}>
                  {d}
                </button>
              )))}
          </div>
          <div className="mt-2 flex justify-between">
            <button type="button" onClick={() => { onChange('', viewYearBE); setOpen(false); }} className="text-[11.5px] text-ink-faint">ล้าง</button>
            <button type="button" onClick={() => setOpen(false)} className="text-[11.5px] font-medium text-green-deep">ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}
