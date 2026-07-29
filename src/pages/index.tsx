import { useEffect, useState } from 'react';
import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import type { PublicConfig } from '@/types/portal';
import SiteHeader from '@/components/SiteHeader';
import LiveTicker from '@/components/LiveTicker';
import Hero from '@/components/Hero';
import ServicesGrid from '@/components/ServicesGrid';
import Footer from '@/components/Footer';

type Props = { config: PublicConfig };

export default function Home({ config }: Props) {
  const { site, categories, links } = config;

  // Shared mock PM2.5 value for ticker + hero card (drifts to feel live).
  const [pm, setPm] = useState(34);
  useEffect(() => {
    const iv = setInterval(() => setPm(32 + Math.floor(Math.random() * 5)), 3400);
    return () => clearInterval(iv);
  }, []);

  const pageTitle = `${site.orgName} — ${site.title}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={site.tagline} />
        <meta name="theme-color" content="#0f7a37" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={site.tagline} />
        <meta property="og:type" content="website" />
        {site.logoUrl ? <meta property="og:image" content={site.logoUrl} /> : null}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <SiteHeader site={site} />
      <LiveTicker pm={pm} />
      <main>
        <Hero site={site} links={links} visitorCount={config.visitorCount} pm={pm} />
        <ServicesGrid categories={categories} links={links} />
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
