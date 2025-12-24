'use client'

import React from 'react'
import {
  LogoOption1,
  LogoOption2,
  LogoOption3,
  LogoOption4,
  LogoOption5,
  LogoOption6,
  LogoOption7,
  LogoOption8,
  LogoOption9,
  LogoOption10,
  LogoOption11,
  LogoOption12,
  LogoOption13,
  LogoOption14,
  LogoOption15,
  LogoOption16,
  LogoOption17,
  LogoOption18,
  LogoOption19,
  LogoOption20,
  LogoOption21,
  LogoOption22,
  LogoOption23,
  LogoOption24,
  LogoOption25,
  LogoOption26,
  LogoOption27,
  LogoOption28,
} from '@/components/icons/logo-options'

// V2 REFINED - Based on competitor research (Beekeeper, TablePlus, Database Client)
const topPicksV2 = [
  { id: 19, name: 'D Lettermark', component: LogoOption19, description: 'Unique "D" with data rows - like Notion/Linear style', recommended: true },
  { id: 28, name: 'Squircle App', component: LogoOption28, description: 'iOS-style squircle with accent dot + rows', recommended: true },
  { id: 20, name: 'Viewfinder', component: LogoOption20, description: 'Camera viewfinder focusing on data - unique concept', recommended: true },
  { id: 22, name: 'V Badge', component: LogoOption22, description: 'Bold square with V for View - distinctive silhouette', recommended: false },
  { id: 23, name: 'Pill Data', component: LogoOption23, description: 'Modern pill/capsule shape with rows', recommended: false },
  { id: 26, name: 'Split Circle', component: LogoOption26, description: 'Circle with vertical split + data bars', recommended: false },
  { id: 27, name: 'Data Shield', component: LogoOption27, description: 'Shield shape - emphasizes security/trust', recommended: false },
  { id: 25, name: 'Tab Window', component: LogoOption25, description: 'Browser-like tab with data rows', recommended: false },
  { id: 21, name: 'DB + Lens', component: LogoOption21, description: 'Database discs with magnifying lens', recommended: false },
  { id: 24, name: 'Hex Table', component: LogoOption24, description: 'Hexagon with table grid - tech aesthetic', recommended: false },
]

// V1 Options - Previous batch
const v1Options = [
  { id: 9, name: 'App Window', component: LogoOption9, description: 'Clean app window with data table' },
  { id: 17, name: 'Table Select', component: LogoOption17, description: 'Table with highlighted row' },
  { id: 12, name: 'Data Lens', component: LogoOption12, description: 'Circle lens viewing into data grid' },
  { id: 13, name: 'Code Brackets', component: LogoOption13, description: 'Developer-focused brackets' },
  { id: 14, name: '3D Cube', component: LogoOption14, description: 'Dimensional data cube' },
]

// Original options for comparison
const originalOptions = [
  { id: 1, name: 'DB + Eye', component: LogoOption1, description: 'Database cylinder with eye' },
  { id: 2, name: 'Layers + Search', component: LogoOption2, description: 'Data layers with magnifying glass' },
  { id: 3, name: 'DB Monogram', component: LogoOption3, description: 'Stylized interlocking D and B letters' },
  { id: 4, name: 'Data Window', component: LogoOption4, description: 'Application window with table rows' },
  { id: 5, name: 'Hex Node', component: LogoOption5, description: 'Abstract hexagonal data node' },
  { id: 6, name: 'DB + Cursor', component: LogoOption6, description: 'Database with X cursor' },
  { id: 7, name: 'Grid Table', component: LogoOption7, description: 'Clean spreadsheet grid' },
  { id: 8, name: 'DB + Check', component: LogoOption8, description: 'Database with checkmark' },
]

export default function LogoPreviewPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            DBView Logo Options
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Based on UI/UX research: A good database tool logo should be simple, memorable,
            work at small sizes, and convey data/structure without being generic.
          </p>
        </div>

        {/* V2 TOP PICKS - Research Based */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              New Top Picks (V2)
            </h2>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-full">
              Competitor Research
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {topPicksV2.map(({ id, name, component: Icon, description, recommended }) => (
              <div
                key={id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border-2 transition-shadow hover:shadow-lg ${
                  recommended
                    ? 'border-purple-500 dark:border-purple-400'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-medium rounded">
                    #{id}
                  </span>
                  {recommended && (
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-medium rounded">
                      TOP
                    </span>
                  )}
                </div>

                {/* Main preview */}
                <div className="flex justify-center mb-4">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 rounded-xl shadow-lg">
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                </div>

                {/* Size variations */}
                <div className="flex justify-center items-end gap-2 mb-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  <Icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>

                {/* Header simulation */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-1 rounded">
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="font-bold text-xs text-gray-900 dark:text-white">DBView</span>
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{name}</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HEADER COMPARISON - V2 Top 3 */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Header Preview (Top 3 Picks)
          </h2>
          <div className="space-y-3">
            {topPicksV2.filter(o => o.recommended).map(({ id, name, component: Icon }) => (
              <div
                key={id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2 border-purple-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-2 rounded-lg">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">DBView</span>
                    <span className="text-xs text-gray-400">#{id} {name}</span>
                  </div>
                  <div className="hidden sm:flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                    <span>Features</span>
                    <span>Pricing</span>
                    <span>About</span>
                    <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium">Download</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* V1 OPTIONS */}
        <div className="mb-16">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Previous Options (V1)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {v1Options.map(({ id, name, component: Icon }) => (
              <div
                key={id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-center mb-3">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3 rounded-xl">
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">#{id} {name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ORIGINAL OPTIONS */}
        <div className="mb-16">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Original Options
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {originalOptions.map(({ id, component: Icon }) => (
              <div
                key={id}
                className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-center mb-2">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-2 rounded-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <p className="text-[10px] text-center text-gray-500">#{id}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RECOMMENDATION NOTE */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
          <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-3">Final Recommendation</h3>
          <p className="text-sm text-purple-800 dark:text-purple-200 mb-4">
            Based on competitor analysis (Beekeeper Studio, TablePlus, Database Client) and 2024 design trends:
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
              <p className="font-bold text-sm text-gray-900 dark:text-white">#19 D Lettermark</p>
              <p className="text-xs text-gray-500">Like Notion/Linear - memorable, unique</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
              <p className="font-bold text-sm text-gray-900 dark:text-white">#28 Squircle App</p>
              <p className="text-xs text-gray-500">Modern iOS aesthetic - clean, scalable</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
              <p className="font-bold text-sm text-gray-900 dark:text-white">#20 Viewfinder</p>
              <p className="text-xs text-gray-500">Unique "view" concept - distinctive</p>
            </div>
          </div>
          <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
            <li>• These avoid generic database cylinder that competitors use</li>
            <li>• Work at all sizes (16px favicon to 64px marketing)</li>
            <li>• Distinctive silhouettes that stand out in browser tabs</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
