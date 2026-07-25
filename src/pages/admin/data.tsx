import { useRef, useState } from 'react';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminFetcher, importConfig } from '@/lib/admin-api';
import { importConfigSchema } from '@/lib/schema';
import type { PortalConfig } from '@/types/portal';

type Preview = {
  raw: unknown;
  links: number;
  categories: number;
  activeLinks: number;
};

export default function DataPage() {
  const { data, mutate } = useSWR<PortalConfig>('/api/admin/config', adminFetcher);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function onExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `namphrae-portal-config-v${data.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    setErr(null);
    setMsg(null);
    setPreview(null);
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = importConfigSchema.safeParse(json);
      if (!parsed.success) {
        setErr(
          `ไฟล์ไม่ถูกต้อง: ${parsed.error.issues[0]?.path.join('.')} — ${parsed.error.issues[0]?.message}`
        );
        return;
      }
      setPreview({
        raw: json,
        links: parsed.data.links.length,
        categories: parsed.data.categories.length,
        activeLinks: parsed.data.links.filter((l) => l.isActive).length,
      });
    } catch (e) {
      setErr(`อ่านไฟล์ไม่ได้: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onConfirmImport() {
    if (!preview) return;
    if (
      !confirm(
        'ยืนยันนำเข้า? ข้อมูล config ปัจจุบันทั้งหมดจะถูกเขียนทับ (ยอดคลิกในไฟล์จะแทนที่ของเดิม)'
      )
    )
      return;
    setImporting(true);
    setErr(null);
    try {
      await importConfig(preview.raw);
      await mutate();
      setMsg('นำเข้าสำเร็จ — เขียนทับ config เรียบร้อย');
      setPreview(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <AdminLayout title="นำเข้า / ส่งออกข้อมูล">
      <div className="max-w-2xl space-y-6">
        <section className="space-y-3 rounded-2xl border border-black/[0.07] bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">ส่งออก (Backup)</h2>
          <p className="text-sm text-ink-soft">
            ดาวน์โหลด config ทั้งหมดเป็นไฟล์ JSON ก้อนเดียว
            {data ? ` (เวอร์ชันปัจจุบัน v${data.version}, ${data.links.length} ลิงก์)` : ''}
          </p>
          <button
            onClick={onExport}
            disabled={!data}
            className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep disabled:opacity-50"
          >
            ↓ ดาวน์โหลด JSON
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-black/[0.07] bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">นำเข้า (Restore)</h2>
          <p className="text-sm text-ink-soft">
            เลือกไฟล์ JSON เพื่อดูตัวอย่างก่อน (dry-run) แล้วจึงยืนยันเขียนทับ
          </p>

          {err ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>
          ) : null}
          {msg ? (
            <p className="rounded-lg bg-emerald-050 px-4 py-2 text-sm text-emerald-deep">
              {msg}
            </p>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-emerald-050 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-deep"
          />

          {preview ? (
            <div className="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">ตัวอย่างก่อนนำเข้า</p>
              <ul className="text-sm text-amber-800">
                <li>• หมวดหมู่: {preview.categories}</li>
                <li>
                  • ลิงก์: {preview.links} (แสดงบนหน้าเว็บ {preview.activeLinks})
                </li>
                {data ? (
                  <li className="mt-1 text-amber-700">
                    ปัจจุบันมี {data.links.length} ลิงก์ — จะถูกเขียนทับทั้งหมด
                  </li>
                ) : null}
              </ul>
              <button
                onClick={onConfirmImport}
                disabled={importing}
                className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {importing ? 'กำลังนำเข้า…' : 'ยืนยันเขียนทับ'}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </AdminLayout>
  );
}
