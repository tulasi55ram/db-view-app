import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing - Free During Beta',
  description: 'DBView is completely free during beta. No credit card required, no signup needed. Get full access to all features including Schema Explorer, SQL Editor, and ER Diagrams.',
  keywords: [
    'free database client',
    'free database tool',
    'database client pricing',
    'free SQL editor',
    'free database viewer',
    'TablePlus free alternative',
    'DBeaver alternative',
  ],
  openGraph: {
    title: 'DBView Pricing - Free During Beta',
    description: 'Get full access to all features at no cost. No credit card, no signup required.',
    url: 'https://dbview.app/pricing',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DBView Pricing - Free During Beta',
      },
    ],
  },
  twitter: {
    title: 'DBView Pricing - Free During Beta',
    description: 'Get full access to all features at no cost. No credit card, no signup required.',
  },
  alternates: {
    canonical: 'https://dbview.app/pricing',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
