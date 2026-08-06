import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import PublicFieldPicker from '@/components/admin/PublicFieldPicker';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  downloadUrl,
  mapFetcher,
  patchMapLayer,
  publishVersion,
} from '@/lib/map-api';
import type { MapLayer, MapLayerVersion, VersionStatus } from '@/types/map';

export const getServerSideProps = getMemberSsrProps;

const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'ร่าง',
  published: 'เผยแพร่อยู่',
  superseded: 'เคยเผยแพร่',
  discarded: 'ทิ้งแล้ว',
};

const STATUS_CLASS: Record<VersionStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-green-050 text-green-deep',
  superseded: 'bg-black/[0.06] text-ink-faint',
  discarded: 'bg-black/[0.06] text-ink-mute line-through',
};

function thaiDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LayerDetailPage() {
  const router = useRouter();
  const layerId = typeof router.query.layerId === 'string' ? router.query.layerId : null;

  const { data, error, mutate } = useSWR<{
    layer: MapLayer;
    versions: MapLayerVersion[];
  }>(layerId ? `/api/admin/map/layers/${encodeURIComponent(layerId)}` : null, mapFetcher, {
    revalidateOnFocus: false,
  });

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pendingFields, setPendingFields] = useState<string[] | null>(null);

  if (error) {
    return (
      <AdminLayout title="ไฟล์แผนที่">
        <p className="text-[13px] text-red-700">{(error as Error).message}</p>
      </AdminLayout>
    );
  }
  if (!data) {
    return (
      <AdminLayout title="ไฟล์แผนที่">
        <p className="text-[13px] text-ink-mute">กำลังโหลด…</p>
      </AdminLayout>
    );
  }

  const { layer, versions } = data;
  const published = versions.find((v) => v.status === 'published') ?? null;
  // รายชื่อฟิลด์มาจากไฟล์จริงของเวอร์ชันล่าสุดที่ยังใช้ได้ ไม่ใช่รายการที่ hardcode
  const fieldSource = published ?? versions.find((v) => v.status !== 'discarded');
  const fields = fieldSource?.stats.fields ?? [];
  const publicFields = pendingFields ?? layer.publicFields;
  const dirty = pendingFields !== null;

  async function saveFields() {
    if (!pendingFields || !layerId) return;
    setSaving(true);
    setProblem(null);
    setNotice(null);
    try {
      const res = await patchMapLayer(layerId, { publicFields: pendingFields });
      setPendingFields(null);
      await mutate();
      setNotice(
        res.republishNeeded
          ? 'บันทึกแล้ว — แต่ไฟล์ที่เสิร์ฟอยู่ตอนนี้ยังใช้รายการฟิลด์ชุดเดิม ต้องกดเผยแพร่เวอร์ชันปัจจุบันอีกครั้งจึงจะมีผลจริง'
          : 'บันทึกแล้ว'
      );
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function rollback(versionId: string) {
    setSaving(true);
    setProblem(null);
    setNotice(null);
    try {
      await publishVersion(versionId);
      await mutate();
      setNotice('ย้อนเวอร์ชันเรียบร้อย');
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title={layer.title}
      actions={
        <Link
          href="/admin/map"
          className="flex items-center gap-1 text-[12.5px] text-ink-soft hover:underline"
        >
          <Icon name="arrow_back" size={16} />
          กลับไปหน้าคลังไฟล์
        </Link>
      }
    >
      {notice ? (
        <p className="mb-4 rounded-lg bg-green-050 px-3 py-2 text-[12.5px] leading-normal text-green-deep">
          {notice}
        </p>
      ) : null}
      {problem ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {problem}
        </p>
      ) : null}

      <section className="mb-6 overflow-x-auto rounded-2xl border border-black/[0.07] bg-white">
        <table className="w-full min-w-[720px] text-left text-[12.5px]">
          <thead className="border-b border-black/[0.07] text-[11.5px] text-ink-mute">
            <tr>
              <th className="px-3 py-2 font-medium">เวอร์ชัน</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-3 py-2 font-medium">รายการ</th>
              <th className="px-3 py-2 font-medium">ส่วนต่าง</th>
              <th className="px-3 py-2 font-medium">อัปโดย</th>
              <th className="px-3 py-2 font-medium">เผยแพร่โดย</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2 font-medium text-ink">v{v.versionNo}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_CLASS[v.status]}`}
                  >
                    {STATUS_LABEL[v.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  {v.stats.featureCount.toLocaleString('th-TH')}
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  {v.diff
                    ? `+${v.diff.added} −${v.diff.removed} แก้ ${v.diff.changed}`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-ink-mute">
                  {v.uploadedBy}
                  <br />
                  <span className="text-[11px]">{thaiDateTime(v.uploadedAt)}</span>
                </td>
                <td className="px-3 py-2 text-ink-mute">
                  {v.publishedBy ? (
                    <>
                      {v.publishedBy}
                      <br />
                      <span className="text-[11px]">{thaiDateTime(v.publishedAt!)}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {v.fullAsset ? (
                    <a
                      href={downloadUrl(v.id)}
                      className="text-ink-soft hover:underline"
                    >
                      ไฟล์เต็ม
                    </a>
                  ) : (
                    <span
                      className="text-ink-mute"
                      title="ไฟล์เต็มถูกลบตามนโยบายเก็บย้อนหลัง 5 เวอร์ชัน (ประวัติยังอยู่ครบ)"
                    >
                      ไฟล์ถูกตัดแล้ว
                    </span>
                  )}
                  {v.status === 'superseded' ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void rollback(v.id)}
                      className="ml-3 rounded-lg border border-black/15 px-2 py-1 text-[11.5px] font-medium text-ink-soft transition hover:bg-black/[0.04] disabled:opacity-50"
                    >
                      ย้อนกลับมาใช้
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-black/[0.07] bg-white p-4">
        {fields.length === 0 ? (
          <p className="text-[12.5px] text-ink-mute">
            ยังไม่มีไฟล์ในเลเยอร์นี้ — อัปโหลดไฟล์แรกก่อนจึงจะเลือกฟิลด์ได้
          </p>
        ) : (
          <>
            <PublicFieldPicker
              fields={fields}
              value={publicFields}
              featureCount={fieldSource?.stats.featureCount ?? 0}
              disabled={saving}
              onChange={setPendingFields}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => void saveFields()}
                className="rounded-lg bg-green px-3 py-1.5 font-display text-[12.5px] font-semibold text-white transition hover:bg-green-deep disabled:opacity-40"
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึกรายการฟิลด์'}
              </button>
              {dirty ? (
                <button
                  type="button"
                  onClick={() => setPendingFields(null)}
                  className="rounded-lg border border-black/15 px-3 py-1.5 font-display text-[12.5px] font-medium text-ink-soft"
                >
                  ยกเลิก
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}

export default withMemberGuard(LayerDetailPage);
