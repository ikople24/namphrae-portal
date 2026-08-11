import { useEffect, useRef, useState } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import ImageUploadField from '@/components/admin/ImageUploadField';
import Icon from '@/components/Icon';
import {
  adminFetcher,
  updateLineGroupId,
  updateSite,
  uploadMedia,
} from '@/lib/admin-api';
import { siteSettingsSchema } from '@/lib/schema';
import type { PortalConfig, SiteSettings } from '@/types/portal';

function SettingsPage() {
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

        <LineGroupSection />
      </div>
    </AdminLayout>
  );
}

type LineGroupStatus = {
  lineGroupId: string | null;
  configured: boolean;
  push: boolean;
  webhook: boolean;
};

// สองความพร้อมนี้ควบคุมกันคนละอย่าง — push (LINE_CHANNEL_ACCESS_TOKEN) คือส่ง
// แจ้งเตือนงานใหม่ได้ไหม, webhook (LINE_CHANNEL_SECRET) คือรับ groupId ตอน
// เชิญบอทเข้ากลุ่มได้ไหม ตั้งแค่ตัวเดียวก็ใช้งานได้จริงบางส่วน (ดู M-1 ในรีวิว
// รอบสุดท้ายก่อน merge — isLineConfigured() เดิมต้องมีครบทั้งคู่ ทำให้ตั้งแค่
// token ก็ยังขึ้น "ยังไม่ได้ตั้งค่า" ทั้งที่แจ้งเตือนออกจริงแล้ว)
function lineStatusMessage(status: LineGroupStatus): {
  icon: 'check_circle' | 'warning';
  text: string;
} {
  if (status.push && status.webhook) {
    return {
      icon: 'check_circle',
      text: 'ตั้งค่า LINE ครบแล้ว — งานใหม่จะถูกส่งแจ้งเตือนเข้ากลุ่มด้านล่างทันที',
    };
  }
  if (status.push) {
    return {
      icon: 'warning',
      text: 'ส่งแจ้งเตือนงานใหม่เข้ากลุ่มได้แล้ว แต่ยังเชิญบอทเข้ากลุ่มใหม่ไม่ได้ — ถ้าต้องตั้งกลุ่มใหม่หรือย้ายกลุ่ม ต้องแจ้งผู้ดูแลระบบก่อน (ผู้ดูแลระบบ: ตั้งค่า LINE_CHANNEL_SECRET ด้วย ไม่งั้น webhook รับ event จาก LINE ไม่ได้)',
    };
  }
  if (status.webhook) {
    return {
      icon: 'warning',
      text: 'รับข้อมูลกลุ่มจาก LINE ได้ แต่ยังส่งแจ้งเตือนงานใหม่ไม่ได้ — เจ้าหน้าที่จะไม่ได้รับแจ้งเตือนเมื่อมีงานใหม่ (ผู้ดูแลระบบ: ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ด้วย)',
    };
  }
  return {
    icon: 'warning',
    text: 'ยังไม่ได้ตั้งค่าระบบแจ้งเตือน LINE — เจ้าหน้าที่จะไม่ได้รับแจ้งเตือนเมื่อมีงานใหม่ (ผู้ดูแลระบบ: ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_CHANNEL_SECRET ใน environment)',
  };
}

// การบันทึกกลุ่ม LINE เป็นคนละ action จากปุ่ม "บันทึก" ด้านบน (ซึ่งเซฟ
// site settings ทั้งก้อนผ่าน onSave) โดยตั้งใจ — groupId ปกติมาจาก webhook เอง
// ไม่ใช่ฟิลด์ที่กรอกแล้วรอกดบันทึกรวม การแยกปุ่มทำให้กด "บันทึก" หลักแล้วไม่มี
// ผลกับกลุ่ม LINE โดยไม่ตั้งใจ (และกลับกัน)
//
// ดึงสถานะจาก GET /api/admin/line-group แยกจาก config เพราะ `configured` มาจาก
// env ฝั่ง server (LINE_CHANNEL_SECRET ไม่ใช่ NEXT_PUBLIC_) หน้านี้อ่านเองไม่ได้
function LineGroupSection() {
  const query = useSWR<LineGroupStatus>('/api/admin/line-group', adminFetcher);
  const [lineGroupId, setLineGroupId] = useState('');
  const [lineMsg, setLineMsg] = useState<string | null>(null);
  const [savingLine, setSavingLine] = useState(false);

  // เซ็ตค่าเริ่มต้นของช่องกรอกจากข้อมูลที่โหลดมา "ครั้งแรกครั้งเดียว" ไม่ใช่ทุก
  // ครั้งที่ query.data เปลี่ยน — ไม่งั้นค่าที่เจ้าหน้าที่เพิ่งพิมพ์ (ยังไม่กดบันทึก)
  // จะถูกเขียนทับทุกครั้งที่ SWR revalidate เบื้องหลัง
  const seeded = useRef(false);
  useEffect(() => {
    if (query.data && !seeded.current) {
      setLineGroupId(query.data.lineGroupId ?? '');
      seeded.current = true;
    }
  }, [query.data]);

  async function onSaveLineGroup() {
    setLineMsg(null);
    setSavingLine(true);
    try {
      await updateLineGroupId(lineGroupId.trim());
      // ไม่มีบรรทัดนี้ กล่องสถานะด้านบนจะยังโชว์ค่าเก่าแม้บันทึกสำเร็จแล้ว
      await query.mutate();
      setLineMsg('บันทึกกลุ่ม LINE แล้ว');
    } catch (err) {
      setLineMsg(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingLine(false);
    }
  }

  return (
    <Section title="แจ้งเตือน LINE">
      {/* สองบรรทัดนี้คือทางเดียวที่เจ้าหน้าที่จะรู้ว่าแจ้งเตือนใช้ได้จริงหรือยัง
          และกำลังส่งเข้ากลุ่มไหน — ข้อความที่ส่งมีชื่อผู้ป่วย เบอร์โทร ต้นทาง
          ปลายทางครบ ถ้าบอทถูกเชิญเข้ากลุ่มผิดจะไม่มีอะไรเตือนเลย */}
      {query.data ? (
        <div className="rounded-lg border border-black/15 bg-paper-deep px-4 py-3 text-sm">
          <p className="flex items-center gap-2">
            <Icon name={lineStatusMessage(query.data).icon} size={18} />
            {lineStatusMessage(query.data).text}
          </p>
          <p className="mt-1 text-ink-soft">
            กลุ่มปัจจุบัน:{' '}
            {query.data.lineGroupId ? (
              <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">
                {query.data.lineGroupId}
              </code>
            ) : (
              'ยังไม่มี — เชิญบอท OA เข้ากลุ่มเจ้าหน้าที่'
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">กำลังโหลด…</p>
      )}

      <p className="mt-3 text-sm text-ink-soft">
        ปกติช่องนี้ถูกกรอกให้อัตโนมัติเมื่อเชิญบอท OA เข้ากลุ่มเจ้าหน้าที่ (ต้องตั้ง
        Webhook URL เป็น <code>/api/line/webhook</code> ในคอนโซล LINE) — กรอกเอง
        เมื่อต้องการย้ายกลุ่มโดยไม่เชิญบอทใหม่
      </p>
      <Field label="LINE group id">
        <input
          className={inputCls}
          value={lineGroupId}
          onChange={(e) => setLineGroupId(e.target.value)}
          placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        />
      </Field>
      <button
        type="button"
        onClick={onSaveLineGroup}
        disabled={savingLine}
        className="mt-1 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-black/[0.04] disabled:opacity-50"
      >
        {savingLine ? 'กำลังบันทึก…' : 'บันทึกกลุ่ม LINE'}
      </button>
      {lineMsg ? (
        <p className="mt-2 text-sm text-ink-soft">{lineMsg}</p>
      ) : null}
    </Section>
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

export const getServerSideProps = getFeatureSsrProps('settings');

export default withMemberGuard(SettingsPage);
