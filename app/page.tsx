'use client'

import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import ComposePost from './components/ComposePost'
import Calendar from './components/Calendar'
import ScheduledPosts from './components/ScheduledPosts'
import BlogCompose from './components/BlogCompose'
import BlogQueue from './components/BlogQueue'
import Header from './components/Header'

export default function Home() {
  const [user, setUser] = useState<any>({ email: 'demo@socialqueue.app' })
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<any[]>([])
  const [blogs, setBlogs] = useState<any[]>([])
  const [view, setView] = useState<'compose' | 'calendar' | 'queue' | 'blog'>('compose')
  const [blogView, setBlogView] = useState<'compose' | 'queue'>('compose')

  useEffect(() => {
    loadPosts()
    loadBlogs()
  }, [])

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*').order('schedule_date', { ascending: true })
      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error loading posts:', error)
    }
    setLoading(false)
  }

  const loadBlogs = async () => {
    try {
      const { data, error } = await supabase.from('blog_posts').select('*').order('schedule_date', { ascending: true })
      if (error) throw error
      setBlogs(data || [])
    } catch (error) {
      console.error('Error loading blogs:', error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header user={user} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!user ? (
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold mb-4">Welcome to SocialQueue</h1>
            <p className="text-gray-600 mb-8">Schedule posts across Threads and Twitter/X</p>
            <div className="flex gap-4 justify-center">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                Sign in with Threads
              </button>
              <button className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800">
                Sign in with Twitter
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex gap-4 mb-6 flex-wrap">
              <button
                onClick={() => setView('compose')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'compose' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                Compose
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                Calendar
              </button>
              <button
                onClick={() => setView('queue')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'queue' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                Queue
              </button>
              <button
                onClick={() => setView('blog')}
                className={`px-4 py-2 rounded-lg font-medium ${view === 'blog' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border'}`}
              >
                Blog
              </button>
            </div>

            {view === 'compose' && <ComposePost onPostCreated={loadPosts} />}
            {view === 'calendar' && <Calendar posts={posts} />}
            {view === 'queue' && <ScheduledPosts posts={posts} />}
            {view === 'blog' && (
              <div className="space-y-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => setBlogView('compose')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${blogView === 'compose' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border'}`}
                  >
                    Write Blog
                  </button>
                  <button
                    onClick={() => setBlogView('queue')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${blogView === 'queue' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border'}`}
                  >
                    Blog Queue
                  </button>
                </div>
                {blogView === 'compose' && <BlogCompose onBlogCreated={loadBlogs} />}
                {blogView === 'queue' && <BlogQueue blogs={blogs} />}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
