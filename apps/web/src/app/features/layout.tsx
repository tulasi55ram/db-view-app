import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Features - Schema Explorer, SQL Editor, ER Diagrams & More',
  description: 'Explore DBView features: Schema Explorer, Intelligent SQL Editor, Visual ER Diagrams, Inline Data Editing, Advanced Filtering, and Export/Import. Support for PostgreSQL, MySQL, MongoDB, SQLite, Redis, and SQL Server.',
  keywords: [
    'database features',
    'schema explorer',
    'SQL editor',
    'ER diagrams',
    'entity relationship diagram',
    'database visualization',
    'data filtering',
    'data export',
    'PostgreSQL editor',
    'MySQL editor',
    'MongoDB viewer',
  ],
  openGraph: {
    title: 'DBView Features - Everything You Need for Database Management',
    description: 'Schema Explorer, SQL Editor, ER Diagrams, Data Editing, and more. All the tools you need in one beautiful interface.',
    url: 'https://dbview.app/features',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DBView Features',
      },
    ],
  },
  twitter: {
    title: 'DBView Features - Schema Explorer, SQL Editor, ER Diagrams',
    description: 'Everything you need for database management in one beautiful interface.',
  },
  alternates: {
    canonical: 'https://dbview.app/features',
  },
}

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
