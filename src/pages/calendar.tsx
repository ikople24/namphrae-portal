import { useState } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import MonthGrid from '@/components/MonthGrid';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import { currentMonthInBangkok } from '@/lib/calendar-grid';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import { JOB_KIND_LABEL, type PublicConfig, type PublicJob } from '@/types/portal';

type Feed = { month: string; jobs: PublicJob[] };

const fetcher = (url: string): Promise<Feed> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`โหลดปฏิทินไม่สำเร็จ (${r.status})`);
    return r.json();
  });

// ข้อมูลถูก mask แล้วจึงไม่มีค่าทาง SEO — ดึงฝั่ง client ตรง ๆ ได้ ไม่ต้องทำ ISR
// ให้ครบทุกเดือน และเปลี่ยนเดือนได้ทันทีโดยไม่ต้อง pre-render ล่วงหน้า
export default function CalendarPage({ config }: { config: PublicConfig }) {
  const [month, setMonth] = useState(currentMonthInBangkok());
  const { data, error, isLoading } = useSWR<Feed>(
    `/api/calendar?month=${month}`,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <>
      <Head>
        <title>{`ปฏิทินปฏิบัติงาน · ${config.site.orgName}`}</title>
        <meta
          name="description"
          content="ตารางงานกู้ชีพและงานป้องกันของเทศบาลตำบลน้ำแพร่พัฒนา"
        />
      </Head>

      <SiteHeader site={config.site} />

      <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-11">
        <h1 className="font-display text-[22px] font-bold text-ink">
          ปฏิทินปฏิบัติงาน
        </h1>
        <p className="mb-5 mt-1 text-[13.5px] text-ink-soft">
          ตารางงาน{JOB_KIND_LABEL.ems}และ{JOB_KIND_LABEL.rescue}ที่ได้รับอนุมัติแล้ว
          — แสดงเฉพาะเวลา ประเภทงาน และพื้นที่ ไม่เปิดเผยข้อมูลส่วนบุคคลของผู้รับบริการ
        </p>

        {error ? (
          <p className="rounded-xl border border-red-300/60 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
            {error instanceof Error ? error.message : 'โหลดปฏิทินไม่สำเร็จ'}
          </p>
        ) : (
          <>
            <MonthGrid
              month={month}
              jobs={data?.jobs ?? []}
              onMonthChange={setMonth}
              // spec ข้อ 2 บอกว่าสาธารณะเห็น เวลา + ประเภทงาน + หมู่บ้าน — village
              // เป็นฟิลด์เดียวที่ไม่ใช่ PII ที่ toPublicJob ส่งมาให้ ถ้าไม่ใช้ตรงนี้
              // ก็เท่ากับส่งมาเปล่า ๆ และหน้าเว็บก็ไม่ตรงกับที่ spec สัญญาไว้
              renderLabel={(job) =>
                job.village
                  ? `${JOB_KIND_LABEL[job.kind]} · ${job.village}`
                  : JOB_KIND_LABEL[job.kind]
              }
            />
            {isLoading && !data ? (
              <p className="mt-3 text-[13px] text-ink-soft">กำลังโหลด…</p>
            ) : null}
          </>
        )}
      </main>

      <Footer site={config.site} visitorCount={config.visitorCount} />
    </>
  );
}

// หน้าเปลือกเป็น static ส่วนงานในปฏิทินมาทีหลังจาก /api/calendar
export async function getStaticProps() {
  return {
    props: { config: toPublicConfig(await getConfig()) },
    revalidate: 60,
  };
}
