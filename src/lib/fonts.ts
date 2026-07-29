import { Anuphan, Noto_Sans_Thai_Looped } from 'next/font/google';

// Display / UI face — per the 1c handoff: headings, buttons, nav, numbers.
export const display = Anuphan({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

// Body face — long-form Thai civic content.
export const body = Noto_Sans_Thai_Looped({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});
