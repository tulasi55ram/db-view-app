'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Header } from '@/components/sections/header'
import { Footer } from '@/components/sections/footer'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  Database,
  Eye,
  Lock,
  Server,
  Cookie,
  UserCheck,
  Bell,
  HelpCircle,
  Mail,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'

const highlights = [
  {
    icon: Database,
    title: 'Your Data Stays Local',
    description: 'All database credentials and query data remain on your device. We never see it.',
  },
  {
    icon: Eye,
    title: 'No Tracking',
    description: 'We don\'t use analytics, cookies, or any third-party tracking services.',
  },
  {
    icon: Lock,
    title: 'Secure Storage',
    description: 'Credentials are stored in your OS keychain with industry-standard encryption.',
  },
]

const tableOfContents = [
  { id: 'overview', title: 'Overview' },
  { id: 'what-we-collect', title: 'What We Collect' },
  { id: 'what-we-dont-collect', title: 'What We Don\'t Collect' },
  { id: 'data-storage', title: 'Data Storage & Security' },
  { id: 'third-parties', title: 'Third-Party Services' },
  { id: 'your-rights', title: 'Your Rights' },
  { id: 'updates', title: 'Policy Updates' },
  { id: 'contact', title: 'Contact Us' },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4">
              <Shield className="h-3.5 w-3.5 mr-2" />
              Privacy Policy
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Your privacy is our priority
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-4"
          >
            DBView is built with a privacy-first architecture. Your database credentials
            and data never leave your device.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            Last updated: December 24, 2024
          </motion.p>
        </div>
      </section>

      {/* Highlights */}
      <section className="pb-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {highlights.map((item, index) => (
              <div
                key={item.title}
                className="glass-card rounded-xl p-6 text-center"
              >
                <div className="inline-flex p-3 rounded-xl bg-green-100 dark:bg-green-900/30 mb-4">
                  <item.icon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Table of Contents - Sidebar */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="lg:col-span-1"
            >
              <div className="glass-card rounded-xl p-6 sticky top-24">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  On this page
                </h3>
                <nav className="space-y-2">
                  {tableOfContents.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {item.title}
                    </a>
                  ))}
                </nav>
              </div>
            </motion.aside>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="lg:col-span-3 space-y-12"
            >
              {/* Overview */}
              <section id="overview" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Overview
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    At DBView, we believe that privacy is a fundamental right. This Privacy Policy
                    explains our approach to data collection and protection. The short version:
                    we collect almost nothing, and what little we do collect is handled with care.
                  </p>
                  <p>
                    DBView is a product of Safenest Technologies Ltd, a company registered in the
                    United Kingdom. DBView is a desktop application and VS Code extension that runs
                    entirely on your local machine. Unlike cloud-based database tools, your data
                    never passes through our servers because we don&apos;t have servers that handle
                    your data.
                  </p>
                </div>
              </section>

              {/* What We Collect */}
              <section id="what-we-collect" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    What We Collect
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="glass-card rounded-lg p-4 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Contact Information (Optional)
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      When you reach out for support or feedback, we collect your name and email
                      address. This is only used to respond to your inquiry.
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Feedback & Suggestions
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Any feedback, bug reports, or feature suggestions you voluntarily submit
                      to help us improve DBView.
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Download Statistics
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Basic, anonymous download counts from our website and VS Code Marketplace
                      to understand product adoption. No personal information is linked.
                    </p>
                  </div>
                </div>
              </section>

              {/* What We Don't Collect */}
              <section id="what-we-dont-collect" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <XCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    What We Don&apos;t Collect
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  This is the important part. Here&apos;s everything we explicitly do NOT collect:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    'Database credentials or passwords',
                    'Connection strings or host information',
                    'Your database content or schemas',
                    'SQL queries you execute',
                    'Query results or data',
                    'Usage patterns or behavior',
                    'IP addresses or location data',
                    'Device identifiers',
                    'Cookies or tracking pixels',
                    'Any telemetry or analytics',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Data Storage */}
              <section id="data-storage" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Data Storage & Security
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none mb-6">
                  <p>
                    All sensitive data is stored locally on your device using your operating
                    system&apos;s secure credential storage. This means your passwords are
                    protected by the same security that protects your other system credentials.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🍎</div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">macOS</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Keychain Access with secure enclave
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🪟</div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Windows</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Windows Credential Manager
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🐧</div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Linux</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      libsecret / Secret Service API
                    </p>
                  </div>
                </div>
              </section>

              {/* Third Parties */}
              <section id="third-parties" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Server className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Third-Party Services
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    DBView does not integrate with any third-party analytics, advertising, or
                    tracking services. We don&apos;t use Google Analytics, Mixpanel, Segment,
                    or any similar tools.
                  </p>
                  <p>
                    The only third-party services involved are:
                  </p>
                  <ul>
                    <li>
                      <strong>VS Code Marketplace</strong> - For distributing the VS Code extension
                      (governed by Microsoft&apos;s privacy policy)
                    </li>
                    <li>
                      <strong>Our Website Host</strong> - For serving our marketing website
                      (no personal data is collected)
                    </li>
                  </ul>
                </div>
              </section>

              {/* Your Rights */}
              <section id="your-rights" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                    <UserCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Your Rights
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>You have the right to:</p>
                  <ul>
                    <li>Request access to any personal data we may hold about you</li>
                    <li>Request correction of inaccurate personal data</li>
                    <li>Request deletion of your personal data</li>
                    <li>Withdraw consent for any optional data collection</li>
                    <li>Lodge a complaint with a supervisory authority</li>
                  </ul>
                  <p>
                    Since we collect minimal data, exercising these rights is straightforward.
                    Simply contact us and we&apos;ll handle your request promptly.
                  </p>
                </div>
              </section>

              {/* Updates */}
              <section id="updates" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                    <Bell className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Policy Updates
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    We may update this Privacy Policy from time to time. When we make significant
                    changes, we will notify you through our website and/or the application itself.
                  </p>
                  <p>
                    We encourage you to review this policy periodically. Continued use of DBView
                    after any changes constitutes acceptance of the updated policy.
                  </p>
                </div>
              </section>

              {/* Contact */}
              <section id="contact" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Contact Us
                  </h2>
                </div>
                <div className="glass-card rounded-xl p-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    If you have any questions about this Privacy Policy or how we handle your
                    data, we&apos;re here to help.
                  </p>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Safenest Technologies Ltd</strong>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      United Kingdom
                    </p>
                  </div>
                  <Link
                    href="mailto:hello@dbview.app"
                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    hello@dbview.app
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
