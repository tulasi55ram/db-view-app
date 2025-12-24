'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Zap,
  Shield,
  Heart,
  ArrowRight,
  Sparkles,
  Code2,
  Bug,
} from 'lucide-react'

const benefits = [
  {
    icon: Zap,
    title: 'Early Access',
    description: 'Be the first to try new features before public release',
  },
  {
    icon: Shield,
    title: 'Free Forever',
    description: 'Beta users get lifetime access to core features',
  },
  {
    icon: Heart,
    title: 'Shape the Product',
    description: 'Your feedback directly influences our roadmap',
  },
  {
    icon: Users,
    title: 'Community Access',
    description: 'Get direct support from our team via email',
  },
]

const communityLinks = [
  {
    icon: Bug,
    name: 'Feedback',
    description: 'Share ideas & report bugs',
    href: '/contact',
    color: 'from-orange-500 to-red-500',
  },
]

export function Testimonials() {
  return (
    <section id="community" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-indigo-500/10 via-transparent to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="gradient" className="mb-4">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Join the Beta
            </Badge>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            Be part of
            <span className="text-gradient"> something new</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300"
          >
            Join our growing community of developers helping to build the next
            generation database client.
          </motion.p>
        </div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
              className="text-center p-6"
            >
              <div className="inline-flex p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                <benefit.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {benefit.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Community Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex justify-center mb-12"
        >
          {communityLinks.map((link, index) => (
            <motion.div
              key={link.name}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Link
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="block glass-card rounded-2xl p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${link.color}`}
                  >
                    <link.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {link.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/30">
            <div className="flex -space-x-2">
              {['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'].map(
                (color, i) => (
                  <div
                    key={i}
                    className={`w-10 h-10 rounded-full ${color} border-2 border-white dark:border-gray-900 flex items-center justify-center`}
                  >
                    <Code2 className="h-4 w-4 text-white" />
                  </div>
                )
              )}
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                +99
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="font-medium text-gray-900 dark:text-white">
                Join 100+ developers in the beta
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Download now and start exploring your databases
              </p>
            </div>
            <Button variant="gradient" asChild>
              <Link href="/download">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
