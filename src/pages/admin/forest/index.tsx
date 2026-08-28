import Link from 'next/link';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import MapLayerCard from '@/components/admin/MapLayerCard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import { FOREST_API } from '@/lib/forest-api';
import type { AdminLayerRow } from '@/lib/map-api';

export const getServerSideProps = getFeatureSsrProps('forest');

function ForestLayersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ layers: AdminLayerRow[] }>(
    FOREST_API.layersKey,
    FOREST_API.fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <AdminLayout
      title="ข้อมูลป่าไม้"
      actions={
        <Link
          href={FOREST_API.viewerHref}
          className="flex items-center gap-1 rounded-lg border border-black/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-black/[0.04]"
        >
          <Icon name="map" size={16} />
          เปิดแผนที่
        </Link>
      }
    >
      <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-ink-soft">
        ลากไฟล์มาวางบนการ์ดของชั้นที่ต้องการแทนที่ ระบบจะตรวจไฟล์ให้ก่อนแล้วสรุปว่า
        อะไรเปลี่ยนไปบ้าง ไฟล์ใหม่จะยังไม่ขึ้นใช้งานจนกว่าจะกดเผยแพร่
      </p>

      {isLoading ? <p className="text-[13px] text-ink-mute">กำลังโหลด…</p> : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-display text-[13px] font-semibold text-red-800">
            โหลดรายการชั้นข้อมูลไม่สำเร็จ
          </p>
          <p className="mt-1 text-[12px] text-red-700">{(error as Error).message}</p>
        </div>
      ) : null}

      {data && data.layers.length === 0 ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
          <p className="font-display text-[13px] font-semibold text-amber-800">
            ยังไม่มีชั้นข้อมูลในคลัง
          </p>
          <p className="mt-1 text-[12px] leading-normal text-amber-800">
            รัน <code className="rounded bg-amber-100 px-1">npm run import:forest</code>{' '}
            เพื่อนำเข้าทั้งเจ็ดชั้นจาก forest-map.namphraesmartcity.ai เป็นครั้งแรก
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.layers.map((row) => (
          <MapLayerCard
            key={row.layer.id}
            row={row}
            api={FOREST_API}
            onChanged={() => void mutate()}
          />
        ))}
      </div>
    </AdminLayout>
  );
}

export default withMemberGuard(ForestLayersPage);
