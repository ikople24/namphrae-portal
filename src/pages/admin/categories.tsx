import { useState } from 'react';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import { adminFetcher, updateCategories } from '@/lib/admin-api';
import { CATEGORY_COLORS, accentOf } from '@/lib/category-accent';
import { slugify } from '@/lib/slugify';
import type { Category, PortalConfig } from '@/types/portal';

// Category management: rename / recolor / reorder / add / delete-with-guard.
// Edits live in a local copy; one "บันทึก" submits the whole list to
// PUT /api/admin/categories (server re-checks the delete guard).

function CategoriesPage() {
  const { data, error, isLoading, mutate } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );
  const [rows, setRows] = useState<Category[] | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const serverList = [...(data?.categories ?? [])].sort(
    (a, b) => a.order - b.order
  );
  const list = rows ?? serverList;
  const dirty = rows !== null;

  const linkCount = (id: string) =>
    data?.links.filter((l) => l.categoryId === id).length ?? 0;

  function edit(mutator: (draft: Category[]) => Category[]) {
    setMsg(null);
    setRows((current) => mutator([...(current ?? serverList)]));
  }

  function move(index: number, dir: -1 | 1) {
    edit((draft) => {
      const j = index + dir;
      if (j < 0 || j >= draft.length) return draft;
      [draft[index], draft[j]] = [draft[j], draft[index]];
      return draft;
    });
  }

  function setLabel(index: number, label: string) {
    edit((draft) => {
      draft[index] = { ...draft[index], label };
      return draft;
    });
  }

  function setColor(index: number, color: string) {
    edit((draft) => {
      draft[index] = { ...draft[index], color };
      return draft;
    });
  }

  function remove(index: number) {
    const cat = list[index];
    if (!confirm(`ลบหมวด “${cat.label}” ?`)) return;
    edit((draft) => {
      draft.splice(index, 1);
      return draft;
    });
  }

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    const id = slugify(label) || `category-${list.length + 1}`;
    if (list.some((c) => c.id === id)) {
      setMsg(`มีหมวด id “${id}” อยู่แล้ว — เปลี่ยนชื่อเล็กน้อยเพื่อให้ id ไม่ซ้ำ`);
      return;
    }
    edit((draft) => {
      draft.push({ id, label, order: draft.length + 1 });
      return draft;
    });
    setNewLabel('');
  }

  async function save() {
    if (!list.length) {
      setMsg('ต้องมีอย่างน้อย 1 หมวด');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await updateCategories(list.map((c, i) => ({ ...c, order: i + 1 })));
      await mutate();
      setRows(null);
      setMsg('บันทึกแล้ว');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="หมวดหมู่"
      actions={
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-[10px] bg-green px-[17px] py-2.5 font-display text-[13.5px] font-semibold text-white transition hover:bg-green-deep disabled:opacity-40"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      }
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 rounded-lg bg-green-050 px-4 py-2 text-sm text-green-deep">
          {msg}
        </p>
      ) : null}
      {dirty ? (
        <p className="mb-4 text-xs text-amber-700">
          มีการแก้ไขที่ยังไม่บันทึก — กด “บันทึก” เพื่อยืนยัน
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : (
        <div className="max-w-2xl space-y-2">
          {list.map((cat, i) => {
            const count = linkCount(cat.id);
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white px-4 py-3"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`เลื่อน ${cat.label} ขึ้น`}
                    className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-black/[0.05] disabled:opacity-20"
                  >
                    <Icon name="arrow_upward" size={16} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1}
                    aria-label={`เลื่อน ${cat.label} ลง`}
                    className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-black/[0.05] disabled:opacity-20"
                  >
                    <Icon name="arrow_downward" size={16} />
                  </button>
                </div>

                <span
                  className="h-3 w-3 flex-none rounded-full"
                  style={{ background: accentOf(cat, cat.id) }}
                />

                <div className="min-w-0 flex-1">
                  <input
                    value={cat.label}
                    onChange={(e) => setLabel(i, e.target.value)}
                    aria-label={`ชื่อหมวด ${cat.id}`}
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-sm font-semibold text-ink outline-none focus:border-black/15 focus:bg-white"
                  />
                  <p className="px-2 text-[11px] text-ink-mute">
                    {cat.id} · {count} ลิงก์
                  </p>
                </div>

                <div className="flex gap-1.5">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(i, c.value)}
                      title={c.label}
                      aria-label={`สี${c.label}`}
                      aria-pressed={accentOf(cat, cat.id) === c.value}
                      className={`h-6 w-6 rounded-full transition ${
                        accentOf(cat, cat.id) === c.value
                          ? 'ring-2 ring-ink ring-offset-2'
                          : 'hover:scale-110'
                      }`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => remove(i)}
                  disabled={count > 0}
                  aria-label={`ลบหมวด ${cat.label}`}
                  title={count > 0 ? `ลบไม่ได้ — มี ${count} ลิงก์ในหมวดนี้` : 'ลบหมวด'}
                  className="grid h-8 w-8 place-items-center rounded-[9px] text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <Icon name="delete" size={19} />
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-black/[0.16] px-4 py-3">
            <Icon name="add" size={20} className="text-ink-mute" />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
              placeholder="ชื่อหมวดใหม่ เช่น กิจกรรมชุมชน"
              aria-label="ชื่อหมวดใหม่"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-mute"
            />
            <button
              onClick={add}
              disabled={!newLabel.trim()}
              className="rounded-full border border-black/[0.18] px-4 py-1.5 font-display text-[12.5px] font-semibold text-green-deep transition hover:bg-green-025 disabled:opacity-40"
            >
              เพิ่มหมวด
            </button>
          </div>

          <p className="px-1 pt-2 text-[11.5px] leading-relaxed text-ink-mute">
            หมวดที่ยังมีลิงก์อยู่จะลบไม่ได้ — ย้ายลิงก์ไปหมวดอื่นก่อน (แก้ได้ในหน้า
            ลิงก์บริการ) · id ของหมวดตั้งอัตโนมัติจากชื่อและแก้ไม่ได้ภายหลัง
          </p>
        </div>
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(CategoriesPage);
