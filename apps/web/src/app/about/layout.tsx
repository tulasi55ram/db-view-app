import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us - Our Mission to Make Databases Delightful',
  description: 'Learn about DBView and our mission to build the best database client for developers. Meet our team and discover our journey from side project to developer tool.',
  keywords: [
    'about DBView',
    'database tool company',
    'developer tools',
    'database client team',
    'Safenest Technologies',
  ],
  openGraph: {
    title: 'About DBView - Making Databases Delightful',
    description: 'Learn about our mission, values, and the team behind DBView.',
    url: 'https://dbview.app/about',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'About DBView',
      },
    ],
  },
  twitter: {
    title: 'About DBView - Making Databases Delightful',
    description: 'Learn about our mission, values, and the team behind DBView.',
  },
  alternates: {
    canonical: 'https://dbview.app/about',
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
