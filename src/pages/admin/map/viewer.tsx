import dynamic from 'next/dynamic';
import Link from 'next/link';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import { mapFetcher, type AdminLayerRow } from '@/lib/map-api';
import type { ViewerLayer } from '@/components/MapViewer';

export const getServerSideProps = getMemberSsrProps;

// หมายเหตุการวางไฟล์: หน้านี้อยู่ที่ /admin/map/viewer ซึ่งเป็น segment แบบคงที่
// จึงชนะ [layerId].tsx ตามกฎ routing ของ Next — แปลว่า "viewer" ใช้เป็น id ของ
// เลเยอร์ไม่ได้ (จะเปิดหน้าตั้งค่าของมันไม่ได้) ไม่ใช่ปัญหาในทางปฏิบัติเพราะ id
// มาจากสคริปต์นำเข้าและหลังบ้าน ไม่ใช่จากผู้ใช้ทั่วไป

const MapViewer = dynamic(() => import('@/components/MapViewer'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-paper">
      <p className="text-[13px] text-ink-mute">กำลังเปิดแผนที่…</p>
    </div>
  ),
});

function AdminMapViewerPage() {
  const { data, error } = useSWR<{ layers: AdminLayerRow[] }>(
    '/api/admin/map/layers',
    mapFetcher,
    { revalidateOnFocus: false }
  );

  // เฉพาะเลเยอร์ที่มีเวอร์ชันเผยแพร่แล้ว และดึง **ไฟล์เต็ม** ผ่าน endpoint ฝั่ง
  // เจ้าหน้าที่ — ต่างจากหน้าสาธารณะที่ได้ไฟล์ที่กรองฟิลด์ออกแล้ว
  const layers: ViewerLayer[] = (data?.layers ?? [])
    .filter((row) => row.published !== null)
    .map((row) => ({
      id: row.layer.id,
      title: row.layer.title,
      featureCount: row.published!.stats.featureCount,
      geojsonUrl: `/api/admin/map/layers/${encodeURIComponent(row.layer.id)}/geojson`,
    }));

  return (
    <AdminLayout
      title="แผนที่ (ข้อมูลเต็ม)"
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
      <p className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-[12px] leading-normal text-amber-800">
        หน้านี้แสดง<strong>ทุกฟิลด์</strong>รวมข้อมูลส่วนบุคคล (เลขโฉนด ที่อยู่เจ้าของ)
        ตามไฟล์เต็มของเวอร์ชันที่เผยแพร่อยู่ — ต่างจากหน้าแผนที่สาธารณะที่{' '}
        <Link href="/map" target="_blank" className="underline">
          /map
        </Link>{' '}
        ซึ่งเห็นเฉพาะฟิลด์ที่เปิดไว้
      </p>

      {error ? (
        <p className="text-[13px] text-red-700">{(error as Error).message}</p>
      ) : !data ? (
        <p className="text-[13px] text-ink-mute">กำลังโหลด…</p>
      ) : layers.length === 0 ? (
        <div className="rounded-xl border border-black/[0.07] bg-white p-4">
          <p className="font-display text-[13px] font-semibold text-ink">
            ยังไม่มีชั้นข้อมูลที่เผยแพร่
          </p>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            ไปที่{' '}
            <Link href="/admin/map" className="underline">
              คลังไฟล์แผนที่
            </Link>{' '}
            แล้วกดเผยแพร่อย่างน้อยหนึ่งเลเยอร์ก่อน
          </p>
        </div>
      ) : (
        <div className="h-[calc(100vh-230px)] min-h-[420px] overflow-hidden rounded-2xl border border-black/[0.07]">
          <MapViewer layers={layers} />
        </div>
      )}
    </AdminLayout>
  );
}

export default withMemberGuard(AdminMapViewerPage);
