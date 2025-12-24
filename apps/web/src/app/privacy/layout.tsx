import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'DBView Privacy Policy. Learn how we protect your privacy. DBView runs entirely on your local machine - your database credentials and data never pass through our servers.',
  keywords: [
    'DBView privacy policy',
    'database client privacy',
    'data protection',
    'GDPR compliance',
  ],
  openGraph: {
    title: 'Privacy Policy - DBView',
    description: 'Learn how DBView protects your privacy. Your data stays on your machine.',
    url: 'https://dbview.app/privacy',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DBView Privacy Policy',
      },
    ],
  },
  twitter: {
    title: 'Privacy Policy - DBView',
    description: 'Learn how DBView protects your privacy.',
  },
  alternates: {
    canonical: 'https://dbview.app/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
