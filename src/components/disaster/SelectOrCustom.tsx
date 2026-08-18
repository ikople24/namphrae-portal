import { useState } from 'react';
import { isCustomValue } from '@/lib/disaster-options';

const CUSTOM = '__custom__';

export default function SelectOrCustom({
  options, value, onChange, placeholder,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fld = 'w-full rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm outline-none focus:border-green-deep';
  const [customMode, setCustomMode] = useState(false);

  // ไม่มีตัวเลือก → ช่องพิมพ์ล้วน (เช่น ที่อยู่ อุทกภัย/ภัยแล้ง)
  if (options.length === 0) {
    return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={fld} />;
  }

  const custom = customMode || isCustomValue(value, options);
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) { setCustomMode(true); onChange(''); }
          else { setCustomMode(false); onChange(e.target.value); }
        }}
        className={fld}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={CUSTOM}>อื่นๆ (พิมพ์เอง)</option>
      </select>
      {custom && (
        <input autoFocus value={value} placeholder={placeholder ?? 'พิมพ์เอง…'}
          onChange={(e) => onChange(e.target.value)} className={fld} />
      )}
    </div>
  );
}
