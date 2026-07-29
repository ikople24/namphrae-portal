import { Html, Head, Main, NextScript } from 'next/document';
import { ICON_FONT_HREF } from '@/lib/icons';

export default function Document() {
  return (
    <Html lang="th">
      <Head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={ICON_FONT_HREF} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
