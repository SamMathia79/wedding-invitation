import type { Metadata } from 'next';
import {
  Amiri,
  Aref_Ruqaa,
  Blinker,
  Cairo,
  Cinzel,
  Cormorant_Garamond,
  Montserrat,
  Noto_Naskh_Arabic,
  Playfair_Display,
  PT_Serif,
  Sacramento
} from 'next/font/google';
import './globals.css';

// Downloaded & self-hosted Google Fonts via next/font/google
const sacramento = Sacramento({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-sacramento',
  display: 'swap'
});

const ptSerif = PT_Serif({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-ptserif',
  display: 'swap'
});

const blinker = Blinker({
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700'],
  variable: '--font-blinker',
  display: 'swap'
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap'
});

// Additional CMS English Font Choices
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap'
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap'
});

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap'
});

// Arabic Fonts (CMS selectable)
const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-amiri',
  display: 'swap'
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  variable: '--font-notonaskh',
  display: 'swap'
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-arefruqaa',
  display: 'swap'
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-cairo',
  display: 'swap'
});

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://samer-and-rafca.vercel.app';
}

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: 'Samer & Rafca — Wedding Invitation | دعوة زفاف سامر ورفقا',
  description:
    'Are inviting you to witness their love story • Sunday, January 3, 2027'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontClasses = [
    sacramento.variable,
    ptSerif.variable,
    blinker.variable,
    montserrat.variable,
    cormorant.variable,
    playfair.variable,
    cinzel.variable,
    amiri.variable,
    notoNaskh.variable,
    arefRuqaa.variable,
    cairo.variable
  ].join(' ');

  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  );
}
