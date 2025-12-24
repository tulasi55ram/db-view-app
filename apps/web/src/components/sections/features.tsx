'use client'

import React from 'react'
import { motion } from 'framer-motion'
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
} from 'lucide-react'

const features = [
  {
    icon: Database,
    title: 'Multi-Database Support',
    description:
      'Connect to PostgreSQL, MySQL, SQL Server, SQLite, MongoDB, and Redis. All your databases in one beautiful interface.',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    icon: Code2,
    title: 'Intelligent SQL Editor',
    description:
      'Write queries faster with smart autocomplete, syntax highlighting, and real-time error detection.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: GitBranch,
    title: 'Visual ER Diagrams',
    description:
      'Understand your database structure at a glance with interactive entity-relationship diagrams.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Table2,
    title: 'Inline Data Editing',
    description:
      'Edit cells directly in the data grid with type-aware editors. Insert, update, and delete with confidence.',
    color: 'from-orange-500 to-amber-500',
  },
  {
    icon: Search,
    title: 'Advanced Filtering',
    description:
      'Build complex filter queries with an intuitive visual builder. Support for AND/OR logic and all data types.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    icon: FileJson,
    title: 'Export Anywhere',
    description:
      'Export data to CSV, JSON, or SQL INSERT statements. Import data just as easily.',
    color: 'from-rose-500 to-pink-500',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Virtual scrolling and smart pagination handle millions of rows without breaking a sweat.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description:
      'Credentials stored in secure system keychain. Support for SSL/TLS and SSH tunnels.',
    color: 'from-teal-500 to-green-500',
  },
  {
    icon: BarChart3,
    title: 'Query Analytics',
    description:
      'Analyze query performance with EXPLAIN plans. Optimize your database queries like a pro.',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    icon: RefreshCw,
    title: 'Real-time Sync',
    description:
      'See changes as they happen with optional live refresh. Perfect for monitoring active databases.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: Layers,
    title: 'Schema Browser',
    description:
      'Navigate through schemas, tables, views, functions, and indexes with an intuitive tree view.',
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: Sparkles,
    title: 'Saved Views',
    description:
      'Save filtered and sorted table configurations for quick access. Share views with your team.',
    color: 'from-amber-500 to-yellow-500',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
}

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4">
              Features
            </Badge>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            Everything you need to
            <span className="text-gradient"> manage databases</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300"
          >
            Packed with powerful features designed to make database management a
            breeze. No more switching between tools.
          </motion.p>
        </div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              whileHover={{ y: -5 }}
              className="group relative"
            >
              <div className="h-full glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-xl">
                {/* Icon */}
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-lg`}
                >
                  <feature.icon className="h-6 w-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover gradient */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 -z-10`}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
