import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import type { PublicConfig } from '@/types/portal';
import SiteHeader from '@/components/SiteHeader';
import Hero from '@/components/Hero';
import CategorySection from '@/components/CategorySection';
import ManualsSection from '@/components/ManualsSection';
import Footer from '@/components/Footer';

type Props = { config: PublicConfig };

export default function Home({ config }: Props) {
  const { site, categories, links } = config;

  const featured = links.filter((l) => l.isFeatured);
  const inGrid = links.filter((l) => !l.isFeatured);

  const pageTitle = `${site.orgName} — ${site.title}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={site.tagline} />
        <meta name="theme-color" content="#0a4e43" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={site.tagline} />
        <meta property="og:type" content="website" />
        {site.logoUrl ? (
          <meta property="og:image" content={site.logoUrl} />
        ) : null}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <SiteHeader site={site} />
      <main>
        <Hero site={site} featured={featured} />

        <div className="mx-auto max-w-6xl space-y-12 px-5 py-12 sm:px-8 md:space-y-14">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              links={inGrid.filter((l) => l.categoryId === category.id)}
            />
          ))}

          <ManualsSection manuals={site.manuals ?? []} />
        </div>
      </main>
      <Footer site={site} visitorCount={config.visitorCount} />
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const config = toPublicConfig(await getConfig());
  return {
    props: { config },
    revalidate: 60, // ISR: rebuild at most once a minute; admin also revalidates on demand
  };
};
