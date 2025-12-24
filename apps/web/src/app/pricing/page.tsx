'use client'

import React from 'react'
import { Header } from '@/components/sections/header'
import { Footer } from '@/components/sections/footer'
import { Pricing } from '@/components/sections/pricing'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Gift } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'Is DBView really free during beta?',
    answer:
      'Yes! During the beta period, all features are completely free with no limitations. We want as many developers as possible to try DBView and help us make it the best database client out there.',
  },
  {
    question: 'Will I have to pay after beta ends?',
    answer:
      'We plan to introduce paid tiers in the future, but beta users will always have special perks. We\'ll give plenty of notice before any changes, and early adopters will be rewarded for their support.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No account required! Simply download DBView and start using it immediately. Your connections and settings are stored locally on your device.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. DBView stores all credentials in your system\'s secure keychain (Keychain on macOS, Credential Manager on Windows). Your database credentials never leave your machine.',
  },
  {
    question: 'What databases are supported?',
    answer:
      'We currently support PostgreSQL, MySQL, SQLite, MongoDB, Redis, and SQL Server. More database types are on our roadmap based on user feedback.',
  },
  {
    question: 'Can I use DBView for commercial projects?',
    answer:
      'Yes! You can use DBView for any purpose—personal, commercial, or enterprise. There are no restrictions during the beta period.',
  },
  {
    question: 'How can I provide feedback?',
    answer:
      'We love hearing from users! You can submit feedback through our contact form or email us at hello@dbview.app. Your input directly shapes our roadmap.',
  },
  {
    question: 'Is there a VS Code extension?',
    answer:
      'Yes! DBView is available as both a standalone desktop app (macOS, Windows, Linux) and a VS Code extension. Both versions have the same features.',
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-8 relative overflow-hidden">
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
              <Gift className="h-3.5 w-3.5 mr-2" />
              Free Beta
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Free during beta
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
          >
            Get full access to all features at no cost. No credit card, no signup.
          </motion.p>
        </div>
      </section>

      {/* Pricing Section */}
      <Pricing />

      {/* FAQ Section */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Everything you need to know about the DBView beta
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass-card rounded-xl px-6"
              >
                <AccordionTrigger className="text-left font-medium text-gray-900 dark:text-white hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-300 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <Footer />
    </main>
  )
}
