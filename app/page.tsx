'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { authedFetch } from './lib/api'
import UnifiedComposer, { type Item } from './components/UnifiedComposer'
import Drafts from './components/Drafts'
import Calendar from './components/Calendar'
import ScheduledPosts from './components/ScheduledPosts'
import Accounts, { type Connection } from './components/Accounts'

type View = 'compose' | 'drafts' | 'calendar' | 'queue' | 'accounts'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [view, setView] = useState<View>('compose')
  const [editing, setEditing] = useState<Item | null>(null)

  const loadItems = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('items').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
    if (error) { console.error('Load failed:', error); return }
    setItems((data || []) as Item[])
  }, [])

  const loadConnections = useCallback(async () => {
    const r = await authedFetch('/api/connections')
    if (r.ok) setConnections((await r.json()).connections || [])
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadItems(session.user.id); loadConnections() }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadItems(session.user.id); loadConnections() }
      else { setItems([]); setConnections([]) }
    })
    return () => sub.subscription.unsubscribe()
  }, [loadItems, loadConnections])

  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  const signOut = () => supabase.auth.signOut()

  const upsertLocal = (item: Item) => setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)])
  const edit = (item: Item) => { setEditing(item); setView('compose') }

  const setStatus = async (item: Item, patch: Partial<Item>) => {
    const { data, error } = await supabase.from('items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id).select().single()
    if (error) { alert('Update failed: ' + error.message); return }
    upsertLocal(data as Item)
  }
  const schedule = (item: Item, date: string, time: string) => setStatus(item, { status: 'scheduled', schedule_date: date, schedule_time: time })
  const unschedule = (item: Item) => setStatus(item, { status: 'draft', schedule_date: null, schedule_time: null, publish_log: null })
  const remove = async (item: Item) => {
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) { alert('Delete failed: ' + error.message); return }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    if (editing?.id === item.id) setEditing(null)
  }
  const publishNow = async (item: Item) => {
    const r = await authedFetch('/api/publish', { method: 'POST', body: JSON.stringify({ id: item.id }) })
    const data = await r.json()
    if (!r.ok) alert(data.error || 'Publish failed')
    await loadItems(user.id)
  }

  const drafts = items.filter((i) => i.status === 'draft')
  const scheduled = items.filter((i) => i.status === 'scheduled')
  const queue = items.filter((i) => i.status !== 'draft')

  const tabs: { key: View; label: string; count?: number }[] = [
    { key: 'compose', label: '✍️ Compose' },
    { key: 'drafts', label: '📝 Drafts', count: drafts.length },
    { key: 'calendar', label: '📅 Calendar' },
    { key: 'queue', label: '🚀 Queue', count: scheduled.length },
    { key: 'accounts', label: '🔗 Accounts', count: connections.length },
  ]

  return (
    <main className="min-h-screen">
      <div className="sq-bg" />
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/60 border-b border-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight"><span className="sq-gradient-text">SocialQueue</span></h1>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-gray-600">{user.email}</span>
              <button onClick={signOut} className="text-sm px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50">Sign out</button>
            </div>
          ) : !loading && (
            <button onClick={signIn} className="sq-btn-primary text-sm px-4 py-2 rounded-full font-medium">Sign in with Google</button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-24 text-gray-400 sq-pulse">Loading…</div>
        ) : !user ? (
          <div className="text-center py-20 sq-fade-in">
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-5">
              Write once.<br /><span className="sq-gradient-text">Post everywhere.</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto mb-8">
              One composer for Threads, X, Bluesky, and your blog — with AI analysis, image generation sized for each platform, and autosaved drafts.
            </p>
            <button onClick={signIn} className="sq-btn-primary px-8 py-4 rounded-2xl text-lg font-semibold">Sign in with Google</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => { setView(t.key); if (t.key !== 'compose') setEditing(null) }}
                  className={`sq-tab px-4 py-2 rounded-full text-sm font-medium ${view === t.key ? 'sq-tab-active' : 'bg-white/80 text-gray-700 border border-gray-200 hover:border-indigo-300'}`}>
                  {t.label}{t.count ? <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${view === t.key ? 'bg-white/25' : 'bg-gray-100'}`}>{t.count}</span> : null}
                </button>
              ))}
            </div>

            {connections.length === 0 && view === 'compose' && (
              <button onClick={() => setView('accounts')} className="w-full mb-5 text-left sq-card p-4 flex items-center gap-3 border-amber-200 bg-amber-50/70 hover:bg-amber-50 sq-fade-in">
                <span className="text-xl">🔗</span>
                <span className="text-sm text-amber-900"><strong>No accounts connected.</strong> Scheduled posts won't publish anywhere yet — connect Bluesky to start.</span>
                <span className="ml-auto text-amber-700 text-sm font-medium">Connect →</span>
              </button>
            )}

            {view === 'compose' && (
              <UnifiedComposer key={editing?.id ?? 'new'} userId={user.id} item={editing} onSaved={upsertLocal} onScheduled={() => { setEditing(null); setView('queue') }} />
            )}
            {view === 'drafts' && <Drafts items={drafts} onEdit={edit} onSchedule={schedule} onDelete={remove} />}
            {view === 'calendar' && <Calendar items={scheduled} onSelect={edit} />}
            {view === 'queue' && <ScheduledPosts items={queue} onEdit={edit} onUnschedule={unschedule} onDelete={remove} onPublishNow={publishNow} />}
            {view === 'accounts' && <Accounts connections={connections} onChange={loadConnections} />}
          </>
        )}
      </div>
    </main>
  )
}
