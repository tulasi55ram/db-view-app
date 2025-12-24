import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us - Get in Touch',
  description: 'Have questions about DBView? Contact our team for support, feedback, or partnership inquiries. We typically respond within 24 hours.',
  keywords: [
    'contact DBView',
    'DBView support',
    'database client support',
    'developer tool support',
  ],
  openGraph: {
    title: 'Contact DBView - We Would Love to Hear From You',
    description: 'Have questions or feedback? Reach out to our team. Average response time: under 24 hours.',
    url: 'https://dbview.app/contact',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Contact DBView',
      },
    ],
  },
  twitter: {
    title: 'Contact DBView',
    description: 'Have questions or feedback? Reach out to our team.',
  },
  alternates: {
    canonical: 'https://dbview.app/contact',
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
