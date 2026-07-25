import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ClerkProvider } from '@clerk/nextjs';
import { body, display } from '@/lib/fonts';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

// Clerk wraps the app only when a publishable key is present, so the portal
// boots and runs with zero configuration (admin then runs in dev-open mode).
export default function App({ Component, pageProps }: AppProps) {
  const shell = (
    <div className={`${display.variable} ${body.variable}`}>
      <Component {...pageProps} />
    </div>
  );

  if (isClerkPublicConfigured()) {
    return <ClerkProvider {...pageProps}>{shell}</ClerkProvider>;
  }
  return shell;
}
