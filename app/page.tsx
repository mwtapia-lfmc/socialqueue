'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { authedFetch } from './lib/api'
import UnifiedComposer, { type Item } from './components/UnifiedComposer'
import Drafts from './components/Drafts'
import Calendar from './components/Calendar'
import ScheduledPosts from './components/ScheduledPosts'
import Accounts, { type Connection } from './components/Accounts'
import Profiles from './components/Profiles'
import type { Profile } from './api/profiles/route'
import Dashboard from './components/Dashboard'

type View = 'home' | 'compose' | 'drafts' | 'calendar' | 'queue' | 'profiles' | 'accounts'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [view, setView] = useState<View>('home')
  const [editing, setEditing] = useState<Item | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const cacheGet = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
  const cacheSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

  const hydrate = useCallback((userId: string) => {
    const i = cacheGet<Item[]>(`sq:${userId}:items`); if (i) setItems(i)
    const c = cacheGet<Connection[]>(`sq:${userId}:connections`); if (c) setConnections(c)
    const p = cacheGet<Profile[]>(`sq:${userId}:profiles`); if (p) setProfiles(p)
  }, [])

  const loadItems = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('items').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
    if (error) { console.error('Load failed:', error); return }
    setItems((data || []) as Item[]); cacheSet(`sq:${userId}:items`, data || [])
  }, [])

  const loadConnections = useCallback(async (userId?: string) => {
    const r = await authedFetch('/api/connections')
    if (!r.ok) return
    const list = (await r.json()).connections || []
    setConnections(list); if (userId) cacheSet(`sq:${userId}:connections`, list)
  }, [])

  const loadProfiles = useCallback(async (userId: string, fresh = false) => {
    setProfilesLoading(true)
    const r = await authedFetch(`/api/profiles${fresh ? '?fresh=1' : ''}`)
    if (r.ok) { const list = (await r.json()).profiles || []; setProfiles(list); cacheSet(`sq:${userId}:profiles`, list) }
    setProfilesLoading(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search.slice(1) + '&' + window.location.hash.slice(1))
    const desc = params.get('error_description') || params.get('error')
    if (desc) setAuthError(decodeURIComponent(desc.replace(/\+/g, ' ')))
    const connectErr = params.get('connect_error')
    if (connectErr) { setView('accounts'); setTimeout(() => alert('Could not connect: ' + decodeURIComponent(connectErr.replace(/\+/g, ' '))), 50) }
    if (params.get('connected')) setView('accounts')
    if (desc || connectErr || params.get('connected')) window.history.replaceState({}, '', window.location.pathname)
    const boot = (u: any) => { hydrate(u.id); loadItems(u.id); loadConnections(u.id); loadProfiles(u.id) }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) boot(session.user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser((prev: any) => {
        if (session?.user && prev?.id !== session.user.id) boot(session.user)
        return session?.user ?? null
      })
      if (!session?.user) { setItems([]); setConnections([]); setProfiles(null) }
    })
    return () => sub.subscription.unsubscribe()
  }, [hydrate, loadItems, loadConnections, loadProfiles])

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
    await loadItems(user.id); loadProfiles(user.id, true)
  }

  const accounts = Object.fromEntries(connections.map((c) => [c.platform, { handle: c.handle, avatar: c.avatar, displayName: c.displayName }]))
  const repurpose = (text: string, platform: string) => {
    setEditing({ id: '', kind: 'post', title: null, content: text, tone: 'casual', platforms: { threads: platform === 'threads', twitter: platform === 'twitter', bluesky: platform === 'bluesky', linkedin: platform === 'linkedin' }, hashtags: [], image_urls: [], analysis: null, status: 'draft', schedule_date: null, schedule_time: null, created_at: '', updated_at: '' } as unknown as Item)
    setView('compose')
  }
  const quickPost = (text: string) => {
    setEditing({ id: '', kind: 'post', title: null, content: text, tone: 'casual', platforms: Object.fromEntries(['threads', 'twitter', 'bluesky', 'linkedin'].map((p) => [p, !!connections.find((c) => c.platform === p)])), hashtags: [], image_urls: [], analysis: null, status: 'draft', schedule_date: null, schedule_time: null, created_at: '', updated_at: '' } as unknown as Item)
    setView('compose')
  }
  const drafts = items.filter((i) => i.status === 'draft')
  const scheduled = items.filter((i) => i.status === 'scheduled')
  const queue = items.filter((i) => i.status !== 'draft')

  const tabs: { key: View; label: string; count?: number }[] = [
    { key: 'home', label: '🏠 Home' },
    { key: 'compose', label: '✍️ Compose' },
    { key: 'drafts', label: '📝 Drafts', count: drafts.length },
    { key: 'calendar', label: '📅 Calendar' },
    { key: 'queue', label: '🚀 Queue', count: scheduled.length },
    { key: 'profiles', label: '👤 Profiles' },
    { key: 'accounts', label: '🔗 Accounts', count: connections.length },
  ]

  return (
    <main className="min-h-screen">
      <div className="sq-bg" />
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/60 border-b border-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <button onClick={() => { setView('home'); setEditing(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-2xl font-extrabold tracking-tight hover:opacity-80 transition" aria-label="Home">
            <span className="sq-gradient-text">SocialQueue</span>
            <span className="ml-2 align-middle text-[11px] font-medium text-gray-400 tracking-normal">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </button>
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

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-5 sq-pulse" aria-busy="true">
            <div className="h-8 w-64 rounded-lg bg-white/70" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/70" />)}</div>
            <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2 h-64 rounded-2xl bg-white/70" /><div className="h-64 rounded-2xl bg-white/70" /></div>
          </div>
        ) : !user ? (
          <div className="text-center py-20 sq-fade-in">
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-5">
              Write once.<br /><span className="sq-gradient-text">Post everywhere.</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto mb-8">
              One composer for Threads, X, Bluesky, and your blog — with AI analysis, image generation sized for each platform, and autosaved drafts.
            </p>
            <button onClick={signIn} className="sq-btn-primary px-8 py-4 rounded-2xl text-lg font-semibold">Sign in with Google</button>
            {authError && (
              <div className="max-w-xl mx-auto mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left sq-fade-in">
                <p className="text-sm font-semibold text-red-800">Sign-in didn't complete</p>
                <p className="text-sm text-red-700 mt-1">{authError}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:flex gap-2 mb-6 flex-wrap">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => { setView(t.key); if (t.key !== 'compose') setEditing(null) }}
                  className={`sq-tab px-4 py-2 rounded-full text-sm font-medium ${view === t.key ? 'sq-tab-active' : 'bg-white/80 text-gray-700 border border-gray-200 hover:border-indigo-300'}`}>
                  {t.label}{t.count ? <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${view === t.key ? 'bg-white/25' : 'bg-gray-100'}`}>{t.count}</span> : null}
                </button>
              ))}
            </div>

            <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/85 backdrop-blur-md border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="grid grid-cols-7">
                {tabs.map((t) => {
                  const [icon, ...rest] = t.label.split(' ')
                  const active = view === t.key
                  return (
                    <button key={t.key} onClick={() => { setView(t.key); if (t.key !== 'compose') setEditing(null); window.scrollTo({ top: 0 }) }}
                      className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? 'text-indigo-600 font-semibold' : 'text-gray-500'}`}>
                      <span className="text-lg leading-none">{icon}</span>
                      <span className="truncate max-w-full px-0.5">{rest.join(' ')}</span>
                      {t.count ? <span className="absolute top-1 right-1/2 translate-x-4 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">{t.count}</span> : null}
                    </button>
                  )
                })}
              </div>
            </nav>

            {connections.length === 0 && (view === 'compose' || view === 'home') && (
              <button onClick={() => setView('accounts')} className="w-full mb-5 text-left sq-card p-4 flex items-center gap-3 border-amber-200 bg-amber-50/70 hover:bg-amber-50 sq-fade-in">
                <span className="text-xl">🔗</span>
                <span className="text-sm text-amber-900"><strong>No accounts connected.</strong> Scheduled posts won't publish anywhere yet — connect Bluesky to start.</span>
                <span className="ml-auto text-amber-700 text-sm font-medium">Connect →</span>
              </button>
            )}

            {view === 'home' && <Dashboard user={user} items={items} connections={connections} onGo={(v) => setView(v)} onEdit={edit} onQuickPost={quickPost} />}
            {view === 'compose' && (
              <UnifiedComposer key={editing?.id || 'new'} userId={user.id} accounts={accounts} item={editing} onSaved={upsertLocal} onScheduled={() => { setEditing(null); setView('queue') }} />
            )}
            {view === 'drafts' && <Drafts items={drafts} onEdit={edit} onSchedule={schedule} onDelete={remove} />}
            {view === 'calendar' && <Calendar items={items.filter((i) => i.schedule_date)} onSelect={edit} />}
            {view === 'queue' && <ScheduledPosts items={queue} onEdit={edit} onUnschedule={unschedule} onDelete={remove} onPublishNow={publishNow} />}
            {view === 'profiles' && <Profiles profiles={profiles} loading={profilesLoading} onRefresh={() => loadProfiles(user.id, true)} onRepurpose={repurpose} onConnect={() => setView('accounts')} />}
            {view === 'accounts' && <Accounts connections={connections} onChange={() => { loadConnections(user.id); loadProfiles(user.id, true) }} />}
          </>
        )}
      </div>
    </main>
  )
}
