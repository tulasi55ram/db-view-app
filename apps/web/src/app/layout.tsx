import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { JsonLd } from '@/components/seo/json-ld'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

// Site configuration - centralized for easy updates
const siteConfig = {
  name: 'DBView',
  description: 'The modern database client for VS Code and Desktop. Explore, query, and visualize PostgreSQL, MySQL, MongoDB, SQLite, Redis, and SQL Server with a beautiful, intuitive interface.',
  shortDescription: 'Explore, query, and visualize your databases with a beautiful, intuitive interface.',
  url: 'https://dbview.app',
  ogImage: '/og-image.png',
  twitterHandle: '@dbview',
  creator: 'Safenest Technologies Ltd',
  email: 'hello@dbview.app',
}

// Viewport configuration (separated from metadata in Next.js 14+)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export const metadata: Metadata = {
  // Base URL for resolving relative URLs
  metadataBase: new URL(siteConfig.url),

  // Primary meta tags with template support
  title: {
    default: 'DBView - The Modern Database Client for VS Code & Desktop',
    template: '%s | DBView',
  },
  description: siteConfig.description,

  // Keywords - comprehensive for SEO
  keywords: [
    'database client',
    'database viewer',
    'database GUI',
    'PostgreSQL client',
    'MySQL client',
    'MongoDB client',
    'SQLite viewer',
    'Redis client',
    'SQL Server client',
    'VS Code database extension',
    'VS Code database',
    'database extension',
    'SQL editor',
    'SQL IDE',
    'ER diagram',
    'schema explorer',
    'database management',
    'database tool',
    'free database client',
    'open source database client',
    'cross-platform database client',
    'macOS database client',
    'Windows database client',
    'Linux database client',
    'TablePlus alternative',
    'DBeaver alternative',
    'DataGrip alternative',
    'Sequel Pro alternative',
    'HeidiSQL alternative',
    'Beekeeper Studio alternative',
    'database browser',
    'query editor',
    'database explorer',
  ],

  // Author and creator information
  authors: [
    { name: 'DBView Team', url: siteConfig.url },
    { name: siteConfig.creator },
  ],
  creator: siteConfig.creator,
  publisher: siteConfig.name,

  // Robots directives - optimized for SEO
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Open Graph metadata (Facebook, LinkedIn, Discord, Slack, etc.)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: 'DBView - The Modern Database Client',
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: 'DBView - The Modern Database Client for VS Code & Desktop',
        type: 'image/png',
      },
    ],
  },

  // Twitter Card metadata
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
    title: 'DBView - The Modern Database Client',
    description: siteConfig.shortDescription,
    images: {
      url: siteConfig.ogImage,
      alt: 'DBView - The Modern Database Client',
    },
  },

  // Favicon and app icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#6366f1' },
    ],
  },

  // Web app manifest
  manifest: '/site.webmanifest',

  // Canonical and alternate URLs
  alternates: {
    canonical: siteConfig.url,
    languages: {
      'en-US': siteConfig.url,
    },
  },

  // App-specific metadata
  applicationName: siteConfig.name,
  category: 'developer tools',

  // Search engine verification (add your IDs when ready)
  verification: {
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },

  // Additional meta tags
  other: {
    'msapplication-TileColor': '#6366f1',
    'msapplication-config': '/browserconfig.xml',
    'format-detection': 'telephone=no',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': siteConfig.name,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth" dir="ltr">
      <head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* JSON-LD Structured Data */}
        <JsonLd />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  )
}
