'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { DEMO_MODE_EVENT, DEMO_MODE_STORAGE_KEY } from '@/lib/api'

const NAV_ITEMS = [
  {
    label: 'Campaigns',
    href: '/app/campaigns',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
  {
    label: 'Schedule',
    href: '/app/schedule',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: 'Dashboard',
    href: '/app/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [demoModeActive, setDemoModeActive] = useState(false)
  const [demoModeDismissed, setDemoModeDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      setDemoModeActive(window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true')
      setDemoModeDismissed(window.localStorage.getItem('creatorAiDemoModeDismissed') === 'true')
    } catch (error) {
      console.warn('[Demo Mode] Unable to read persisted demo state.', error)
    }

    const handleDemoMode = () => {
      setDemoModeActive(true)
    }

    window.addEventListener(DEMO_MODE_EVENT, handleDemoMode as EventListener)
    return () => window.removeEventListener(DEMO_MODE_EVENT, handleDemoMode as EventListener)
  }, [])

  const dismissDemoMode = () => {
    setDemoModeDismissed(true)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('creatorAiDemoModeDismissed', 'true')
      } catch (error) {
        console.warn('[Demo Mode] Unable to persist dismissed state.', error)
      }
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-white/[0.06] bg-surface-800/50 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">
              Creator AI
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 shadow-glow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Section */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user?.email || 'User'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full mt-2 btn-ghost text-sm text-gray-500 hover:text-red-400"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {demoModeActive && !demoModeDismissed && (
          <div className="sticky top-0 z-30 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 backdrop-blur">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 text-sm text-amber-100 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-200">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 6h.008v.008H12V18z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-200">Demo mode active</p>
                  <p className="text-xs text-amber-100/80">
                    We could not reach the backend, so you are viewing placeholder data. Set
                    <span className="mx-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[0.65rem] text-amber-100">NEXT_PUBLIC_BACKEND_URL</span>
                    to connect your API.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissDemoMode}
                className="self-start rounded-full border border-amber-200/40 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:border-amber-200/70 hover:text-amber-50 md:self-auto"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
