import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { locales } from '../../i18n/request';
import '@/app/globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAGLite - AI-Powered Chat Assistant",
  description: "Experience intelligent conversations with RAGLite, your AI assistant powered by advanced retrieval-augmented generation technology.",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as typeof locales[number]) ? locale : 'en';

  // Load messages based on locale
  let messages;
  if (validLocale === 'zh-CN') {
    messages = (await import('@/messages/zh-CN.json')).default;
  } else {
    messages = (await import('@/messages/en.json')).default;
  }

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
