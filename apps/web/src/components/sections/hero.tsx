'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

const features = [
  'Multi-database support',
  'Visual ER diagrams',
  'SQL autocomplete',
  'One-click export',
]

const databaseIcons = [
  { name: 'PostgreSQL', color: '#336791' },
  { name: 'MySQL', color: '#4479A1' },
  { name: 'MongoDB', color: '#47A248' },
  { name: 'SQLite', color: '#003B57' },
  { name: 'Redis', color: '#DC382D' },
  { name: 'SQL Server', color: '#CC2927' },
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient orbs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-float" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 dark:bg-yellow-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-float animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-float animation-delay-4000" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-float" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid dark:bg-grid-dark" />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-background/50 to-background" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32 sm:py-40">
        <div className="text-center">
          {/* Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="gradient"
              className="mb-6 px-4 py-1.5 text-sm cursor-pointer hover:scale-105 transition-transform"
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Public Beta — Free for Everyone
            </Badge>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
          >
            <span className="text-gray-900 dark:text-white">The Modern</span>
            <br />
            <span className="text-gradient">Database Client</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed"
          >
            Explore, query, and visualize your databases with a beautiful,
            intuitive interface. Built for developers who demand speed and elegance.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap justify-center gap-3"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-sm text-gray-700 dark:text-gray-300"
              >
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {feature}
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10"
          >
            <Button size="xl" variant="gradient" asChild>
              <Link href="/download">
                Download for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>

          {/* Database Logos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Works with all your favorite databases
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
              {databaseIcons.map((db, index) => (
                <motion.div
                  key={db.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -3 }}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${db.color}15` }}
                  >
                    <Database
                      className="h-4 w-4"
                      style={{ color: db.color }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {db.name}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Product Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="mt-20 relative"
          >
            <div className="relative mx-auto max-w-5xl">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur-2xl opacity-20 animate-pulse-slow" />

              {/* Screenshot container */}
              <div className="relative glass-card rounded-2xl p-2 shadow-2xl">
                <div className="bg-gray-900 rounded-xl overflow-hidden">
                  {/* Window controls */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="ml-4 text-sm text-gray-400 font-mono">
                      DBView - PostgreSQL
                    </span>
                  </div>

                  {/* App preview */}
                  <div className="aspect-[16/10] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
                    <div className="h-full flex gap-4">
                      {/* Sidebar */}
                      <div className="w-48 bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <div className="text-xs text-gray-400 mb-3">SCHEMAS</div>
                        {['public', 'inventory', 'analytics'].map((schema) => (
                          <div
                            key={schema}
                            className="flex items-center gap-2 text-sm text-gray-300 py-1.5 px-2 rounded hover:bg-gray-700/50 cursor-pointer"
                          >
                            <Database className="h-3.5 w-3.5 text-indigo-400" />
                            {schema}
                          </div>
                        ))}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 bg-gray-800/30 rounded-lg p-4 space-y-4">
                        {/* Tabs */}
                        <div className="flex gap-2">
                          <div className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-lg border border-indigo-500/30">
                            users
                          </div>
                          <div className="px-3 py-1.5 bg-gray-700/50 text-gray-400 text-xs rounded-lg">
                            products
                          </div>
                          <div className="px-3 py-1.5 bg-gray-700/50 text-gray-400 text-xs rounded-lg">
                            SQL Query
                          </div>
                        </div>

                        {/* Table preview */}
                        <div className="bg-gray-900/50 rounded-lg overflow-hidden">
                          <div className="grid grid-cols-4 gap-4 p-3 bg-gray-800/50 text-xs text-gray-400 border-b border-gray-700/50">
                            <div>id</div>
                            <div>name</div>
                            <div>email</div>
                            <div>created_at</div>
                          </div>
                          {[1, 2, 3].map((row) => (
                            <div
                              key={row}
                              className="grid grid-cols-4 gap-4 p-3 text-xs text-gray-300 border-b border-gray-800/50"
                            >
                              <div className="text-indigo-400">{row}</div>
                              <div>User {row}</div>
                              <div className="text-gray-400">user{row}@example.com</div>
                              <div className="text-gray-500">2024-01-{10 + row}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
