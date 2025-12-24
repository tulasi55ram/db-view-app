import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Download - Free for macOS, Windows, Linux & VS Code',
  description: 'Download DBView for free. Available for macOS (Intel & Apple Silicon), Windows, Linux, and as a VS Code extension. No signup required.',
  keywords: [
    'download database client',
    'database client macOS',
    'database client Windows',
    'database client Linux',
    'VS Code database extension',
    'free database download',
    'PostgreSQL client download',
    'MySQL client download',
  ],
  openGraph: {
    title: 'Download DBView - Free for All Platforms',
    description: 'Download DBView for macOS, Windows, Linux, and VS Code. Free during beta with all features included.',
    url: 'https://dbview.app/download',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Download DBView',
      },
    ],
  },
  twitter: {
    title: 'Download DBView - Free for All Platforms',
    description: 'Download DBView for macOS, Windows, Linux, and VS Code. Free during beta.',
  },
  alternates: {
    canonical: 'https://dbview.app/download',
  },
}

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
