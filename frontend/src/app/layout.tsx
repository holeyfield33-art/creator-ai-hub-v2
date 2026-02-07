import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Creator AI Hub',
  description: 'AI-powered creator platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
          <Link href="/" style={{ marginRight: '1rem' }}>Home</Link>
          <Link href="/login" style={{ marginRight: '1rem' }}>Login</Link>
          <Link href="/app/campaigns">Campaigns</Link>
        </nav>
        <main style={{ padding: '2rem' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
