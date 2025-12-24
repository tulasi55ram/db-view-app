import { NextResponse } from 'next/server'

/**
 * Sitemap Index - Lists all sitemaps for the site
 * Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
 */

const baseUrl = 'https://dbview.app'

function generateSitemapIndex(): string {
  const lastModified = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${lastModified}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/image-sitemap.xml</loc>
    <lastmod>${lastModified}</lastmod>
  </sitemap>
</sitemapindex>`
}

export async function GET() {
  const sitemapIndex = generateSitemapIndex()

  return new NextResponse(sitemapIndex, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
