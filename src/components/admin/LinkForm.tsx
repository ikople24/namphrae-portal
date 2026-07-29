import { useState } from 'react';
import { useRouter } from 'next/router';
import type { Category } from '@/types/portal';
import { linkInputSchema, type LinkInput } from '@/lib/schema';
import { createLink, updateLink } from '@/lib/admin-api';
import Icon from '@/components/Icon';
import { SERVICE_ICONS, iconForService } from '@/lib/icons';

const EMPTY: LinkInput = {
  id: '',
  title: '',
  subtitle: '',
  url: '',
  imageUrl: '',
  icon: '',
  categoryId: '',
  openInNewTab: true,
  isActive: true,
  isFeatured: false,
  order: 0,
};

export default function LinkForm({
  mode,
  categories,
  initial,
}: {
  mode: 'new' | 'edit';
  categories: Category[];
  initial?: LinkInput;
}) {
  const router = useRouter();
  const [form, setForm] = useState<LinkInput>({
    ...EMPTY,
    categoryId: categories[0]?.id ?? '',
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof LinkInput>(key: K, value: LinkInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Auto-suggest a slug from the title on the new form (only if untouched).
  function onTitleChange(value: string) {
    setForm((f) => {
      const shouldSuggest = mode === 'new' && (f.id === '' || f.id === slugify(f.title));
      return { ...f, title: value, id: shouldSuggest ? slugify(value) : f.id };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = linkInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'new') await createLink(parsed.data);
      else await updateLink(initial!.id, parsed.data);
      router.push('/admin');
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Field label="ชื่อบริการ" required>
        <input
          className={inputCls}
          value={form.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="เช่น ชำระภาษีออนไลน์"
          required
        />
      </Field>

      <Field label="คำอธิบายสั้น">
        <input
          className={inputCls}
          value={form.subtitle ?? ''}
          onChange={(e) => set('subtitle', e.target.value)}
          placeholder="บริการ e-Service ชำระภาษีท้องถิ่น"
        />
      </Field>

      <Field label="ลิงก์ปลายทาง (URL)">
        <input
          className={inputCls}
          value={form.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
        <p className="mt-1 text-xs text-ink-soft">
          เว้นว่างได้ถ้ายังไม่มีปลายทาง (จะแสดงเป็นการ์ดที่กดไม่ได้)
        </p>
      </Field>

      <Field label="ไอคอน">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-green-050 text-green-deep">
            <Icon name={iconForService(form.id, form.icon)} size={22} />
          </span>
          <select
            className={inputCls}
            value={form.icon ?? ''}
            onChange={(e) => set('icon', e.target.value)}
          >
            <option value="">— อัตโนมัติตามรหัส (id) —</option>
            {ICON_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          ไอคอนเส้นแทนรูปภาพเดิม — แบบอัตโนมัติจะเลือกตามรหัสบริการที่รู้จัก
        </p>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="หมวดหมู่" required>
          <select
            className={inputCls}
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Slug (id ไม่ซ้ำ)" required>
          <input
            className={inputCls}
            value={form.id}
            onChange={(e) => set('id', slugify(e.target.value))}
            placeholder="paytax"
            required
          />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border border-black/[0.07] bg-surface p-4">
        <Toggle
          label="แสดงบนหน้าเว็บ"
          checked={form.isActive}
          onChange={(v) => set('isActive', v)}
        />
        <Toggle
          label="การ์ดเด่น (แสดงใหญ่ด้านบน)"
          checked={form.isFeatured}
          onChange={(v) => set('isFeatured', v)}
        />
        <Toggle
          label="เปิดในแท็บใหม่"
          checked={form.openInNewTab}
          onChange={(v) => set('openInNewTab', v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-deep disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก…' : mode === 'new' ? 'เพิ่มลิงก์' : 'บันทึกการแก้ไข'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="rounded-full px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/20';

// Unique icon names from the service map, alphabetical, for the dropdown.
const ICON_OPTIONS = Array.from(new Set(Object.values(SERVICE_ICONS))).sort();

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-emerald' : 'bg-black/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}
