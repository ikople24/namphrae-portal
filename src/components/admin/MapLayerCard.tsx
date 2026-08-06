import Link from 'next/link';
import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import {
  discardVersion,
  downloadUrl,
  issuesCsvUrl,
  publishVersion,
  uploadLayerFile,
  UploadRejectedError,
  type AdminLayerRow,
  type UploadStage,
} from '@/lib/map-api';
import type { MapCheck, MapLayerVersion } from '@/types/map';

const ACCEPT = '.geojson,.json,.js,.zip';

const STAGE_LABEL: Record<UploadStage, string> = {
  converting: 'กำลังแปลง shapefile…',
  uploading: 'กำลังอัปโหลด…',
  checking: 'กำลังตรวจไฟล์…',
};

// CSV มีความหมายเฉพาะคำเตือนที่ชี้ได้เป็นรายแถว — ข้ออื่น (เช่นจำนวนเปลี่ยนเกิน
// 20%) เป็นเรื่องของทั้งไฟล์ ไม่มี "แถวที่มีปัญหา" ให้ดาวน์โหลด
const CSV_CODES = new Set(['duplicate-key', 'key-composition', 'null-literal', 'mojibake']);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MapLayerCard({
  row,
  onChanged,
}: {
  row: AdminLayerRow;
  onChanged: () => void;
}) {
  const { layer, published, versionCount } = row;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockingChecks, setBlockingChecks] = useState<MapCheck[] | null>(null);
  const [draft, setDraft] = useState<MapLayerVersion | null>(row.draft);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || stage) return;
    setError(null);
    setBlockingChecks(null);
    try {
      const version = await uploadLayerFile(layer.id, file, setStage);
      setDraft(version);
      onChanged();
    } catch (err) {
      if (err instanceof UploadRejectedError) setBlockingChecks(err.checks);
      else setError((err as Error).message);
    } finally {
      setStage(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onPublish() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await publishVersion(draft.id);
      setDraft(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDiscard() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await discardVersion(draft.id);
      setDraft(null);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const warnings = draft?.checks.filter((c) => c.level === 'warning') ?? [];

  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">
            {layer.title}
          </h2>
          <p className="mt-0.5 text-[11.5px] text-ink-mute">
            {published ? (
              <>
                {published.stats.featureCount.toLocaleString('th-TH')} รายการ ·{' '}
                {formatBytes(published.publicAsset?.bytes ?? published.source.bytes)} ·{' '}
                {thaiDate(published.publishedAt ?? published.uploadedAt)}
                <br />
                อัปโดย {published.uploadedBy}
              </>
            ) : (
              'ยังไม่มีเวอร์ชันที่เผยแพร่'
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
              layer.visibility === 'public'
                ? 'bg-green-050 text-green-deep'
                : 'bg-black/[0.06] text-ink-faint'
            }`}
          >
            {layer.visibility === 'public' ? 'สาธารณะ' : 'เฉพาะเจ้าหน้าที่'}
          </span>
          {published ? (
            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint">
              v{published.versionNo}
            </span>
          ) : null}
        </div>
      </header>

      {/* ทั้งใบเป็นพื้นที่วางไฟล์ ไม่ต้องเล็งปุ่ม */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !stage && inputRef.current?.click()}
        className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging
            ? 'border-green bg-green-050'
            : 'border-black/10 hover:border-black/20 hover:bg-black/[0.02]'
        } ${stage ? 'pointer-events-none opacity-60' : ''}`}
      >
        {stage ? (
          <p className="font-display text-[13px] font-medium text-ink-soft">
            {STAGE_LABEL[stage]}
          </p>
        ) : (
          <>
            <p className="font-display text-[13px] font-medium text-ink-soft">
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
            </p>
            <p className="mt-1 text-[11px] text-ink-mute">
              .geojson · .js (qgis2web) · .zip (shapefile)
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-normal text-red-700">
          {error}
        </p>
      ) : null}

      {blockingChecks?.map((c) => (
        <p
          key={c.code}
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-normal text-red-700"
        >
          {c.message}
        </p>
      ))}

      {draft ? (
        <div className="mt-3 rounded-xl border border-black/[0.07] bg-paper p-3">
          <p className="font-display text-[12.5px] font-semibold text-ink">
            ผลตรวจร่าง v{draft.versionNo}
          </p>

          <dl className="mt-2 space-y-1 text-[12px] text-ink-soft">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-ink-mute">จำนวน</dt>
              <dd>
                {draft.diff && published ? (
                  <>
                    {published.stats.featureCount.toLocaleString('th-TH')} →{' '}
                    {draft.stats.featureCount.toLocaleString('th-TH')}{' '}
                    <span className="text-ink-mute">
                      (+{draft.diff.added} −{draft.diff.removed} แก้ไข {draft.diff.changed})
                    </span>
                  </>
                ) : (
                  `${draft.stats.featureCount.toLocaleString('th-TH')} รายการ`
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-ink-mute">ฟิลด์</dt>
              <dd>
                {draft.stats.fields.length} ฟิลด์
                {draft.diff?.fieldsAdded.length
                  ? ` · เพิ่ม ${draft.diff.fieldsAdded.join(', ')}`
                  : ''}
                {draft.diff?.fieldsRemoved.length
                  ? ` · หาย ${draft.diff.fieldsRemoved.join(', ')}`
                  : ''}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-ink-mute">ขอบเขต</dt>
              <dd>อยู่ในพื้นที่ประเทศไทย ✓</dd>
            </div>
          </dl>

          {warnings.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5">
              <p className="flex items-center gap-1.5 font-display text-[11.5px] font-semibold text-amber-800">
                <Icon name="warning" size={16} />
                พบ {warnings.length} เรื่องที่ควรรู้
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {warnings.map((c) => (
                  <li key={c.code} className="text-[11.5px] leading-normal text-amber-800">
                    • {c.message}
                    {c.sample.length > 0 ? (
                      <span className="block pl-3 text-[11px] text-amber-700/80">
                        เช่น {c.sample.join(' · ')}
                      </span>
                    ) : null}
                    {CSV_CODES.has(c.code) ? (
                      <a
                        href={issuesCsvUrl(draft.id, c.code)}
                        className="ml-3 inline-block font-medium underline"
                      >
                        ดาวน์โหลด CSV
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onDiscard()}
              disabled={busy}
              className="rounded-lg border border-black/15 px-3 py-1.5 font-display text-[12.5px] font-medium text-ink-soft transition hover:bg-black/[0.04] disabled:opacity-50"
            >
              ทิ้งร่างนี้
            </button>
            <button
              type="button"
              onClick={() => void onPublish()}
              disabled={busy}
              className={`rounded-lg px-3 py-1.5 font-display text-[12.5px] font-semibold text-white transition disabled:opacity-50 ${
                warnings.length > 0
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-green hover:bg-green-deep'
              }`}
            >
              {busy
                ? 'กำลังเผยแพร่…'
                : warnings.length > 0
                  ? 'ยืนยันและเผยแพร่'
                  : 'เผยแพร่'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
        {published?.fullAsset ? (
          <a href={downloadUrl(published.id)} className="text-ink-soft hover:underline">
            ดาวน์โหลดไฟล์เต็ม
          </a>
        ) : null}
        <Link
          href={`/admin/map/${layer.id}`}
          className="text-ink-soft hover:underline"
        >
          ประวัติ {versionCount} เวอร์ชัน · ตั้งค่า
        </Link>
      </div>
    </section>
  );
}
