'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Header } from '@/components/sections/header'
import { Footer } from '@/components/sections/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Code2,
  GitBranch,
  Zap,
  Shield,
  Table2,
  Search,
  FileJson,
  BarChart3,
  RefreshCw,
  Layers,
  Sparkles,
  ArrowRight,
  Check,
  Terminal,
  Eye,
  Edit3,
  Filter,
  Download,
} from 'lucide-react'

const mainFeatures = [
  {
    id: 'schema',
    icon: Layers,
    title: 'Schema Explorer',
    tagline: 'Navigate your database structure with ease',
    description:
      'Browse through schemas, tables, views, functions, and indexes with an intuitive tree view. Get instant access to column metadata, relationships, and constraints.',
    features: [
      'Hierarchical tree navigation',
      'Column metadata at a glance',
      'Foreign key relationships',
      'Index information',
      'View definitions',
      'Function signatures',
    ],
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'sql-editor',
    icon: Code2,
    title: 'Intelligent SQL Editor',
    tagline: 'Write queries faster than ever',
    description:
      'A powerful SQL editor with smart autocomplete that understands your schema. Syntax highlighting, formatting, and real-time error detection make writing SQL a breeze.',
    features: [
      'Context-aware autocomplete',
      'Schema-aware suggestions',
      'Syntax highlighting',
      'One-click formatting',
      'Multi-query execution',
      'Query history & favorites',
    ],
    color: 'from-purple-500 to-pink-600',
  },
  {
    id: 'er-diagrams',
    icon: GitBranch,
    title: 'Visual ER Diagrams',
    tagline: 'See your database relationships',
    description:
      'Generate beautiful entity-relationship diagrams automatically from your schema. Understand complex relationships at a glance with interactive, draggable nodes.',
    features: [
      'Auto-generated diagrams',
      'Interactive drag & drop',
      'Multi-schema support',
      'Relationship visualization',
      'Export as PNG/SVG',
      'Zoom and pan controls',
    ],
    color: 'from-green-500 to-emerald-600',
  },
  {
    id: 'data-editing',
    icon: Edit3,
    title: 'Inline Data Editing',
    tagline: 'Edit data directly in the grid',
    description:
      'Make changes to your data without writing SQL. Type-aware editors ensure data integrity, and batch commit lets you review changes before saving.',
    features: [
      'Click-to-edit cells',
      'Type-specific editors',
      'Insert new rows',
      'Batch delete operations',
      'Change preview',
      'One-click rollback',
    ],
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'filtering',
    icon: Filter,
    title: 'Advanced Filtering',
    tagline: 'Find exactly what you need',
    description:
      'Build complex filter queries with an intuitive visual builder. Combine multiple conditions with AND/OR logic across all data types.',
    features: [
      'Visual filter builder',
      'AND/OR logic groups',
      'All operator types',
      'Quick filter bar',
      'Save filter presets',
      'Regex support',
    ],
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'export',
    icon: Download,
    title: 'Export & Import',
    tagline: 'Move data seamlessly',
    description:
      'Export query results or entire tables to CSV, JSON, or SQL INSERT statements. Import data just as easily with automatic type detection.',
    features: [
      'CSV export/import',
      'JSON export/import',
      'SQL INSERT statements',
      'Filtered exports',
      'Column selection',
      'Encoding options',
    ],
    color: 'from-rose-500 to-pink-600',
  },
]

const databases = [
  { name: 'PostgreSQL', color: '#336791', description: 'Full support including schemas, arrays, JSON' },
  { name: 'MySQL', color: '#4479A1', description: 'Complete support with stored procedures' },
  { name: 'SQL Server', color: '#CC2927', description: 'Windows & SQL authentication' },
  { name: 'SQLite', color: '#003B57', description: 'Local file-based databases' },
  { name: 'MongoDB', color: '#47A248', description: 'Collections, documents, aggregations' },
  { name: 'Redis', color: '#DC382D', description: 'Keys, values, pub/sub monitoring' },
]

export default function FeaturesPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4">
              Features
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Everything you need,
            <br />
            <span className="text-gradient">nothing you don&apos;t</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8"
          >
            DBView packs powerful features into an intuitive interface. No bloat,
            no learning curve, just pure productivity.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button size="lg" variant="gradient" asChild>
              <Link href="/download">
                Download Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/about">About Us</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Database Support */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Connect to all your databases
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              First-class support for SQL and NoSQL databases
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {databases.map((db, index) => (
              <motion.div
                key={db.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card rounded-xl p-6 text-center cursor-pointer"
              >
                <div
                  className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${db.color}20` }}
                >
                  <Database className="h-6 w-6" style={{ color: db.color }} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {db.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {db.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {mainFeatures.map((feature, index) => (
            <motion.div
              key={feature.id}
              id={feature.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-20 py-20 ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Content */}
              <div className="flex-1">
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-6 shadow-lg`}
                >
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-lg text-indigo-600 dark:text-indigo-400 mb-4">
                  {feature.tagline}
                </p>
                <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                  {feature.description}
                </p>
                <ul className="grid grid-cols-2 gap-3">
                  {feature.features.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="flex-1 w-full">
                <div
                  className={`relative rounded-2xl p-1 bg-gradient-to-br ${feature.color}`}
                >
                  <div className="bg-gray-900 rounded-xl p-6 aspect-[4/3] flex items-center justify-center">
                    <feature.icon className="h-24 w-24 text-white/20" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to experience DBView?
          </h2>
          <p className="text-white/80 mb-8">
            Download now and transform your database workflow.
          </p>
          <Button
            size="xl"
            className="bg-white text-indigo-600 hover:bg-gray-100"
            asChild
          >
            <Link href="/download">
              Download for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  )
}
