'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        setError('Check your email for a confirmation link!')
      } else {
        await signIn(email, password)
        router.push('/app/campaigns')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-brand-900/40 via-surface-700 to-surface-900 border-r border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">Creator AI Hub</span>
        </Link>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Turn your content into a{' '}
            <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              growth engine
            </span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            AI-powered content repurposing, multi-channel scheduling, and analytics — built for creators who ship.
          </p>
        </div>

        <p className="text-sm text-gray-600">Creator AI Hub</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">Creator AI Hub</span>
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-gray-400 mb-8">
            {isSignUp
              ? 'Start creating AI-powered content today.'
              : 'Sign in to continue to your campaigns.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className={`p-4 rounded-xl text-sm ${
                  error.includes('Check your email')
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="input-field"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-400 text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>

          <p className="mt-4 text-center">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Back to Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
