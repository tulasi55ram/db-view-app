'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Header } from '@/components/sections/header'
import { Footer } from '@/components/sections/footer'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Scale,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Gavel,
  Mail,
  ArrowRight,
  Zap,
  Lock,
  UserCheck,
} from 'lucide-react'

const highlights = [
  {
    icon: Zap,
    title: 'Free During Beta',
    description: 'All features are free during the beta period with no limitations.',
  },
  {
    icon: Lock,
    title: 'Local Processing',
    description: 'All data processing happens on your device. We never access your databases.',
  },
  {
    icon: UserCheck,
    title: 'No Account Required',
    description: 'Download and use immediately. No signup or credit card needed.',
  },
]

const tableOfContents = [
  { id: 'agreement', title: 'Agreement to Terms' },
  { id: 'beta', title: 'Beta Software' },
  { id: 'license', title: 'License Grant' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'your-responsibilities', title: 'Your Responsibilities' },
  { id: 'intellectual-property', title: 'Intellectual Property' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of Liability' },
  { id: 'termination', title: 'Termination' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'changes', title: 'Changes to Terms' },
  { id: 'contact', title: 'Contact Us' },
]

export default function TermsPage() {
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
              <FileText className="h-3.5 w-3.5 mr-2" />
              Terms of Service
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Terms of Service
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-4"
          >
            Please read these terms carefully before using DBView. By using our software,
            you agree to be bound by these terms.
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
            {highlights.map((item) => (
              <div
                key={item.title}
                className="glass-card rounded-xl p-6 text-center"
              >
                <div className="inline-flex p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                  <item.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
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
              {/* Agreement */}
              <section id="agreement" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Agreement to Terms
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    By downloading, installing, or using DBView (&quot;the Software&quot;), you agree to
                    be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these
                    Terms, please do not download or use the Software.
                  </p>
                  <p>
                    These Terms constitute a legally binding agreement between you and Safenest
                    Technologies Ltd (&quot;Company&quot;), a company registered in the United Kingdom,
                    regarding your use of the Software. We may update these Terms from time to
                    time, and your continued use of the Software constitutes acceptance of any
                    changes.
                  </p>
                </div>
              </section>

              {/* Beta */}
              <section id="beta" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Beta Software
                  </h2>
                </div>
                <div className="glass-card rounded-lg p-4 border-l-4 border-amber-500 mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-white">Important:</strong> DBView
                    is currently in beta. This means the Software is still under active development
                    and may contain bugs, errors, or incomplete features.
                  </p>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    During the beta period:
                  </p>
                  <ul>
                    <li>All features are available free of charge</li>
                    <li>We actively collect feedback to improve the product</li>
                    <li>Features may change, be added, or removed without notice</li>
                    <li>We provide support on a best-effort basis</li>
                    <li>Data formats and configurations may change between versions</li>
                  </ul>
                  <p>
                    We appreciate your patience and feedback as we work to make DBView the best
                    database client available.
                  </p>
                </div>
              </section>

              {/* License */}
              <section id="license" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    License Grant
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    Subject to your compliance with these Terms, we grant you a limited,
                    non-exclusive, non-transferable, revocable license to download, install,
                    and use DBView for your personal and commercial purposes.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="glass-card rounded-lg p-4">
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      You May
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        Use for personal projects
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        Use for commercial work
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        Install on multiple devices you own
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        Use within your organization
                      </li>
                    </ul>
                  </div>
                  <div className="glass-card rounded-lg p-4">
                    <h4 className="font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      You May Not
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        Modify or reverse engineer
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        Redistribute or resell
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        Remove proprietary notices
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        Use for illegal purposes
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Acceptable Use */}
              <section id="acceptable-use" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Acceptable Use
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    You agree to use DBView only for lawful purposes and in accordance with
                    these Terms. You agree not to:
                  </p>
                  <ul>
                    <li>
                      Use the Software to access databases without proper authorization
                    </li>
                    <li>
                      Attempt to circumvent any security measures or access controls
                    </li>
                    <li>
                      Use the Software in any way that could damage, disable, or impair
                      any database or system
                    </li>
                    <li>
                      Use the Software to violate any applicable laws or regulations
                    </li>
                    <li>
                      Use the Software to infringe on the rights of others
                    </li>
                  </ul>
                </div>
              </section>

              {/* Your Responsibilities */}
              <section id="your-responsibilities" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <UserCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Your Responsibilities
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="glass-card rounded-lg p-4 border-l-4 border-purple-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Database Authorization
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You are responsible for ensuring you have proper authorization to access
                      and modify any databases you connect to using DBView.
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 border-l-4 border-purple-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Credential Security
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You are responsible for maintaining the security of your database credentials
                      and your device. Do not share your credentials or leave your device unattended.
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 border-l-4 border-purple-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Data Backup
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You are responsible for backing up your data before making any modifications.
                      We are not liable for any data loss resulting from your use of the Software.
                    </p>
                  </div>
                  <div className="glass-card rounded-lg p-4 border-l-4 border-purple-500">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Compliance
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You are responsible for ensuring your use of DBView complies with all applicable
                      laws, regulations, and industry standards (such as GDPR, HIPAA, etc.).
                    </p>
                  </div>
                </div>
              </section>

              {/* Intellectual Property */}
              <section id="intellectual-property" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                    <Shield className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Intellectual Property
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    DBView and all related trademarks, logos, and content are the exclusive
                    property of DBView and its licensors. The Software is protected by copyright,
                    trademark, and other intellectual property laws.
                  </p>
                  <p>
                    Your use of DBView does not grant you any ownership rights in the Software.
                    All rights not expressly granted in these Terms are reserved.
                  </p>
                </div>
              </section>

              {/* Disclaimers */}
              <section id="disclaimers" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Disclaimers
                  </h2>
                </div>
                <div className="glass-card rounded-lg p-4 border-l-4 border-red-500 mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 uppercase font-medium">
                    THE SOFTWARE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                    WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
                    IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
                    AND NON-INFRINGEMENT.
                  </p>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>We do not warrant that:</p>
                  <ul>
                    <li>The Software will meet your specific requirements</li>
                    <li>The Software will be uninterrupted, timely, secure, or error-free</li>
                    <li>Results obtained from using the Software will be accurate or reliable</li>
                    <li>Any errors in the Software will be corrected</li>
                  </ul>
                  <p>
                    You acknowledge that you use the Software at your own risk.
                  </p>
                </div>
              </section>

              {/* Limitation of Liability */}
              <section id="liability" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Gavel className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Limitation of Liability
                  </h2>
                </div>
                <div className="glass-card rounded-lg p-4 border-l-4 border-orange-500 mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 uppercase font-medium">
                    IN NO EVENT SHALL DBVIEW, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE
                    FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
                    WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                  </p>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    Our total liability to you for any claims arising from your use of the Software
                    shall not exceed the amount you paid for the Software (if any) during the twelve
                    months prior to the claim.
                  </p>
                  <p>
                    Some jurisdictions do not allow the exclusion or limitation of certain warranties
                    or liabilities, so some of the above limitations may not apply to you.
                  </p>
                </div>
              </section>

              {/* Termination */}
              <section id="termination" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Termination
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    We may terminate or suspend your right to use the Software at any time, for
                    any reason, without notice. Upon termination:
                  </p>
                  <ul>
                    <li>Your license to use the Software is immediately revoked</li>
                    <li>You must cease all use of the Software</li>
                    <li>You must delete all copies of the Software from your devices</li>
                    <li>Any data stored locally by the Software remains on your device</li>
                  </ul>
                  <p>
                    The following sections survive termination: Intellectual Property, Disclaimers,
                    Limitation of Liability, and any other provisions that by their nature should survive.
                  </p>
                </div>
              </section>

              {/* Governing Law */}
              <section id="governing-law" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Governing Law
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    These Terms shall be governed by and construed in accordance with the laws
                    of England and Wales, without regard to its conflict of law provisions.
                  </p>
                  <p>
                    Any disputes arising out of or in connection with these Terms shall be
                    subject to the exclusive jurisdiction of the courts of England and Wales.
                  </p>
                  <p>
                    If you are a consumer based in the European Union, you may also be entitled
                    to bring proceedings in your local courts.
                  </p>
                </div>
              </section>

              {/* Changes */}
              <section id="changes" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                    <RefreshCw className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Changes to Terms
                  </h2>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p>
                    We reserve the right to modify these Terms at any time. When we make changes,
                    we will update the &quot;Last updated&quot; date at the top of this page and,
                    for significant changes, we may provide additional notice.
                  </p>
                  <p>
                    Your continued use of the Software after any changes indicates your acceptance
                    of the modified Terms. If you do not agree to the modified Terms, you should
                    stop using the Software.
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
                    If you have any questions about these Terms of Service, please contact us.
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

              {/* Related Links */}
              <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Related Documents
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/privacy"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    Privacy Policy
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
