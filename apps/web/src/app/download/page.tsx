'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Header } from '@/components/sections/header'
import { Footer } from '@/components/sections/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Apple,
  Monitor,
  Terminal,
  Code2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'

const platforms = [
  {
    name: 'macOS',
    icon: Apple,
    description: 'For Intel and Apple Silicon Macs',
    version: 'macOS 11+',
    downloads: [
      { name: 'Apple Silicon (M1/M2/M3)', file: 'dbview-1.0.0-arm64.dmg', external: false },
      { name: 'Intel', file: 'dbview-1.0.0-x64.dmg', external: false },
    ],
    color: 'from-gray-700 to-gray-900',
  },
  {
    name: 'Windows',
    icon: Monitor,
    description: 'For Windows 10 and 11',
    version: 'Windows 10+',
    downloads: [
      { name: 'Installer (Recommended)', file: 'dbview-1.0.0-setup.exe', external: false },
      { name: 'Portable', file: 'dbview-1.0.0-portable.exe', external: false },
    ],
    color: 'from-blue-600 to-blue-800',
  },
  {
    name: 'Linux',
    icon: Terminal,
    description: 'For Ubuntu, Fedora, and more',
    version: 'Ubuntu 20.04+',
    downloads: [
      { name: 'AppImage', file: 'dbview-1.0.0.AppImage', external: false },
      { name: 'Debian/Ubuntu (.deb)', file: 'dbview-1.0.0.deb', external: false },
      { name: 'Fedora/RHEL (.rpm)', file: 'dbview-1.0.0.rpm', external: false },
    ],
    color: 'from-orange-500 to-orange-700',
  },
  {
    name: 'VS Code Extension',
    icon: Code2,
    description: 'Use DBView inside VS Code',
    version: 'VS Code 1.84+',
    downloads: [
      { name: 'VS Code Marketplace', file: 'marketplace', external: true },
    ],
    color: 'from-indigo-500 to-purple-600',
    featured: true,
  },
]

const features = [
  'Unlimited database connections',
  'PostgreSQL, MySQL, SQLite support',
  'Schema browser & SQL editor',
  'Basic data filtering',
  'CSV/JSON export',
  'Automatic updates',
]

export default function DownloadPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="gradient" className="mb-4">
              Version 1.0.0
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Download DBView
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8"
          >
            Get started with DBView for free. Available for macOS, Windows, Linux,
            and as a VS Code extension.
          </motion.p>

          {/* Free features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 mb-12"
          >
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                {feature}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Download Cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className={`glass-card rounded-2xl p-8 ${
                  platform.featured ? 'md:col-span-2' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${platform.color} flex items-center justify-center shadow-lg`}
                  >
                    <platform.icon className="h-8 w-8 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {platform.name}
                      </h3>
                      {platform.featured && (
                        <Badge variant="gradient">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-1">
                      {platform.description}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Requires {platform.version}
                    </p>

                    {/* Download buttons */}
                    <div className="flex flex-wrap gap-3">
                      {platform.downloads.map((download, i) => (
                        <Button
                          key={download.name}
                          variant={i === 0 ? 'default' : 'outline'}
                          size="lg"
                          asChild
                        >
                          {download.external ? (
                            <Link
                              href="https://marketplace.visualstudio.com/items?itemName=dbview.dbview"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {download.name}
                            </Link>
                          ) : (
                            <Link href={`/releases/${download.file}`}>
                              <Download className="h-4 w-4 mr-2" />
                              {download.name}
                            </Link>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Other options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 text-center"
          >
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Need help getting started?
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/contact">
                  Contact Support
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* System Requirements */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            System Requirements
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Apple className="h-5 w-5" />
                macOS
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>macOS 11 (Big Sur) or later</li>
                <li>Apple Silicon or Intel processor</li>
                <li>4GB RAM minimum</li>
                <li>200MB disk space</li>
              </ul>
            </div>

            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Windows
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Windows 10 or later</li>
                <li>x64 processor</li>
                <li>4GB RAM minimum</li>
                <li>200MB disk space</li>
              </ul>
            </div>

            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Linux
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Ubuntu 20.04+, Fedora 36+</li>
                <li>x64 processor</li>
                <li>4GB RAM minimum</li>
                <li>200MB disk space</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
