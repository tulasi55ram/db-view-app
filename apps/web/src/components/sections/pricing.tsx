'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Gift, Rocket, Heart, Mail } from 'lucide-react'

const features = [
  'Unlimited database connections',
  'PostgreSQL, MySQL, SQLite support',
  'MongoDB & Redis support',
  'Schema browser & explorer',
  'SQL editor with autocomplete',
  'Visual ER diagrams',
  'Advanced data filtering',
  'Inline data editing',
  'Query history & favorites',
  'CSV, JSON, SQL export',
  'Saved views & presets',
  'EXPLAIN query plans',
]

const futureFeatures = [
  'Team collaboration',
  'Cloud sync',
  'Custom themes',
  'Plugin system',
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-gray-50 dark:bg-gray-900/50">
        <div className="absolute inset-0 bg-grid dark:bg-grid-dark opacity-50" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="gradient" className="mb-4">
              <Gift className="h-3.5 w-3.5 mr-2" />
              Free During Beta
            </Badge>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            Completely
            <span className="text-gradient"> free</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300"
          >
            All features unlocked during beta. No credit card required.
            <br />
            Help us build the best database client ever.
          </motion.p>
        </div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative rounded-3xl overflow-hidden">
            {/* Gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[2px] rounded-3xl">
              <div className="absolute inset-[2px] bg-white dark:bg-gray-900 rounded-3xl" />
            </div>

            <div className="relative p-8 sm:p-12">
              {/* Price */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-4 mb-4">
                  <span className="text-6xl sm:text-7xl font-bold text-gradient">
                    $0
                  </span>
                  <div className="text-left">
                    <p className="text-gray-500 dark:text-gray-400 line-through">
                      $12/year
                    </p>
                    <Badge className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      100% OFF
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Free forever for beta users
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button size="xl" variant="gradient" className="mb-4" asChild>
                  <Link href="/download">
                    <Rocket className="h-5 w-5 mr-2" />
                    Download Beta for Free
                  </Link>
                </Button>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No signup required. Download and start using immediately.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Coming soon in future updates:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {futureFeatures.map((feature) => (
              <span
                key={feature}
                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
              >
                {feature}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Support Us */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <div className="glass-card rounded-2xl p-8 text-center">
            <Heart className="h-10 w-10 text-pink-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Love DBView?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Help us grow by sharing with your developer friends or providing
              feedback. Your support means everything!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="outline" asChild>
                <Link href="mailto:hello@dbview.app">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Us
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/contact">Send Feedback</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
