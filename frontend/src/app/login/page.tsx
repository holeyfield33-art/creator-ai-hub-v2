import Link from 'next/link'

export default function LoginPage() {
  return (
    <div>
      <h1>Login</h1>
      <p style={{ marginTop: '1rem', marginBottom: '1rem', color: '#666' }}>
        Authentication will be implemented in a future phase.
      </p>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Email
          </label>
          <input
            type="email"
            id="email"
            placeholder="you@example.com"
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
            placeholder="••••••••"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <button
          type="button"
          style={{ padding: '0.75rem', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Login (Placeholder)
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/">← Back to Home</Link>
      </p>
    </div>
  )
}
