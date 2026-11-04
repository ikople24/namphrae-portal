// แผงผูกคนเข้าตำแหน่ง (สเปกรอบ 3 ข้อ 4) — ผู้จัดการเท่านั้น · รายชื่อจากทะเบียนสมาชิกที่ active และมี clerkId
import { useState } from 'react';
import { outlineButton, primaryButton } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { messageOf, setUnitMembers } from '@/lib/saraban-api';
import { MAX_UNIT_MEMBERS } from '@/lib/saraban-schema';
import type { SarabanUnit } from '@/types/saraban';

export type MemberOption = { clerkId: string; name: string; position: string };

export default function UnitMembersPanel({
  unit,
  options,
  onClose,
  onSaved,
}: {
  unit: SarabanUnit;
  options: MemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(unit.memberClerkIds));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const q = query.trim();
  const shown = q ? options.filter((o) => `${o.name} ${o.position}`.includes(q)) : options;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    try {
      await setUnitMembers(unit.id, [...picked]);
      showToast('บันทึกผู้ถือตำแหน่งแล้ว');
      onSaved();
      onClose();
    } catch (err) {
      showToast(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-sb-line bg-[#FAFBFD] p-3">
      <input
        aria-label="ค้นหาชื่อ"
        placeholder="ค้นหาชื่อหรือตำแหน่ง"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 rounded-lg border border-sb-line-input px-3 text-sm"
      />
      <div role="group" aria-label={`ผู้ถือตำแหน่ง ${unit.name}`} className="grid max-h-64 gap-1 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {shown.map((o) => (
          <label key={o.clerkId} className="flex min-h-11 items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white">
            <input type="checkbox" className="mt-0.5" checked={picked.has(o.clerkId)} onChange={() => toggle(o.clerkId)} />
            <span>
              {o.name || o.clerkId}
              <span className="block text-[11px] text-sb-muted">{o.position}</span>
            </span>
          </label>
        ))}
      </div>
      {picked.size > MAX_UNIT_MEMBERS ? <p className="text-xs text-sb-danger">ผูกได้ไม่เกิน {MAX_UNIT_MEMBERS} คนต่อตำแหน่ง</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={outlineButton} disabled={busy} onClick={onClose}>
          ยกเลิก
        </button>
        <button type="button" className={primaryButton} disabled={busy || picked.size > MAX_UNIT_MEMBERS} onClick={() => void save()}>
          บันทึก ({picked.size} คน)
        </button>
      </div>
    </div>
  );
}
