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
  Heart,
  Users,
  Globe,
  Sparkles,
  ArrowRight,
  Github,
  Twitter,
  Linkedin,
} from 'lucide-react'

const values = [
  {
    icon: Heart,
    title: 'Developer First',
    description:
      "We build for developers, by developers. Every feature is designed to make your life easier, not harder.",
  },
  {
    icon: Sparkles,
    title: 'Beautiful & Functional',
    description:
      "Great tools don't have to be ugly. We believe you deserve an interface that's as pleasant to use as it is powerful.",
  },
  {
    icon: Globe,
    title: 'Open & Transparent',
    description:
      "We're open source at heart. Our roadmap, pricing, and decision-making are all transparent.",
  },
  {
    icon: Users,
    title: 'Community Driven',
    description:
      'Our best features come from user feedback. We listen, iterate, and ship based on what you need.',
  },
]

const team = [
  {
    name: 'Alex Chen',
    role: 'Founder & CEO',
    bio: 'Previously Staff Engineer at Stripe. 10+ years building developer tools.',
    avatar: 'AC',
    social: {
      twitter: '#',
      linkedin: '#',
      github: '#',
    },
  },
  {
    name: 'Sarah Miller',
    role: 'Co-Founder & CTO',
    bio: 'Ex-Google, built and scaled database infrastructure serving millions.',
    avatar: 'SM',
    social: {
      twitter: '#',
      linkedin: '#',
      github: '#',
    },
  },
  {
    name: 'Marcus Johnson',
    role: 'Head of Product',
    bio: 'Product leader with a passion for developer experience and UX.',
    avatar: 'MJ',
    social: {
      twitter: '#',
      linkedin: '#',
      github: '#',
    },
  },
  {
    name: 'Elena Rodriguez',
    role: 'Lead Engineer',
    bio: 'Open source contributor and TypeScript enthusiast.',
    avatar: 'ER',
    social: {
      twitter: '#',
      linkedin: '#',
      github: '#',
    },
  },
]

const timeline = [
  {
    year: '2023',
    title: 'The Beginning',
    description:
      'Started as a side project to scratch our own itch - a better database client for VS Code.',
  },
  {
    year: '2024 Q1',
    title: 'First Public Release',
    description:
      'Launched v0.1 with PostgreSQL support. Overwhelmed by the positive response.',
  },
  {
    year: '2024 Q2',
    title: 'Multi-Database Support',
    description:
      'Added MySQL, SQLite, MongoDB, and Redis. User base grew 10x.',
  },
  {
    year: '2024 Q3',
    title: 'Desktop App Launch',
    description:
      'Released standalone desktop apps for macOS, Windows, and Linux.',
  },
  {
    year: '2025',
    title: 'The Future',
    description:
      'Team collaboration features, cloud sync, and much more on the roadmap.',
  },
]

export default function AboutPage() {
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
              About Us
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            We&apos;re on a mission to make
            <br />
            <span className="text-gradient">databases delightful</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
          >
            DBView was born from frustration with existing database tools. We
            believe developers deserve a database client that&apos;s fast, beautiful,
            and just works.
          </motion.p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="prose prose-lg dark:prose-invert mx-auto"
          >
            <h2 className="text-3xl font-bold text-center mb-8">Our Story</h2>
            <p>
              Like many developer tools, DBView started as a side project. We were
              tired of switching between multiple database clients, dealing with
              clunky interfaces, and waiting for slow queries to complete.
            </p>
            <p>
              We asked ourselves: &ldquo;Why can&apos;t a database client be as
              enjoyable to use as the rest of our development stack?&rdquo; So we
              built one.
            </p>
            <p>
              Today, DBView is used by thousands of developers around the world.
              From startups to Fortune 500 companies, teams rely on DBView to
              explore, query, and manage their databases with ease.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Our Values
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="glass-card rounded-2xl p-8"
              >
                <value.icon className="h-10 w-10 text-indigo-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Our Journey
            </h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 to-purple-500" />

            {/* Timeline items */}
            <div className="space-y-8">
              {timeline.map((item, index) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className="relative pl-20"
                >
                  {/* Dot */}
                  <div className="absolute left-6 w-4 h-4 bg-indigo-500 rounded-full border-4 border-white dark:border-gray-900" />

                  {/* Content */}
                  <div className="glass-card rounded-xl p-6">
                    <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                      {item.year}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Meet the Team
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              A small but mighty team passionate about developer tools
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="glass-card rounded-2xl p-6 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  {member.avatar}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {member.name}
                </h3>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-3">
                  {member.role}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {member.bio}
                </p>
                <div className="flex justify-center gap-3">
                  <Link
                    href={member.social.twitter}
                    className="text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Twitter className="h-4 w-4" />
                  </Link>
                  <Link
                    href={member.social.linkedin}
                    className="text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Linkedin className="h-4 w-4" />
                  </Link>
                  <Link
                    href={member.social.github}
                    className="text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    <Github className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Join Us CTA */}
      <section className="py-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Want to join us?
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            We&apos;re always looking for talented people who share our passion for
            building great developer tools.
          </p>
          <Button
            size="xl"
            className="bg-white text-indigo-600 hover:bg-gray-100"
            asChild
          >
            <Link href="/careers">
              View Open Positions
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  )
}
