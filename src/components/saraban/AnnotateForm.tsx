// ฟอร์มบันทึกเกษียน/สั่งการ (ต้นแบบจอ 5 ด้านขวา) — ธุรการพิมพ์คำสั่งในนามตำแหน่งที่หนังสืออยู่
// ตัดสินจริงที่ annotateTransition ฝั่งเซิร์ฟเวอร์ ฟอร์มนี้แค่ไม่ให้เลือกสิ่งที่รู้ว่าผิดแน่
// (ปลายทาง = ที่อยู่ปัจจุบัน · ตำแหน่งที่เวียนไปแล้ว)
import { useState, type FormEvent } from 'react';
import Icon from '@/components/Icon';
import { Field, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { MAX_CIRCULATE, type AnnotateRoute } from '@/lib/saraban-flow';
import { QUICK_NOTES, ROUTE_LABELS } from '@/lib/saraban-labels';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

// sign: เฉพาะโหมดงานของฉัน (MemberActionForm) — ฟอร์มโหมดเต็มไม่ส่ง
export type AnnotateSubmit = { note: string; route: AnnotateRoute; circulateTo: string[]; sign?: boolean };

const STAY = '__stay';
const CLOSE = '__close';

export default function AnnotateForm({
  doc,
  units,
  busy,
  note,
  onNoteChange,
  onSubmit,
}: {
  doc: SarabanDoc;
  units: SarabanUnit[]; // active เรียงตาม order แล้ว
  busy: boolean;
  // ข้อความยกขึ้นไปเก็บที่หน้า — 409 stale แล้ว refetch ข้อความที่พิมพ์ไว้ต้องไม่หาย (สเปกรอบ 2 ข้อ 6)
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: (body: AnnotateSubmit) => void;
}) {
  const [rawTarget, setTarget] = useState<string>(STAY);
  const [circulating, setCirculating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const already = new Set(doc.circulation.map((c) => c.unitId));
  const choosable = units.filter((u) => !already.has(u.id));
  const targets = units.filter((u) => u.id !== doc.holderUnitId);
  // refetch แล้วปลายทางที่เลือกไว้อาจกลายเป็นที่อยู่ปัจจุบันหรือถูกปิด — ตกกลับ "คงไว้ที่เดิม" ให้ select สรุป ปุ่ม และคำขอตรงกัน
  const target = rawTarget === CLOSE || targets.some((u) => u.id === rawTarget) ? rawTarget : STAY;
  // ตำแหน่งที่ติ๊กไว้อาจถูกเวียนไปแล้วหรือถูกปิดหลัง refetch — ตัดออกก่อนส่ง
  const circulateTo = circulating ? [...picked].filter((id) => choosable.some((u) => u.id === id)) : [];
  const tooMany = circulateTo.length > MAX_CIRCULATE;
  const route: AnnotateRoute =
    target === STAY ? { kind: 'stay' } : target === CLOSE ? { kind: 'close' } : { kind: 'forward', toUnitId: target };
  const targetName = units.find((u) => u.id === target)?.name;

  const summary = [
    route.kind === 'forward' ? `หนังสือจะไปอยู่ที่ ${targetName}` : null,
    route.kind === 'close' ? 'จะจบเรื่องและส่งคืนสารบรรณ — เปิดกลับไม่ได้' : null,
    route.kind === 'stay' ? 'หนังสือยังอยู่ที่เดิม' : null,
    circulateTo.length ? `เวียนให้ทราบ ${circulateTo.length} ตำแหน่ง` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const submitLabel = route.kind === 'forward' ? 'บันทึกและส่งต่อ' : route.kind === 'close' ? 'บันทึกและจบเรื่อง' : 'บันทึก';
  const blocked = busy || !note.trim() || (circulating && circulateTo.length === 0) || tooMany;

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (blocked) return;
    if (route.kind === 'close' && !confirm('จบเรื่องแล้วเปิดกลับไม่ได้ ยืนยันจบเรื่อง?')) return;
    onSubmit({ note: note.trim(), route, circulateTo });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_NOTES.map((q) => (
          <button
            key={q}
            type="button"
            className="rounded-full border border-sb-line bg-white px-3 py-1 text-xs hover:bg-sb-hover"
            onClick={() => onNoteChange((note.trim() ? `${note.trim()} ${q}` : q).slice(0, 1000))}
          >
            {q}
          </button>
        ))}
      </div>
      <Field label="ข้อความเกษียน/สั่งการ" required>
        <textarea className={inputClass} rows={3} maxLength={1000} value={note} onChange={(e) => onNoteChange(e.target.value)} />
      </Field>
      <Field label="ส่งต่อถึง">
        <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value={STAY}>{ROUTE_LABELS.stay}</option>
          {targets.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          <option value={CLOSE}>{ROUTE_LABELS.close}</option>
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={circulating} onChange={(e) => setCirculating(e.target.checked)} />
        แจ้งเวียนให้ตำแหน่งอื่นทราบ
      </label>
      {circulating ? (
        <div className="rounded-[10px] border border-sb-line bg-[#FAFBFD] p-3">
          <div className="mb-2 flex gap-3 text-xs">
            <button type="button" className="text-sb-accent hover:underline" onClick={() => setPicked(new Set(choosable.map((u) => u.id)))}>
              เลือกทั้งหมด
            </button>
            <button type="button" className="text-sb-muted hover:underline" onClick={() => setPicked(new Set())}>
              ล้าง
            </button>
          </div>
          <div role="group" aria-label="ตำแหน่งที่จะแจ้งเวียน" className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
            {units.map((u) => {
              const sent = already.has(u.id);
              return (
                <label key={u.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] ${sent ? 'text-sb-muted' : 'hover:bg-white'}`}>
                  <input type="checkbox" disabled={sent} checked={sent || picked.has(u.id)} onChange={() => togglePick(u.id)} className="mt-0.5" />
                  <span>
                    {u.name}
                    <span className="block text-[11px] text-sb-muted">{sent ? 'เวียนแล้ว' : u.dept}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {choosable.length === 0 ? (
            <p className="mt-2 text-xs text-sb-muted">ทุกตำแหน่งเวียนแล้ว</p>
          ) : circulateTo.length === 0 ? (
            <p className="mt-2 text-xs text-sb-muted">เลือกตำแหน่งที่จะเวียนอย่างน้อย 1 ตำแหน่ง</p>
          ) : null}
          {tooMany ? <p className="mt-2 text-xs text-sb-danger">เวียนได้ไม่เกิน {MAX_CIRCULATE} ตำแหน่งต่อครั้ง</p> : null}
        </div>
      ) : null}

      <p aria-live="polite" className="rounded-[10px] bg-sb-panel px-3 py-2 text-[13px]">{summary}</p>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={() => { onNoteChange(''); setTarget(STAY); setCirculating(false); setPicked(new Set()); }}>
          ล้างฟอร์ม
        </button>
        <button type="submit" className={primaryButton} disabled={blocked}>
          <Icon name={route.kind === 'forward' ? 'arrow_forward' : 'check'} size={18} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
