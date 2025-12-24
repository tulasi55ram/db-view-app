import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'DBView Terms of Service. Read our terms and conditions for using DBView database client software.',
  keywords: [
    'DBView terms of service',
    'database client terms',
    'software license',
  ],
  openGraph: {
    title: 'Terms of Service - DBView',
    description: 'Terms and conditions for using DBView.',
    url: 'https://dbview.app/terms',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DBView Terms of Service',
      },
    ],
  },
  twitter: {
    title: 'Terms of Service - DBView',
    description: 'Terms and conditions for using DBView.',
  },
  alternates: {
    canonical: 'https://dbview.app/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
