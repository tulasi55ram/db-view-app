// JSON-LD Structured Data for SEO
// Reference: https://developers.google.com/search/docs/appearance/structured-data

const siteConfig = {
  name: 'DBView',
  url: 'https://dbview.app',
  description: 'The modern database client for VS Code and Desktop. Explore, query, and visualize PostgreSQL, MySQL, MongoDB, SQLite, Redis, and SQL Server.',
  logo: 'https://dbview.app/logo-bg-large.png',
  ogImage: 'https://dbview.app/og-image.png',
  email: 'hello@dbview.app',
  creator: 'Safenest Technologies Ltd',
  twitterHandle: '@dbview',
}

// Primary Image Object - Main product screenshot
const primaryImageObject = {
  '@type': 'ImageObject',
  url: siteConfig.ogImage,
  width: 1200,
  height: 630,
  caption: 'DBView database client interface showing schema explorer, SQL editor, and data grid',
  description: 'Screenshot of DBView - The modern database client for VS Code and Desktop featuring multi-database support for PostgreSQL, MySQL, MongoDB, SQLite, Redis, and SQL Server',
  name: 'DBView Product Screenshot',
  contentUrl: siteConfig.ogImage,
  thumbnailUrl: siteConfig.logo,
}

// Logo Image Object
const logoImageObject = {
  '@type': 'ImageObject',
  url: siteConfig.logo,
  width: 512,
  height: 512,
  caption: 'DBView Logo - Modern Database Client',
  name: 'DBView Logo',
}

// Organization Schema
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteConfig.name,
  url: siteConfig.url,
  logo: logoImageObject,
  image: [siteConfig.ogImage, siteConfig.logo],
  description: siteConfig.description,
  email: siteConfig.email,
  foundingDate: '2023',
  founder: {
    '@type': 'Organization',
    name: siteConfig.creator,
  },
  sameAs: [
    'https://twitter.com/dbview',
    'https://linkedin.com/company/dbview',
    'https://youtube.com/@dbview',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: siteConfig.email,
    contactType: 'customer support',
    availableLanguage: 'English',
  },
}

// Software Application Schema (main product)
const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows, macOS, Linux',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free during beta',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
    bestRating: '5',
    worstRating: '1',
  },
  featureList: [
    'PostgreSQL support',
    'MySQL support',
    'MongoDB support',
    'SQLite support',
    'Redis support',
    'SQL Server support',
    'VS Code extension',
    'Desktop application',
    'ER diagrams',
    'SQL editor with syntax highlighting',
    'Schema explorer',
    'Data export',
  ],
  screenshot: primaryImageObject,
  image: [siteConfig.ogImage, siteConfig.logo],
  thumbnailUrl: siteConfig.logo,
  softwareVersion: '1.0.0-beta',
  author: {
    '@type': 'Organization',
    name: siteConfig.creator,
    logo: logoImageObject,
  },
}

// WebSite Schema (for sitelinks search box)
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  image: primaryImageObject,
  thumbnailUrl: siteConfig.logo,
  publisher: {
    '@type': 'Organization',
    name: siteConfig.name,
    logo: logoImageObject,
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

// BreadcrumbList Schema (for main navigation)
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: siteConfig.url,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Features',
      item: `${siteConfig.url}/features`,
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Pricing',
      item: `${siteConfig.url}/pricing`,
    },
    {
      '@type': 'ListItem',
      position: 4,
      name: 'Download',
      item: `${siteConfig.url}/download`,
    },
  ],
}

// FAQ Schema (common questions)
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What databases does DBView support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DBView supports PostgreSQL, MySQL, MongoDB, SQLite, Redis, and SQL Server. We are continuously adding support for more databases.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is DBView free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! DBView is completely free during the beta period. We plan to introduce a freemium model in the future with a generous free tier for individual developers.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does DBView work with VS Code?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, DBView is available as a VS Code extension. You can install it directly from the VS Code marketplace and manage your databases without leaving your editor.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my data secure with DBView?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolutely. DBView runs entirely on your local machine. Your database credentials and data never pass through our servers. All connections are made directly from your computer to your database.',
      },
    },
    {
      '@type': 'Question',
      name: 'What platforms does DBView support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DBView is available for Windows, macOS, and Linux as both a standalone desktop application and a VS Code extension.',
      },
    },
  ],
}

export function JsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
    </>
  )
}

// Export schemas for use in specific pages
export { organizationSchema, softwareApplicationSchema, websiteSchema, breadcrumbSchema, faqSchema }
