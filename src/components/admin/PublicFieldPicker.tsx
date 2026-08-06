import { useState } from 'react';
import Icon from '@/components/Icon';
import type { FieldStat } from '@/types/map';

// ฟิลด์ที่ชื่อเข้าข่ายข้อมูลส่วนบุคคล — เป็นตัวช่วยเตือน ไม่ใช่ตัวบังคับ คนตัดสิน
// ยังเป็นเจ้าหน้าที่ ครอบคลุมแบบหลวม ๆ ไว้ก่อนดีกว่าพลาด เพราะราคาของการเตือนเกิน
// คือความรำคาญ ส่วนราคาของการพลาดคือข้อมูลชาวบ้านขึ้นอินเทอร์เน็ต
const PII_PATTERNS = [
  /^own_/i, // ที่อยู่ของเจ้าของแปลง
  /chanod/i, // เลขโฉนด
  /parcel_no/i,
  /survey_no/i,
  /land_no/i,
  /phone|tel|mobile/i,
  /name|owner/i,
  /id_?card|citizen/i,
];

export function looksLikePii(field: string): boolean {
  return PII_PATTERNS.some((re) => re.test(field));
}

export default function PublicFieldPicker({
  fields,
  value,
  featureCount,
  disabled,
  onChange,
}: {
  fields: FieldStat[];
  value: string[];
  featureCount: number;
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const selected = new Set(value);

  function toggle(name: string) {
    if (selected.has(name)) {
      onChange(value.filter((v) => v !== name));
      return;
    }
    // การเปิดฟิลด์ที่เข้าข่าย PII ต้องยืนยันอีกครั้ง — การติ๊กพลาดหนึ่งครั้งที่นี่
    // คือข้อมูลของชาวบ้านทั้งตำบลขึ้นอินเทอร์เน็ต
    if (looksLikePii(name)) {
      setConfirming(name);
      return;
    }
    onChange([...value, name]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[13px] font-semibold text-ink">
          ฟิลด์ที่เปิดเผยต่อสาธารณะ
        </h3>
        <p className="text-[11.5px] text-ink-mute">
          เลือกไว้ {value.length} จาก {fields.length} ฟิลด์ · ที่ไม่ได้ติ๊กจะไม่ออกไปกับไฟล์สาธารณะ
        </p>
      </div>

      <ul className="mt-2 divide-y divide-black/[0.06] rounded-xl border border-black/[0.07]">
        {fields.map((f) => {
          const pii = looksLikePii(f.name);
          const on = selected.has(f.name);
          return (
            <li key={f.name} className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                id={`pf-${f.name}`}
                checked={on}
                disabled={disabled}
                onChange={() => toggle(f.name)}
                className="h-4 w-4 shrink-0 accent-green"
              />
              <label
                htmlFor={`pf-${f.name}`}
                className="min-w-0 flex-1 cursor-pointer text-[12.5px]"
              >
                <span className="font-medium text-ink">{f.name}</span>
                <span className="ml-2 text-[11px] text-ink-mute">
                  กรอก {f.filled.toLocaleString('th-TH')}/
                  {featureCount.toLocaleString('th-TH')} · ค่าไม่ซ้ำ {f.distinct}
                </span>
              </label>
              {pii ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700">
                  <Icon name="warning" size={13} />
                  ข้อมูลส่วนบุคคล
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {confirming ? (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3">
          <p className="font-display text-[12.5px] font-semibold text-red-800">
            ยืนยันการเปิด “{confirming}” สู่สาธารณะ
          </p>
          <p className="mt-1 text-[12px] leading-normal text-red-700">
            ฟิลด์นี้มีลักษณะเป็นข้อมูลส่วนบุคคล เมื่อเผยแพร่แล้วใครก็ตามบนอินเทอร์เน็ต
            จะดาวน์โหลดค่านี้ของทุกรายการไปได้ทันที
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 font-display text-[12px] font-medium text-ink-soft"
            >
              ไม่เปิด
            </button>
            <button
              type="button"
              onClick={() => {
                onChange([...value, confirming]);
                setConfirming(null);
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 font-display text-[12px] font-semibold text-white"
            >
              เข้าใจแล้ว เปิดเลย
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
