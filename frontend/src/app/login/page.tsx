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
    <div>
      <h1>{isSignUp ? 'Sign Up' : 'Login'}</h1>
      <p style={{ marginTop: '1rem', marginBottom: '1rem', color: '#666' }}>
        {isSignUp 
          ? 'Create an account to get started.' 
          : 'Sign in to your account.'}
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: error.includes('Check your email') ? '#e6f7e6' : '#ffebee', borderRadius: '4px', color: error.includes('Check your email') ? '#28a745' : '#c62828' }}>
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        
        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>
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
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{ 
            padding: '0.75rem', 
            cursor: loading ? 'not-allowed' : 'pointer', 
            backgroundColor: loading ? '#ccc' : '#0070f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px' 
          }}
        >
          {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Login')}
        </button>
      </form>
      
      <p style={{ marginTop: '1rem' }}>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError('')
          }}
          style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isSignUp ? 'Login' : 'Sign Up'}
        </button>
      </p>
      
      <p style={{ marginTop: '1rem' }}>
        <Link href="/">← Back to Home</Link>
      </p>
    </div>
  )
}
