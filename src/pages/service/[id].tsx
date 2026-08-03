import Head from 'next/head';
import Link from 'next/link';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import type { PublicConfig, PublicLink } from '@/types/portal';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import Icon from '@/components/Icon';
import { iconForService } from '@/lib/icons';

// Service detail page (handoff screen "1a Detail", white–green palette).
// Reached from the services grid; the outbound click beacon fires here on the
// primary CTA instead of on the grid cell.

type Props = { config: PublicConfig; link: PublicLink };

const STEPS = [
  'กดปุ่ม “เข้าใช้บริการ” เพื่อไปยังระบบ',
  'กรอกข้อมูลตามแบบฟอร์มและแนบหลักฐาน',
  'รอรับ SMS / แจ้งเตือนทาง LINE เมื่อสถานะเปลี่ยน',
];

function track(id: string) {
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    navigator.sendBeacon(`/api/track/${encodeURIComponent(id)}`);
  }
}

export default function ServiceDetail({ config, link }: Props) {
  const { site, categories } = config;
  const category = categories.find((c) => c.id === link.categoryId);
  const phone = site.contact?.phone;

  return (
    <>
      <Head>
        <title>{`${link.title} · ${site.orgName}`}</title>
        <meta name="description" content={link.subtitle || link.title} />
      </Head>

      <SiteHeader site={site} />
      <main>
        <div
          className="px-5 pb-[30px] pt-[22px] text-white sm:px-9"
          style={{ background: 'linear-gradient(160deg, #17a34a, #0f7a37)' }}
        >
          <div className="mx-auto max-w-7xl">
          <Link
            href="/#services"
            className="inline-flex items-center gap-[7px] rounded-full border border-white/30 bg-white/[0.12] px-3.5 py-[7px] font-display text-[13px] font-medium text-white transition hover:bg-white/[0.22]"
          >
            <Icon name="arrow_back" size={18} />
            กลับหน้าบริการ
          </Link>
          <div className="mt-[22px] flex items-center gap-[18px]">
            <span className="grid h-16 w-16 place-items-center rounded-[18px] border border-white/25 bg-white/[0.16]">
              <Icon name={iconForService(link.id, link.icon)} size={34} />
            </span>
            <div>
              {category ? (
                <p className="font-display text-xs font-medium uppercase tracking-[.14em] text-white/70">
                  {category.label}
                </p>
              ) : null}
              <h1 className="mt-[5px] font-display text-[26px] font-bold leading-[1.15] sm:text-[34px]">
                {link.title}
              </h1>
            </div>
          </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-7 px-5 pb-10 pt-[30px] sm:px-9 lg:grid-cols-[1.4fr_.8fr]">
          <div>
            <p className="max-w-[620px] text-[15px] leading-[1.75] text-ink">
              {link.subtitle ? `${link.subtitle} — ` : ''}
              เปิดใช้บริการนี้ได้ทันทีผ่านระบบออนไลน์ของเทศบาล ไม่ต้องเดินทางมาที่สำนักงาน
            </p>
            <div className="mt-[22px] flex flex-wrap gap-2.5">
              {link.url ? (
                <a
                  href={link.url}
                  target={link.openInNewTab ? '_blank' : undefined}
                  rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                  onClick={() => track(link.id)}
                  onAuxClick={() => track(link.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-green px-[22px] py-[13px] font-display text-[14.5px] font-semibold text-white transition hover:bg-green-deep"
                >
                  เข้าใช้บริการ
                  <Icon name="open_in_new" size={20} />
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex cursor-default items-center gap-2 rounded-xl bg-green/40 px-[22px] py-[13px] font-display text-[14.5px] font-semibold text-white"
                >
                  ยังไม่เปิดให้บริการ
                </span>
              )}
              {phone ? (
                <a
                  href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/[0.14] px-[22px] py-[13px] font-display text-[14.5px] font-semibold text-ink transition hover:bg-green-025"
                >
                  สอบถามเจ้าหน้าที่
                </a>
              ) : null}
            </div>

            <div className="mt-7 rounded-2xl border border-black/[0.08] bg-white p-[22px]">
              <p className="mb-3.5 font-display text-sm font-semibold text-ink">ขั้นตอนใช้งาน</p>
              <ol className="flex list-none flex-col gap-3 p-0">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3 text-[13.5px] leading-[1.55] text-ink">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-green-050 font-display text-xs font-semibold text-green-deep">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-5">
              <p className="mb-3 font-display text-[13.5px] font-semibold text-ink">ติดต่อ</p>
              <p className="text-[13px] leading-[1.7] text-ink-soft">
                {site.orgName}
                {site.contact?.address ? (
                  <>
                    <br />
                    {site.contact.address}
                  </>
                ) : null}
                {phone ? (
                  <>
                    <br />
                    โทร {phone}
                  </>
                ) : null}
              </p>
            </div>
            {(site.manuals ?? []).length ? (
              <div className="rounded-2xl bg-green-050 p-5">
                <p className="mb-2 font-display text-[13.5px] font-semibold text-green-deep">
                  คู่มือที่เกี่ยวข้อง
                </p>
                {(site.manuals ?? []).map((m) => (
                  <a
                    key={m.url}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-[9px] py-[7px] font-display text-[13px] font-medium text-green-deep hover:underline"
                  >
                    <Icon name="picture_as_pdf" size={19} />
                    {m.label}
                  </a>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </main>
      <Footer site={site} visitorCount={config.visitorCount} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const config = toPublicConfig(await getConfig());
  return {
    paths: config.links.map((l) => ({ params: { id: l.id } })),
    fallback: 'blocking', // links added later render on first request
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const config = toPublicConfig(await getConfig());
  const id = String(ctx.params?.id ?? '');
  const link = config.links.find((l) => l.id === id);
  if (!link) return { notFound: true, revalidate: 60 };
  return { props: { config, link }, revalidate: 60 };
};
