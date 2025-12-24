import { NextResponse } from 'next/server'

/**
 * Image Sitemap for Google Image Search Discovery
 * Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */

const baseUrl = 'https://dbview.app'

interface ImageEntry {
  loc: string
  images: {
    url: string
    title: string
    caption: string
    license?: string
  }[]
}

const imageEntries: ImageEntry[] = [
  {
    loc: baseUrl,
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        title: 'DBView - Modern Database Client Interface',
        caption: 'DBView database client showing schema explorer, SQL editor, and data grid with PostgreSQL, MySQL, MongoDB, SQLite, Redis, and SQL Server support',
      },
      {
        url: `${baseUrl}/logo-bg-large.png`,
        title: 'DBView Logo',
        caption: 'DBView official logo - The modern database client for VS Code and Desktop',
      },
    ],
  },
  {
    loc: `${baseUrl}/features`,
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        title: 'DBView Features Overview',
        caption: 'Explore DBView features: multi-database support, SQL editor, ER diagrams, schema browser, and data export capabilities',
      },
    ],
  },
  {
    loc: `${baseUrl}/download`,
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        title: 'Download DBView',
        caption: 'Download DBView for Windows, macOS, Linux, or install the VS Code extension',
      },
    ],
  },
  {
    loc: `${baseUrl}/pricing`,
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        title: 'DBView Pricing Plans',
        caption: 'DBView pricing - Free during beta, with plans for individual developers and teams',
      },
    ],
  },
  {
    loc: `${baseUrl}/about`,
    images: [
      {
        url: `${baseUrl}/logo-bg-large.png`,
        title: 'About DBView',
        caption: 'Learn about DBView and the team behind the modern database client',
      },
    ],
  },
]

function generateImageSitemap(): string {
  const urlEntries = imageEntries
    .map(
      (entry) => `
  <url>
    <loc>${entry.loc}</loc>
    ${entry.images
      .map(
        (image) => `
    <image:image>
      <image:loc>${image.url}</image:loc>
      <image:title>${escapeXml(image.title)}</image:title>
      <image:caption>${escapeXml(image.caption)}</image:caption>
    </image:image>`
      )
      .join('')}
  </url>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const sitemap = generateImageSitemap()

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
