// การ์ดดำเนินการของหน้าหนังสือ (ต้นแบบ B) — 1. ทำอะไร → 2. ส่งถึงใคร → 3. ข้อความ → สรุป
// ตัดสินจริงที่เซิร์ฟเวอร์ (annotateTransition) ฟอร์มแค่ไม่ให้เลือกสิ่งที่รู้ว่าผิดแน่
import { useId, useState } from 'react';
import Icon from '@/components/Icon';
import type { AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import type { UnitRef } from '@/lib/saraban-api';
import { MAX_CIRCULATE } from '@/lib/saraban-flow';
import { QUICK_NOTES } from '@/lib/saraban-labels';
import type { SarabanDoc } from '@/types/saraban';

type Choice = 'close' | 'forward' | 'circulate';

const CHOICES: { key: Choice; label: string; tone: string }[] = [
  { key: 'close', label: 'ทราบ · จบเรื่อง', tone: 'border-sb-success text-sb-success' },
  { key: 'forward', label: 'ส่งต่อ / สั่งการ', tone: 'border-sb-accent text-sb-accent' },
  { key: 'circulate', label: 'แจ้งเวียน', tone: 'border-[#8A5A00] text-[#8A5A00]' },
];

export default function MemberActionForm({
  doc,
  units,
  busy,
  onSubmit,
}: {
  doc: SarabanDoc;
  units: UnitRef[]; // ตำแหน่งที่เปิดใช้
  busy: boolean;
  onSubmit: (body: AnnotateSubmit) => void;
}) {
  const [choice, setChoice] = useState<Choice>('forward');
  const [rawTo, setTo] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sign, setSign] = useState(false);
  const uid = useId();
  const h1 = `${uid}-1`;
  const h2 = `${uid}-2`;
  const h3 = `${uid}-3`;

  const already = new Set(doc.circulation.map((c) => c.unitId));
  const targets = units.filter((u) => u.id !== doc.holderUnitId);
  // ไม่เวียนให้ตำแหน่งที่ถือหนังสืออยู่ — เป็นเจ้าของเรื่องอยู่แล้ว
  const circulatable = units.filter((u) => !already.has(u.id) && u.id !== doc.holderUnitId);
  // refetch แล้วตัวเลือกเดิมอาจใช้ไม่ได้ — คิดใหม่จากข้อมูลปัจจุบันทุกครั้ง (บทเรียน AnnotateForm รอบ 2)
  const to = targets.some((u) => u.id === rawTo) ? rawTo : '';
  const circulateTo = choice === 'circulate' ? [...picked].filter((id) => circulatable.some((u) => u.id === id)) : [];
  const tooMany = circulateTo.length > MAX_CIRCULATE;

  const nameOf = (id: string) => units.find((u) => u.id === id)?.name ?? id;
  const summary =
    choice === 'close'
      ? 'จะจบเรื่องและส่งคืนสารบรรณ — เปิดกลับไม่ได้'
      : choice === 'forward'
        ? to
          ? `หนังสือจะไปอยู่ที่ ${nameOf(to)}`
          : 'เลือกตำแหน่งที่จะส่งต่อ'
        : circulateTo.length
          ? `เวียนให้ทราบ ${circulateTo.length} ตำแหน่ง · หนังสือยังอยู่กับคุณ`
          : 'เลือกตำแหน่งที่จะแจ้งเวียน';
  const submitLabel = choice === 'close' ? 'ยืนยันทราบและจบเรื่อง' : choice === 'forward' ? 'ยืนยันส่งต่อ' : 'ยืนยันแจ้งเวียน';
  const blocked =
    busy || !note.trim() || (choice === 'forward' && !to) || (choice === 'circulate' && circulateTo.length === 0) || tooMany;

  function submit() {
    if (blocked) return;
    if (choice === 'close' && !confirm('จบเรื่องแล้วเปิดกลับไม่ได้ ยืนยัน?')) return;
    onSubmit({
      note: note.trim(),
      route: choice === 'close' ? { kind: 'close' } : choice === 'forward' ? { kind: 'forward', toUnitId: to } : { kind: 'stay' },
      circulateTo,
      // ลงนามได้เฉพาะ ทราบ·จบเรื่อง / ส่งต่อ (สเปกรอบ 4 ข้อ 4) — แจ้งเวียนไม่ใช่การสั่งการ
      sign: choice !== 'circulate' && sign,
    });
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chip = (on: boolean) =>
    `inline-flex h-10 items-center rounded-full border px-4 text-sm ${on ? 'border-sb-accent bg-sb-accent-light font-semibold text-sb-accent' : 'border-sb-line bg-white'}`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-sb-line bg-white p-4" aria-label="ดำเนินการ">
      <div>
        <p id={h1} className="mb-2 text-sm font-semibold">1. ต้องการทำอะไร</p>
        <div role="group" aria-labelledby={h1} className="grid grid-cols-3 gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={choice === c.key}
              onClick={() => setChoice(c.key)}
              className={`h-12 rounded-xl border text-sm font-semibold ${choice === c.key ? `${c.tone} bg-[#F5F7FA]` : 'border-sb-line text-sb-ink-2'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {choice !== 'close' ? (
        <div>
          <p id={h2} className="mb-2 text-sm font-semibold">2. ส่งถึงใคร</p>
          <div role="group" aria-labelledby={h2} className="flex flex-wrap gap-2">
            {choice === 'forward'
              ? targets.map((u) => (
                  <button key={u.id} type="button" aria-pressed={to === u.id} onClick={() => setTo(u.id)} className={chip(to === u.id)}>
                    {u.name}
                  </button>
                ))
              : units.filter((u) => u.id !== doc.holderUnitId).map((u) => {
                  const sent = already.has(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={sent}
                      aria-pressed={picked.has(u.id)}
                      onClick={() => togglePick(u.id)}
                      className={`${chip(picked.has(u.id))} ${sent ? 'opacity-50' : ''}`}
                    >
                      {u.name}
                      {sent ? ' (เวียนแล้ว)' : ''}
                    </button>
                  );
                })}
          </div>
          {tooMany ? <p className="mt-2 text-xs text-sb-danger">เวียนได้ไม่เกิน {MAX_CIRCULATE} ตำแหน่งต่อครั้ง</p> : null}
        </div>
      ) : null}

      <div>
        <p id={h3} className="mb-2 text-sm font-semibold">{choice === 'close' ? '2' : '3'}. ข้อความ</p>
        <div role="group" aria-labelledby={h3} className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_NOTES.map((q) => (
            <button
              key={q}
              type="button"
              className="inline-flex h-9 items-center rounded-full border border-sb-line px-3 text-xs hover:bg-sb-hover"
              onClick={() => setNote((note.trim() ? `${note.trim()} ${q}` : q).slice(0, 1000))}
            >
              {q}
            </button>
          ))}
        </div>
        <textarea
          aria-label="ข้อความเกษียน/สั่งการ"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-sb-line-input px-3 py-2 text-[15px]"
        />
      </div>

      {choice !== 'circulate' ? (
        <label className="flex items-start gap-2.5 rounded-xl border border-sb-line px-3 py-2.5">
          <input type="checkbox" checked={sign} onChange={(e) => setSign(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none" />
          <span>
            <span className="block text-sm font-semibold">ลงนามในระบบ</span>
            <span className="block text-xs text-sb-muted">บันทึกชื่อ เวลา IP และรหัสตรวจสอบไฟล์ (sha256) ของหนังสือนี้</span>
          </span>
        </label>
      ) : null}

      <p aria-live="polite" className="rounded-xl bg-sb-panel px-3 py-2 text-[13px]">{summary}</p>

      <button
        type="button"
        disabled={blocked}
        onClick={submit}
        className="sticky bottom-3 flex h-[52px] items-center justify-center gap-1.5 rounded-xl bg-sb-success text-base font-semibold text-white shadow-sm disabled:opacity-50"
      >
        <Icon name={choice === 'forward' ? 'arrow_forward' : choice === 'circulate' ? 'campaign' : 'check'} size={20} />
        {submitLabel}
      </button>
    </section>
  );
}
