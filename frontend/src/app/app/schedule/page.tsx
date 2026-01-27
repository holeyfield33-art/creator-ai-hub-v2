'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  listConnections,
  listScheduledPosts,
  getConnectXUrl,
  disconnectConnection,
  cancelScheduledPost,
  SocialConnection,
  ScheduledPost,
} from '@/lib/social-api'

export default function SchedulePage() {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login')
      return
    }

    if (session?.access_token) {
      loadData()
    }

    // Check for OAuth success/error
    if (searchParams.get('connected') === 'true') {
      alert('Account connected successfully!')
      window.history.replaceState({}, '', '/app/schedule')
    } else if (searchParams.get('error') === 'true') {
      alert('Failed to connect account. Please try again.')
      window.history.replaceState({}, '', '/app/schedule')
    }
  }, [session, authLoading, router, searchParams])

  async function loadData() {
    if (!session?.access_token) return

    try {
      setLoading(true)
      const [connectionsData, postsData] = await Promise.all([
        listConnections(session.access_token),
        listScheduledPosts(session.access_token),
      ])
      setConnections(connectionsData.connections)
      setPosts(postsData.posts)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnectX() {
    if (!session?.access_token) return

    try {
      setConnecting(true)
      const { authUrl } = await getConnectXUrl(session.access_token)
      window.location.href = authUrl
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate connection')
      setConnecting(false)
    }
  }

  async function handleDisconnect(connectionId: string) {
    if (!session?.access_token || !confirm('Disconnect this account?')) return

    try {
      await disconnectConnection(connectionId, session.access_token)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  async function handleCancelPost(postId: string) {
    if (!session?.access_token || !confirm('Cancel this scheduled post?')) return

    try {
      await cancelScheduledPost(postId, session.access_token)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel post')
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Loading...</p>
      </div>
    )
  }

  const pendingPosts = posts.filter((p) => p.status === 'pending')
  const completedPosts = posts.filter((p) => p.status === 'posted')
  const failedPosts = posts.filter((p) => p.status === 'failed')

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Social Scheduling</h1>
        <button
          onClick={() => router.push('/app/campaigns')}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer',
          }}
        >
          ← Back to Campaigns
        </button>
      </div>

      {/* Connected Accounts Section */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Connected Accounts</h2>
          <button
            onClick={handleConnectX}
            disabled={connecting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: connecting ? '#ccc' : '#1DA1F2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: connecting ? 'not-allowed' : 'pointer',
            }}
          >
            {connecting ? 'Connecting...' : '+ Connect X/Twitter'}
          </button>
        </div>

        {connections.length === 0 ? (
          <div style={{ padding: '2rem', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', color: '#666' }}>
            <p>No accounts connected yet. Click "+ Connect X/Twitter" to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {connections.map((conn) => (
              <div
                key={conn.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {conn.platform === 'x' ? 'X (Twitter)' : conn.platform} - @{conn.username}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Connected: {new Date(conn.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'white',
                    color: '#dc2626',
                    border: '1px solid #dc2626',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Posts Section */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>Scheduled Posts</h2>

        {posts.length === 0 ? (
          <div style={{ padding: '2rem', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', color: '#666' }}>
            <p>No scheduled posts yet. Create posts from your campaigns!</p>
          </div>
        ) : (
          <>
            {/* Pending Posts */}
            {pendingPosts.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#0070f3' }}>
                  Pending ({pendingPosts.length})
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {pendingPosts.map((post) => (
                    <div
                      key={post.id}
                      style={{
                        padding: '1.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div>
                          <span style={{ fontWeight: '600', color: '#0070f3' }}>
                            {post.socialConnection.platform.toUpperCase()}
                          </span>
                          {' - '}
                          <span style={{ color: '#666' }}>@{post.socialConnection.username}</span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          Scheduled: {new Date(post.scheduledFor).toLocaleString()}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#f9f9f9',
                          borderRadius: '4px',
                          marginBottom: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                        }}
                      >
                        {post.content}
                      </div>
                      <button
                        onClick={() => handleCancelPost(post.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: 'white',
                          color: '#dc2626',
                          border: '1px solid #dc2626',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Posts */}
            {completedPosts.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#10b981' }}>
                  Posted ({completedPosts.length})
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {completedPosts.map((post) => (
                    <div
                      key={post.id}
                      style={{
                        padding: '1.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div>
                          <span style={{ fontWeight: '600', color: '#10b981' }}>
                            {post.socialConnection.platform.toUpperCase()}
                          </span>
                          {' - '}
                          <span style={{ color: '#666' }}>@{post.socialConnection.username}</span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          Posted: {post.postedAt ? new Date(post.postedAt).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#f9f9f9',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                        }}
                      >
                        {post.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Posts */}
            {failedPosts.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#dc2626' }}>
                  Failed ({failedPosts.length})
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {failedPosts.map((post) => (
                    <div
                      key={post.id}
                      style={{
                        padding: '1.5rem',
                        border: '1px solid #dc2626',
                        borderRadius: '8px',
                        backgroundColor: '#fef2f2',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div>
                          <span style={{ fontWeight: '600', color: '#dc2626' }}>
                            {post.socialConnection.platform.toUpperCase()}
                          </span>
                          {' - '}
                          <span style={{ color: '#666' }}>@{post.socialConnection.username}</span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          Failed at: {new Date(post.scheduledFor).toLocaleString()}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'white',
                          borderRadius: '4px',
                          marginBottom: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                        }}
                      >
                        {post.content}
                      </div>
                      {post.error && (
                        <div
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#fee2e2',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            color: '#dc2626',
                          }}
                        >
                          Error: {post.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
