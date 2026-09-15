'use client'

import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import UnifiedComposer from './components/UnifiedComposer'
import Calendar from './components/Calendar'
import ScheduledPosts from './components/ScheduledPosts'
import Header from './components/Header'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<any[]>([])
  const [view, setView] = useState<'compose' | 'calendar' | 'queue'>('compose')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        loadContent(session.user.id)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth error:', error)
    }
    setLoading(false)
  }

  const loadContent = async (userId: string) => {
    try {
      const { data: postData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('schedule_date', { ascending: true })
      setPosts(postData || [])
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  const handleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      })
      if (error) throw error
    } catch (error) {
      console.error('Sign in error:', error)
      alert('Sign in failed')
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setPosts([])
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">SocialQueue</h1>
          <div className="flex items-center gap-4">
            {user && <span className="text-gray-600">{user.email}</span>}
            {user ? (
              <button
                onClick={handleSignOut}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={handleSignIn}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!user ? (
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold mb-4">Welcome to SocialQueue</h1>
            <p className="text-gray-600 mb-8 text-lg">
              AI-powered composer for Threads, Twitter, Bluesky, and Blogs with DALL-E image generation
            </p>
            <button
              onClick={handleSignIn}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 text-lg font-semibold"
            >
              Sign In with Google to Get Started
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex gap-4 mb-6 flex-wrap">
              <button
                onClick={() => setView('compose')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'compose' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                ✍️ Compose
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                📅 Calendar
              </button>
              <button
                onClick={() => setView('queue')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'queue' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                📋 Queue
              </button>
            </div>

            {view === 'compose' && (
              <UnifiedComposer userId={user.id} onPostCreated={() => loadContent(user.id)} />
            )}
            {view === 'calendar' && <Calendar posts={posts} />}
            {view === 'queue' && <ScheduledPosts posts={posts} />}
          </div>
        )}
      </div>
    </main>
  )
}
