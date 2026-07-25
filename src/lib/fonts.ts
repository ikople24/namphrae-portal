import { Bai_Jamjuree, IBM_Plex_Sans_Thai } from 'next/font/google';

// Display face — geometric, lightly squared; carries the "smart city" tone.
export const display = Bai_Jamjuree({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

// Body face — highly readable for civic content in Thai and Latin.
export const body = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});
