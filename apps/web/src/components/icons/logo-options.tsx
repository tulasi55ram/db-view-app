'use client'

import React from 'react'

// Option 1: Database with Eye (View concept)
export function LogoOption1({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 6v4c0 1.657 3.582 3 8 3s8-1.343 8-3V6" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 10v4c0 1.657 3.582 3 8 3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="17" cy="17" r="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="17" cy="17" r="1.5" fill="currentColor"/>
    </svg>
  )
}

// ============================================
// NEW REFINED OPTIONS (UI/UX Research Based)
// ============================================

// Option 9: RECOMMENDED - Rounded square with lens/view into data rows
// Concept: A window/lens looking into organized data - clean, modern, memorable
export function LogoOption9({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2"/>
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2"/>
      <line x1="9" y1="9" x2="9" y2="21" stroke="currentColor" strokeWidth="2"/>
      <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
    </svg>
  )
}

// Option 10: Abstract V with data nodes - modern, represents View + connections
export function LogoOption10({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L12 20L20 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="4" cy="4" r="2.5" fill="currentColor"/>
      <circle cx="20" cy="4" r="2.5" fill="currentColor"/>
      <circle cx="12" cy="20" r="2.5" fill="currentColor"/>
      <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
    </svg>
  )
}

// Option 11: Stacked cards/layers - represents multiple views/tables
export function LogoOption11({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="2" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 6H4C2.89543 6 2 6.89543 2 8V18C2 19.1046 2.89543 20 4 20H14C15.1046 20 16 19.1046 16 18V16" stroke="currentColor" strokeWidth="2"/>
      <line x1="9" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="2"/>
      <line x1="5" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// Option 12: Circle lens with table grid inside - clean, focused
export function LogoOption12({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="9" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

// Option 13: Minimal brackets with dot - developer-focused, code-like
export function LogoOption13({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 4L4 8V16L8 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 4L20 8V16L16 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    </svg>
  )
}

// Option 14: Cube/3D database - modern, dimensional
export function LogoOption14({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M12 12L3 7" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 12L21 7" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 12V22" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// Option 15: Rounded window with play/view button - action-oriented
export function LogoOption15({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 9H22" stroke="currentColor" strokeWidth="2"/>
      <circle cx="5" cy="6.5" r="1" fill="currentColor"/>
      <circle cx="8" cy="6.5" r="1" fill="currentColor"/>
      <path d="M10 13L16 16.5L10 20V13Z" fill="currentColor"/>
    </svg>
  )
}

// Option 16: STRONG RECOMMENDATION - Simple abstract "db" letterform
export function LogoOption16({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M4 7C4 7 4 5 7 5C10 5 10 9 7 9C4 9 4 7 4 7Z" fill="currentColor"/>
      <path d="M4 15C4 15 4 13 7 13C10 13 10 17 7 17C4 17 4 15 4 15Z" fill="currentColor"/>
      <circle cx="17" cy="8" r="5" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M14 16L20 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

// Option 17: Clean table icon with highlight row
export function LogoOption17({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="9" width="18" height="6" fill="currentColor" fillOpacity="0.3"/>
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2"/>
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="2"/>
      <line x1="10" y1="3" x2="10" y2="21" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// Option 18: Eye looking at rows - direct "view" metaphor
export function LogoOption18({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12C2 12 5 6 12 6C19 6 22 12 22 12C22 12 19 18 12 18C5 18 2 12 2 12Z" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      <line x1="9" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="17" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
    </svg>
  )
}

// ============================================
// REFINED OPTIONS V2 - Based on competitor research
// ============================================

// Option 19: HIGHLY RECOMMENDED - Unique "D" with data flow
// Inspired by: distinctive lettermark like Notion, Linear
export function LogoOption19({
  className = "h-6 w-6",
  title = "DBView Logo",
  'aria-hidden': ariaHidden,
}: {
  className?: string
  title?: string
  'aria-hidden'?: boolean
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      aria-hidden={ariaHidden}
    >
      <title>{title}</title>
      <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <line x1="10" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="15" x2="14" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 20: Abstract "view finder" / camera viewfinder with data
// Unique concept: looking through a lens at data
export function LogoOption20({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L8 8M20 4L16 8M4 20L8 16M20 20L16 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
      <line x1="9" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="14" x2="13" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Option 21: Stacked coins/discs with magnifier - premium feel
export function LogoOption21({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="10" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 6v3c0 1.657 3.134 3 7 3s7-1.343 7-3V6" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 9v3c0 1.657 3.134 3 7 3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="17" cy="17" r="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

// Option 22: Bold rounded square with "V" cutout - distinctive silhouette
export function LogoOption22({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M8 8L12 16L16 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Option 23: Pill/capsule with rows - modern SaaS aesthetic
export function LogoOption23({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="3" width="16" height="18" rx="8" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 24: Hexagon with table - tech/modern
export function LogoOption24({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="7" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="7" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

// Option 25: Rounded tab/window - like browser tab with data
export function LogoOption25({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 8C3 5.79086 4.79086 4 7 4H17C19.2091 4 21 5.79086 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V8Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
      <circle cx="6" cy="6.5" r="1" fill="currentColor"/>
      <line x1="7" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="7" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Option 26: RECOMMENDED - Split circle with data bars - unique, balanced
export function LogoOption26({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 3V21" stroke="currentColor" strokeWidth="2"/>
      <line x1="15" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="15" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="15" y1="16" x2="17" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 27: Shield with data - security/trust focused
export function LogoOption27({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L4 7V12C4 16.4183 7.58172 21 12 21C16.4183 21 20 16.4183 20 12V7L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Option 28: HIGHLY RECOMMENDED - Squircle with corner accent + rows
// Modern iOS-style, distinctive corner treatment
export function LogoOption28({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="7" cy="7" r="2" fill="currentColor"/>
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="7" y1="16" x2="15" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 2: Stacked layers with magnifier (Explore concept)
export function LogoOption2({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="9" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="14" width="8" height="3" rx="1" stroke="currentColor" strokeWidth="2"/>
      <circle cx="17" cy="17" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 20L22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 3: DB Monogram stylized
export function LogoOption3({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 5C4 4.44772 4.44772 4 5 4H9C11.7614 4 14 6.23858 14 9C14 11.7614 11.7614 14 9 14H5C4.44772 14 4 13.5523 4 13V5Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 9H9" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 11C14 10.4477 14.4477 10 15 10H17C19.2091 10 21 11.7909 21 14V16C21 18.2091 19.2091 20 17 20H15C14.4477 20 14 19.5523 14 19V11Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 15H17" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// Option 4: Window/Frame with data rows
export function LogoOption4({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
      <path d="M9 9V21" stroke="currentColor" strokeWidth="2"/>
      <circle cx="6" cy="6" r="1" fill="currentColor"/>
      <path d="M12 13H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 17H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 5: Abstract hexagon data node
export function LogoOption5({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M12 8L17 11V15L12 18L7 15V11L12 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="12" cy="13" r="2" fill="currentColor"/>
    </svg>
  )
}

// Option 6: Cylinder with cursor/pointer
export function LogoOption6({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="10" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 5v6c0 1.657 3.134 3 7 3s7-1.343 7-3V5" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 11v6c0 1.657 3.134 3 7 3" stroke="currentColor" strokeWidth="2"/>
      <path d="M15 14l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Option 7: Grid/Table focused
export function LogoOption7({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 8H21" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 8V21" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 8V21" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 14H21" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// Option 8: Database with checkmark (verified/connected)
export function LogoOption8({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="10" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 6v4c0 1.657 3.134 3 7 3s7-1.343 7-3V6" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 10v4c0 1.657 3.134 3 7 3" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 17l2 2 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Preview component showing all options
export function LogoOptionsPreview() {
  const options = [
    { name: 'Option 1: DB + Eye', component: LogoOption1, description: 'Database with eye - emphasizes viewing' },
    { name: 'Option 2: Layers + Search', component: LogoOption2, description: 'Data layers with magnifier - exploration' },
    { name: 'Option 3: DB Monogram', component: LogoOption3, description: 'Stylized DB letters' },
    { name: 'Option 4: Data Window', component: LogoOption4, description: 'Table view in window frame' },
    { name: 'Option 5: Hex Node', component: LogoOption5, description: 'Abstract hexagonal data node' },
    { name: 'Option 6: DB + Cursor', component: LogoOption6, description: 'Database with interactive cursor' },
    { name: 'Option 7: Grid Table', component: LogoOption7, description: 'Clean table grid layout' },
    { name: 'Option 8: DB + Check', component: LogoOption8, description: 'Database with verification mark' },
  ]

  return (
    <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
      {options.map(({ name, component: Icon, description }) => (
        <div key={name} className="flex flex-col items-center gap-4 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          {/* Light background preview */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3 rounded-lg">
            <Icon className="h-8 w-8 text-white" />
          </div>
          {/* Dark preview */}
          <div className="bg-gray-900 p-3 rounded-lg">
            <Icon className="h-8 w-8 text-white" />
          </div>
          {/* Outline preview */}
          <Icon className="h-8 w-8 text-indigo-600" />
          <div className="text-center">
            <p className="font-medium text-sm">{name}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
