'use client'

import { Suspense, useEffect, useState } from 'react'
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
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="text-gray-400">Loading...</div></div>}>
      <ScheduleContent />
    </Suspense>
  )
}

function ScheduleContent() {
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
    if (searchParams.get('connected') === 'true') {
      window.history.replaceState({}, '', '/app/schedule')
    } else if (searchParams.get('error') === 'true') {
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
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  const pendingPosts = posts.filter((p) => p.status === 'pending')
  const completedPosts = posts.filter((p) => p.status === 'posted')
  const failedPosts = posts.filter((p) => p.status === 'failed')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Social Scheduling</h1>
          <p className="text-gray-400 mt-1">Manage connections and scheduled posts</p>
        </div>
      </div>

      {/* Connected Accounts */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title text-xl">Connected Accounts</h2>
          <button onClick={handleConnectX} disabled={connecting} className="btn-primary text-sm">
            {connecting ? 'Connecting...' : '+ Connect X/Twitter'}
          </button>
        </div>

        {connections.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-7.94l-1.757 1.757a4.5 4.5 0 00-6.364 6.364l4.5-4.5a4.5 4.5 0 017.244 1.242z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">No accounts connected. Click the button above to connect X/Twitter.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {connections.map((conn) => (
              <div key={conn.id} className="glass-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                    <span className="text-sky-400 text-sm font-bold">{conn.platform === 'x' ? 'X' : conn.platform[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">@{conn.username}</p>
                    <p className="text-xs text-gray-500">
                      {conn.platform === 'x' ? 'X (Twitter)' : conn.platform} - Connected {new Date(conn.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDisconnect(conn.id)} className="btn-danger text-sm py-1.5 px-3">
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scheduled Posts */}
      <section>
        <h2 className="section-title text-xl mb-4">Scheduled Posts</h2>

        {posts.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p className="text-gray-400 text-sm">No scheduled posts yet. Create posts from your campaigns.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-3">
                  Pending ({pendingPosts.length})
                </h3>
                <div className="space-y-3">
                  {pendingPosts.map((post) => (
                    <div key={post.id} className="glass-panel p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="status-pill bg-sky-500/20 text-sky-400">
                            {post.socialConnection.platform.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">@{post.socialConnection.username}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Scheduled: {new Date(post.scheduledFor).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-4 mb-3 text-sm text-gray-300 whitespace-pre-wrap">
                        {post.content}
                      </div>
                      <button onClick={() => handleCancelPost(post.id)} className="btn-danger text-sm py-1.5">
                        Cancel Post
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">
                  Posted ({completedPosts.length})
                </h3>
                <div className="space-y-3">
                  {completedPosts.map((post) => (
                    <div key={post.id} className="glass-panel p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="status-pill bg-green-500/20 text-green-400">
                            {post.socialConnection.platform.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">@{post.socialConnection.username}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Posted: {post.postedAt ? new Date(post.postedAt).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap">
                        {post.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {failedPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">
                  Failed ({failedPosts.length})
                </h3>
                <div className="space-y-3">
                  {failedPosts.map((post) => (
                    <div key={post.id} className="glass-panel p-5 border-red-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="status-pill bg-red-500/20 text-red-400">
                            {post.socialConnection.platform.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">@{post.socialConnection.username}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(post.scheduledFor).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap mb-3">
                        {post.content}
                      </div>
                      {post.error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                          {post.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
