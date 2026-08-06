import Head from 'next/head';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import SiteHeader from '@/components/SiteHeader';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import { mapFetcher } from '@/lib/map-api';
import type { ViewerLayer } from '@/components/MapViewer';
import type { PublicConfig } from '@/types/portal';

// Leaflet แตะ window ตั้งแต่ตอนโหลดโมดูล จึงต้องกัน SSR ไว้
const MapViewer = dynamic(() => import('@/components/MapViewer'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-paper">
      <p className="text-[13px] text-ink-mute">กำลังเปิดแผนที่…</p>
    </div>
  ),
});

type PublicLayer = {
  id: string;
  title: string;
  featureCount: number;
  geojsonUrl: string;
};

// แผนที่สาธารณะ — ดึงจาก /api/map/layers ซึ่งคืนเฉพาะเลเยอร์ที่ตั้งเป็นสาธารณะ
// และเผยแพร่แล้ว ไฟล์ที่ได้ถูกกรองฟิลด์ตั้งแต่ตอนเผยแพร่ หน้านี้จึงไม่มีทางแสดง
// ข้อมูลส่วนบุคคลได้แม้จะเขียนโค้ดพลาด — ไม่มีอะไรให้พลาด
export default function PublicMapPage({ config }: { config: PublicConfig }) {
  const { data, error } = useSWR<{ layers: PublicLayer[] }>(
    '/api/map/layers',
    mapFetcher,
    { revalidateOnFocus: false }
  );

  const layers: ViewerLayer[] = (data?.layers ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    featureCount: l.featureCount,
    geojsonUrl: l.geojsonUrl,
  }));

  return (
    <>
      <Head>
        <title>แผนที่ตำบลน้ำแพร่ · Namphrae Portal</title>
        <meta
          name="description"
          content="แผนที่ขอบเขตหมู่บ้าน ถนน อาคาร และแปลงที่ดิน ตำบลน้ำแพร่ อำเภอหางดง จังหวัดเชียงใหม่"
        />
      </Head>
      <div className="flex h-screen flex-col">
        <SiteHeader site={config.site} />
        <main className="relative flex-1">
          {error ? (
            <div className="grid h-full place-items-center px-5">
              <p className="text-[13px] text-red-700">
                เปิดแผนที่ไม่สำเร็จ: {(error as Error).message}
              </p>
            </div>
          ) : !data ? (
            <div className="grid h-full place-items-center">
              <p className="text-[13px] text-ink-mute">กำลังโหลดชั้นข้อมูล…</p>
            </div>
          ) : layers.length === 0 ? (
            <div className="grid h-full place-items-center px-5 text-center">
              <div>
                <p className="font-display text-[15px] font-semibold text-ink">
                  ยังไม่มีชั้นข้อมูลที่เผยแพร่
                </p>
                <p className="mt-1 text-[12.5px] text-ink-mute">
                  เจ้าหน้าที่ต้องเผยแพร่ชั้นข้อมูลจากหลังบ้านก่อน
                </p>
              </div>
            </div>
          ) : (
            <MapViewer layers={layers} />
          )}
        </main>
      </div>
    </>
  );
}

// ISR แบบเดียวกับหน้าอื่น — ตัวชั้นข้อมูลไม่ได้มาจากที่นี่ (คลายเอนต์ดึงจาก
// /api/map/layers ตอนเปิดหน้า) ที่นี่แค่หาหัวเว็บมาใส่ให้เข้าชุดกับหน้าอื่น
export async function getStaticProps() {
  return {
    props: { config: toPublicConfig(await getConfig()) },
    revalidate: 60,
  };
}
