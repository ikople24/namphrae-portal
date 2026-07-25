import { useState } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { adminFetcher, updateSite, uploadMedia } from '@/lib/admin-api';
import { siteSettingsSchema } from '@/lib/schema';
import type { PortalConfig, SiteSettings } from '@/types/portal';

export default function SettingsPage() {
  const { data, isLoading, mutate } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );

  if (isLoading || !data) {
    return (
      <AdminLayout title="ตั้งค่าเว็บไซต์">
        <p className="text-ink-soft">กำลังโหลด…</p>
      </AdminLayout>
    );
  }

  // Keyed by version so the editable copy re-seeds after an external change.
  return (
    <SettingsForm key={data.version} initial={data.site} onSaved={mutate} />
  );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SiteSettings;
  onSaved: KeyedMutator<PortalConfig>;
}) {
  const [site, setSite] = useState<SiteSettings>(() => structuredClone(initial));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(next: Partial<SiteSettings>) {
    setSite((s) => (s ? { ...s, ...next } : s));
  }
  function patchHero(next: Partial<SiteSettings['hero']>) {
    setSite((s) => (s ? { ...s, hero: { ...s.hero, ...next } } : s));
  }
  function patchContact(next: Partial<SiteSettings['contact']>) {
    setSite((s) => (s ? { ...s, contact: { ...s.contact, ...next } } : s));
  }

  async function onSave() {
    setErr(null);
    setMsg(null);
    const parsed = siteSettingsSchema.safeParse(site);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }
    setSaving(true);
    try {
      await updateSite(parsed.data);
      await onSaved();
      setMsg('บันทึกการตั้งค่าแล้ว');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const manuals = site.manuals ?? [];

  return (
    <AdminLayout
      title="ตั้งค่าเว็บไซต์"
      actions={
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      }
    >
      {err ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>
      ) : null}
      {msg ? (
        <p className="mb-4 rounded-lg bg-emerald-050 px-4 py-2 text-sm text-emerald-deep">
          {msg}
        </p>
      ) : null}

      <div className="max-w-2xl space-y-8">
        <Section title="ข้อมูลหน่วยงาน">
          <Field label="ชื่อหน่วยงาน">
            <input className={inputCls} value={site.orgName} onChange={(e) => patch({ orgName: e.target.value })} />
          </Field>
          <Field label="ชื่อย่อย (อำเภอ/จังหวัด)">
            <input className={inputCls} value={site.orgSubName ?? ''} onChange={(e) => patch({ orgSubName: e.target.value })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title (eyebrow บนฮีโร่)">
              <input className={inputCls} value={site.title} onChange={(e) => patch({ title: e.target.value })} />
            </Field>
            <Field label="Brand title (หัวข้อใหญ่)">
              <input className={inputCls} value={site.brandTitle ?? ''} onChange={(e) => patch({ brandTitle: e.target.value })} />
            </Field>
          </div>
          <Field label="Tagline">
            <textarea className={inputCls} rows={2} value={site.tagline} onChange={(e) => patch({ tagline: e.target.value })} />
          </Field>
          <Field label="โลโก้">
            <ImageUploadField
              value={site.logoUrl}
              onChange={(url) => patch({ logoUrl: url })}
              upload={(file) => uploadMedia(file, 'image').then((r) => r.url)}
            />
          </Field>
        </Section>

        <Section title="ฮีโร่ (พื้นหลังส่วนหัว)">
          <Field label="ชนิดสื่อพื้นหลัง">
            <select
              className={inputCls}
              value={site.hero.mediaType}
              onChange={(e) => patchHero({ mediaType: e.target.value as SiteSettings['hero']['mediaType'] })}
            >
              <option value="none">ไม่มี — ใช้พื้นหลังไล่สี (แนะนำถ้ายังไม่มีวิดีโอ)</option>
              <option value="image">ภาพนิ่ง</option>
              <option value="video">วิดีโอ</option>
            </select>
          </Field>

          {site.hero.mediaType === 'video' ? (
            <>
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
                ข้อกำหนดวิดีโอ: ความละเอียด ≤ 1080p (ไม่รับ 4K), ยาว 10–20 วินาที,
                ไม่มีเสียง, loop เนียน — และต้องอัปโหลดภาพนิ่ง (poster) คู่กันเสมอ
              </div>
              <Field label="ไฟล์วิดีโอ">
                <ImageUploadField
                  value={site.hero.videoUrl ?? ''}
                  onChange={(url) => patchHero({ videoUrl: url })}
                  upload={(file) => uploadMedia(file, 'video').then((r) => r.url)}
                  accept="video/mp4,video/webm"
                />
              </Field>
            </>
          ) : null}

          {site.hero.mediaType !== 'none' ? (
            <Field label={site.hero.mediaType === 'video' ? 'ภาพนิ่ง (poster / fallback)' : 'ภาพนิ่ง'}>
              <ImageUploadField
                value={site.hero.posterUrl ?? ''}
                onChange={(url) => patchHero({ posterUrl: url })}
                upload={(file) => uploadMedia(file, 'image').then((r) => r.url)}
              />
            </Field>
          ) : null}

          <Field label={`ความเข้ม overlay: ${Math.round(site.hero.overlayOpacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(site.hero.overlayOpacity * 100)}
              onChange={(e) => patchHero({ overlayOpacity: Number(e.target.value) / 100 })}
              className="w-full accent-emerald"
            />
          </Field>
        </Section>

        <Section title="ข้อมูลติดต่อ">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="โทรศัพท์">
              <input className={inputCls} value={site.contact.phone ?? ''} onChange={(e) => patchContact({ phone: e.target.value })} />
            </Field>
            <Field label="อีเมล">
              <input className={inputCls} value={site.contact.email ?? ''} onChange={(e) => patchContact({ email: e.target.value })} inputMode="email" />
            </Field>
          </div>
          <Field label="ที่อยู่">
            <textarea className={inputCls} rows={2} value={site.contact.address ?? ''} onChange={(e) => patchContact({ address: e.target.value })} />
          </Field>
        </Section>

        <Section title="คู่มือการใช้งาน (PDF)">
          <div className="space-y-3">
            {manuals.map((m, i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-ink-soft">ชื่อคู่มือ</span>
                  <input
                    className={inputCls}
                    value={m.label}
                    onChange={(e) => {
                      const next = [...manuals];
                      next[i] = { ...next[i], label: e.target.value };
                      patch({ manuals: next });
                    }}
                  />
                </label>
                <label className="flex-[2]">
                  <span className="mb-1 block text-xs text-ink-soft">URL</span>
                  <input
                    className={inputCls}
                    value={m.url}
                    onChange={(e) => {
                      const next = [...manuals];
                      next[i] = { ...next[i], url: e.target.value };
                      patch({ manuals: next });
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => patch({ manuals: manuals.filter((_, j) => j !== i) })}
                  className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  ลบ
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ manuals: [...manuals, { label: '', url: '' }] })}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm text-ink-soft hover:bg-black/[0.04]"
            >
              + เพิ่มคู่มือ
            </button>
          </div>
        </Section>
      </div>
    </AdminLayout>
  );
}

const inputCls =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/20';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-black/[0.07] bg-surface p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
