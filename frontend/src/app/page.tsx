import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to Creator AI Hub</h1>
      <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        AI-powered platform for content creators.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/login">
          <button style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Get Started
          </button>
        </Link>
        <Link href="/app/campaigns">
          <button style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            View Campaigns
          </button>
        </Link>
      </div>
    </div>
  )
}
