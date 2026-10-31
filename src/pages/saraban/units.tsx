// สมุดผู้รับ (สเปกข้อ 6 "/saraban/units") — เพิ่มได้ แก้ได้ ลบไม่ได้ (ปิดแทน) เพราะหนังสืออ้าง id อยู่
// รหัสส่วนราชการจำเป็นต่อการออกเลขหนังสือส่ง: ระบบต่อ "/เลข" ท้ายรหัสเอง รหัสจึงห้ามมี '/'
import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { ErrorBox, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import { createUnit, messageOf, sarabanFetcher, UNITS_KEY, updateUnit } from '@/lib/saraban-api';
import type { SarabanUnit } from '@/types/saraban';

type Draft = { name: string; dept: string; refCode: string; order: string };
const BLANK: Draft = { name: '', dept: '', refCode: '', order: '' };

function draftProblem(d: Draft): string | null {
  if (!d.name.trim()) return 'ต้องระบุชื่อตำแหน่ง/หน่วยงาน';
  if (d.refCode.includes('/')) return "รหัสส่วนราชการห้ามมี '/' — ระบบต่อ /เลข ให้เอง";
  if (d.refCode.trim().length > 30) return 'รหัสส่วนราชการยาวเกิน 30 ตัว';
  if (d.order && !Number.isInteger(Number(d.order))) return 'ลำดับต้องเป็นจำนวนเต็ม';
  return null;
}

function toInput(d: Draft) {
  return { name: d.name.trim(), dept: d.dept.trim(), refCode: d.refCode.trim(), order: Number(d.order || 0) };
}

function UnitsPage() {
  const { data: units, error, mutate } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const p = draftProblem(draft);
    if (p) return setProblem(p);
    setProblem('');
    setBusy(true);
    try {
      await createUnit({ ...toInput(draft), isActive: true });
      await mutate();
      setDraft(BLANK);
      showToast('เพิ่มในสมุดผู้รับแล้ว');
    } catch (err) {
      setProblem(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SarabanLayout title="สมุดผู้รับ">
      <form onSubmit={add} className={`${card} flex flex-col gap-3 p-5`}>
        <h2 className="font-semibold">เพิ่มตำแหน่ง / หน่วยงาน</h2>
        <div className="grid gap-2.5 sm:grid-cols-[2fr_1.4fr_1.2fr_0.6fr_auto]">
          <input className={inputClass} placeholder="ชื่อ เช่น ผอ.กองช่าง" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className={inputClass} placeholder="สังกัด" value={draft.dept} onChange={(e) => setDraft({ ...draft, dept: e.target.value })} />
          <input className={inputClass} placeholder="รหัสส่วนราชการ (ถ้ามี)" value={draft.refCode} onChange={(e) => setDraft({ ...draft, refCode: e.target.value })} />
          <input className={inputClass} placeholder="ลำดับ" inputMode="numeric" value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value })} />
          <button type="submit" className={primaryButton} disabled={busy}>
            เพิ่ม
          </button>
        </div>
        {problem ? <ErrorBox>{problem}</ErrorBox> : null}
        <p className="text-xs text-sb-muted">รหัสส่วนราชการ เช่น “ชม 55201” — หน่วยที่ไม่มีรหัสออกเลขหนังสือส่งไม่ได้ · ลบไม่ได้ ให้ปิดแทน</p>
      </form>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-sb-panel text-left text-xs text-sb-muted">
                <th className="px-4 py-3 font-semibold">ชื่อ</th>
                <th className="px-2.5 py-3 font-semibold">สังกัด</th>
                <th className="px-2.5 py-3 font-semibold">รหัสส่วนราชการ</th>
                <th className="px-2.5 py-3 font-semibold">ลำดับ</th>
                <th className="px-2.5 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(units ?? []).map((u) => (
                <UnitRow key={u.id} unit={u} onSaved={() => mutate()} />
              ))}
            </tbody>
          </table>
        </div>
        {error ? <p className="px-4 py-6 text-center text-[13px] text-sb-danger">โหลดสมุดผู้รับไม่สำเร็จ</p> : null}
      </div>
    </SarabanLayout>
  );
}

function UnitRow({ unit, onSaved }: { unit: SarabanUnit; onSaved: () => void }) {
  const initial: Draft = { name: unit.name, dept: unit.dept, refCode: unit.refCode, order: String(unit.order) };
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  async function save(patch: Parameters<typeof updateUnit>[1], done: string) {
    setBusy(true);
    try {
      await updateUnit(unit.id, patch);
      onSaved();
      showToast(done);
    } catch (err) {
      showToast(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const cell = 'w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 hover:border-sb-line-input focus:border-sb-line-input';
  return (
    <tr className={`border-t border-sb-page ${unit.isActive ? '' : 'text-sb-muted'}`}>
      <td className="px-3 py-1.5">
        <input className={cell} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </td>
      <td className="px-1 py-1.5">
        <input className={cell} value={d.dept} onChange={(e) => setD({ ...d, dept: e.target.value })} />
      </td>
      <td className="px-1 py-1.5">
        <input className={cell} placeholder="—" value={d.refCode} onChange={(e) => setD({ ...d, refCode: e.target.value })} />
      </td>
      <td className="w-20 px-1 py-1.5">
        <input className={cell} inputMode="numeric" value={d.order} onChange={(e) => setD({ ...d, order: e.target.value })} />
      </td>
      <td className="px-2.5 py-1.5">
        <span className={`rounded-full px-2.5 py-[3px] text-xs font-semibold ${unit.isActive ? 'bg-sb-success-bg text-sb-success' : 'bg-sb-subtle text-sb-muted'}`}>
          {unit.isActive ? 'ใช้งาน' : 'ปิดแล้ว'}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-1.5 text-right">
        {dirty ? (
          <button
            type="button"
            className={`${primaryButton} mr-1.5 px-3 py-1.5 text-xs`}
            disabled={busy}
            onClick={() => {
              const p = draftProblem(d);
              if (p) return showToast(p);
              void save(toInput(d), 'บันทึกแล้ว');
            }}
          >
            บันทึก
          </button>
        ) : null}
        <button
          type="button"
          className={`${outlineButton} px-3 py-1.5 text-xs`}
          disabled={busy}
          onClick={() => save({ isActive: !unit.isActive }, unit.isActive ? 'ปิดการใช้งานแล้ว' : 'เปิดใช้งานแล้ว')}
        >
          {unit.isActive ? 'ปิด' : 'เปิด'}
        </button>
      </td>
    </tr>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(UnitsPage);
