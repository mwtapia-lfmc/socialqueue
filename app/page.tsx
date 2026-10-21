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
import type { TrendSource } from './api/trends/route'
import Dashboard from './components/Dashboard'
import BatchComposer from './components/BatchComposer'
import Trends from './components/Trends'
import Help from './components/Help'
import Structure, { type StructureState, type NewCtx } from './components/Structure'
import { SEED_BUCKETS, SEED_IDEAS, SEED_SERIES, ymd, type Format, type StructureData } from './lib/structure'

type View = 'home' | 'compose' | 'batch' | 'structure' | 'drafts' | 'calendar' | 'queue' | 'profiles' | 'trends' | 'accounts' | 'help'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [trends, setTrends] = useState<{ sources: TrendSource[]; note: string } | null>(null)
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [view, setView] = useState<View>('home')
  const [editing, setEditing] = useState<Item | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [structure, setStructure] = useState<StructureData | null>(null)
  const [structureState, setStructureState] = useState<StructureState>('loading')
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => { try { setCollapsed(localStorage.getItem('sq:sidebar') === 'collapsed') } catch {} }, [])
  const toggleSidebar = () => setCollapsed((c) => { try { localStorage.setItem('sq:sidebar', c ? 'open' : 'collapsed') } catch {}; return !c })
  const go = (v: View) => { setView(v); if (v !== 'compose') setEditing(null); window.scrollTo({ top: 0 }) }

  const cacheGet = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
  const cacheSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

  const hydrate = useCallback((userId: string) => {
    const i = cacheGet<Item[]>(`sq:${userId}:items`); if (i) setItems(i)
    const c = cacheGet<Connection[]>(`sq:${userId}:connections`); if (c) setConnections(c)
    const p = cacheGet<Profile[]>(`sq:${userId}:profiles`); if (p) setProfiles(p)
    const t = cacheGet<{ sources: TrendSource[]; note: string }>(`sq:${userId}:trends`); if (t) setTrends(t)
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

  const loadStructure = useCallback(async (userId: string) => {
    const pubs = await supabase.from('publications').select('*').eq('user_id', userId).order('created_at').limit(1)
    if (pubs.error) { setStructureState(/could not find|does not exist|schema cache|relation/i.test(pubs.error.message) ? 'missing' : 'loading'); return }
    const pub = pubs.data?.[0]
    if (!pub) { setStructure(null); setStructureState('empty'); return }
    const [se, bu] = await Promise.all([
      supabase.from('series').select('*').eq('publication_id', pub.id).order('sort_order'),
      supabase.from('buckets').select('*').eq('publication_id', pub.id).order('sort_order'),
    ])
    setStructure({ publication: pub, series: se.data || [], buckets: bu.data || [] }); setStructureState('ready')
  }, [])

  const loadTrends = useCallback(async (userId: string) => {
    setTrendsLoading(true)
    const r = await authedFetch('/api/trends')
    if (r.ok) { const d = await r.json(); const v = { sources: d.sources, note: d.note }; setTrends(v); cacheSet(`sq:${userId}:trends`, v) }
    setTrendsLoading(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search.slice(1) + '&' + window.location.hash.slice(1))
    const desc = params.get('error_description') || params.get('error')
    if (desc) setAuthError(decodeURIComponent(desc.replace(/\+/g, ' ')))
    const connectErr = params.get('connect_error')
    if (connectErr) { setView('accounts'); setTimeout(() => alert('Could not connect: ' + decodeURIComponent(connectErr.replace(/\+/g, ' '))), 50) }
    if (params.get('connected')) setView('accounts')
    if (desc || connectErr || params.get('connected')) window.history.replaceState({}, '', window.location.pathname)
    const boot = (u: any) => { hydrate(u.id); loadItems(u.id); loadConnections(u.id); loadProfiles(u.id); loadTrends(u.id); loadStructure(u.id) }
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
  }, [hydrate, loadItems, loadConnections, loadProfiles, loadTrends, loadStructure])

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
  // ---- Substack structure ----
  const noPlatforms = { threads: false, twitter: false, bluesky: false, linkedin: false }
  const newStructureItem = (format: Format, ctx: NewCtx & Partial<Item> = {}): Item => ({
    id: '', kind: format === 'longform' ? 'blog' : 'post', title: null, content: '', tone: 'casual', platforms: noPlatforms, hashtags: [], image_urls: [], analysis: null,
    status: 'draft', schedule_date: null, schedule_time: null, created_at: '', updated_at: '',
    publication_id: structure?.publication.id ?? null, series_id: ctx.seriesId ?? null, bucket_id: ctx.bucketId ?? null, format, hook: '', stage: 'drafting', planned_for: ctx.plannedFor ?? null, tags: [], source_item_id: null,
    ...(({ seriesId, bucketId, plannedFor, ...rest }) => rest)(ctx),
  } as Item)

  const seedStructure = async () => {
    const uid = user.id
    const pub = await supabase.from('publications').insert({ user_id: uid, name: 'Media Literacy', platform: 'substack', year_theme: 'Media Literacy, soup to nuts' }).select().single()
    if (pub.error) return alert('Setup failed: ' + pub.error.message)
    const se = await supabase.from('series').insert(SEED_SERIES.map((x, i) => ({ user_id: uid, publication_id: pub.data.id, sort_order: i, ...x }))).select()
    const bu = await supabase.from('buckets').insert(SEED_BUCKETS.map((x, i) => ({ user_id: uid, publication_id: pub.data.id, sort_order: i, ...x }))).select()
    if (se.error || bu.error) return alert('Setup failed: ' + (se.error || bu.error)!.message)
    const byKey = Object.fromEntries((se.data || []).map((x: any) => [x.key, x.id]))
    const ideas = await supabase.from('items').insert(SEED_IDEAS.map((i) => ({
      user_id: uid, kind: 'blog', format: 'longform', title: i.title, content: '', tone: 'casual', platforms: noPlatforms, hashtags: [], image_urls: [],
      status: 'draft', stage: 'idea', publication_id: pub.data.id, series_id: i.series ? byKey[i.series] : null, tags: i.tags || [],
    })))
    if (ideas.error) return alert('Structure created, but the idea posts failed: ' + ideas.error.message)
    await Promise.all([loadStructure(uid), loadItems(uid)])
  }

  const renameStructure = async (table: 'series' | 'buckets', id: string, patch: { name?: string; description?: string }) => {
    const { error } = await supabase.from(table).update(patch).eq('id', id)
    if (error) return alert('Rename failed: ' + error.message)
    setStructure((st) => st && ({ ...st, [table]: (st[table] as any[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }

  const renamePublication = async (patch: { name?: string; year_theme?: string }) => {
    if (!structure) return
    const { error } = await supabase.from('publications').update(patch).eq('id', structure.publication.id)
    if (error) return alert('Rename failed: ' + error.message)
    setStructure({ ...structure, publication: { ...structure.publication, ...patch } })
  }

  const repurposeStructure = (src: Item) => {
    const toFormat: Format = src.format === 'longform' ? 'note' : 'longform'
    const firstPara = (src.content || '').split(/\n\s*\n/)[0] || ''
    const bucket = structure?.buckets.find((b) => b.key === 'repurposed')
    edit({
      ...newStructureItem(toFormat, { seriesId: src.series_id, bucketId: bucket?.id ?? src.bucket_id }),
      title: toFormat === 'longform' ? src.title : null,
      content: toFormat === 'note' ? (src.hook || firstPara).slice(0, 280) : src.content,
      hook: src.hook || '', tags: src.tags || [], source_item_id: src.id,
    } as Item)
  }

  const markPublished = (it: Item) => setStatus(it, { status: 'published', published_at: new Date().toISOString() })

  const planTwoWeeks = async () => {
    if (!structure) return
    const bs = structure.buckets
    const today = new Date()
    const day = (n: number) => { const d = new Date(today); d.setDate(today.getDate() + n); return ymd(d) }
    const base = { user_id: user.id, tone: 'casual', platforms: noPlatforms, hashtags: [], image_urls: [], status: 'draft', stage: 'idea', publication_id: structure.publication.id, tags: [] }
    const rows = [
      ...Array.from({ length: 14 }, (_, i) => ({ ...base, kind: 'post', format: 'note', title: `${bs[i % bs.length]?.name || 'Note'} note`, content: '', bucket_id: bs[i % bs.length]?.id ?? null, planned_for: day(i) })),
      ...[2, 9].map((n, i) => ({ ...base, kind: 'blog', format: 'longform', title: 'Longform idea', content: '', bucket_id: bs[(i + 1) % Math.max(1, bs.length)]?.id ?? null, planned_for: day(n) })),
    ]
    const { error } = await supabase.from('items').insert(rows)
    if (error) return alert('Planning failed: ' + error.message)
    await loadItems(user.id)
  }

  const drafts = items.filter((i) => i.status === 'draft' && i.stage !== 'idea')
  const scheduled = items.filter((i) => i.status === 'scheduled')
  const queue = items.filter((i) => i.status !== 'draft')

  const tabs: { key: View; label: string; count?: number }[] = [
    { key: 'home', label: '🏠 Home' },
    { key: 'compose', label: '✍️ Compose' },
    { key: 'batch', label: '⚡ Batch' },
    { key: 'structure', label: '🗂 Structure' },
    { key: 'drafts', label: '📝 Drafts', count: drafts.length },
    { key: 'calendar', label: '📅 Calendar' },
    { key: 'queue', label: '🚀 Queue', count: scheduled.length },
    { key: 'profiles', label: '👤 Profiles' },
    { key: 'trends', label: '📈 Trends' },
    { key: 'accounts', label: '🔗 Accounts', count: connections.length },
  ]

  return (
    <main className="min-h-screen">
      <div className="sq-bg" />

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 backdrop-blur-md bg-white/60 border-b border-white/60">
        <div className="px-4 py-3 flex justify-between items-center gap-4">
          <button onClick={() => go('home')} className="text-xl font-extrabold tracking-tight" aria-label="Home">
            <span className="sq-gradient-text">SocialQueue</span>
            <span className="ml-2 align-middle text-[10px] font-medium text-gray-400 tracking-normal">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </button>
          {user ? <div className="flex gap-2"><button onClick={() => go('help')} aria-label="Help" className="text-xs h-8 w-8 rounded-full bg-white border border-gray-200 font-bold">?</button><button onClick={signOut} className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200">Sign out</button></div>
            : !loading && <button onClick={signIn} className="sq-btn-primary text-xs px-3 py-1.5 rounded-full font-medium">Sign in</button>}
        </div>
      </header>

      <div className="md:flex">
        {/* Desktop sidebar */}
        {user && (
          <aside className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 border-r border-white/70 bg-white/55 backdrop-blur-md transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 h-16`}>
              <button onClick={() => go('home')} className="font-extrabold tracking-tight text-left" aria-label="Home" title="Home">
                {collapsed ? <span className="sq-gradient-text text-xl">SQ</span> : <><span className="sq-gradient-text text-xl">SocialQueue</span><span className="block text-[10px] font-medium text-gray-400 -mt-0.5">v{process.env.NEXT_PUBLIC_APP_VERSION}</span></>}
              </button>
            </div>
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              {tabs.map((t) => {
                const [icon, ...rest] = t.label.split(' ')
                const active = view === t.key
                return (
                  <button key={t.key} onClick={() => go(t.key)} title={rest.join(' ')}
                    className={`sq-tab w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${collapsed ? 'justify-center' : ''} ${active ? 'sq-tab-active' : 'text-gray-700 hover:bg-white/80'}`}>
                    <span className="text-lg leading-none w-6 text-center">{icon}</span>
                    {!collapsed && <span className="flex-1 text-left truncate">{rest.join(' ')}</span>}
                    {t.count ? <span className={`text-[11px] min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center ${active ? 'bg-white/25' : 'bg-gray-100 text-gray-700'} ${collapsed ? 'absolute translate-x-4 -translate-y-3' : ''}`}>{t.count}</span> : null}
                  </button>
                )
              })}
            </nav>
            <div className="px-3 pb-3 pt-2 border-t border-white/70 space-y-1">
              <div className={`flex items-center gap-2 px-2 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
                {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />}
                {!collapsed && <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{user.user_metadata?.full_name || 'You'}</p><p className="text-[11px] text-gray-500 truncate">{user.email}</p></div>}
              </div>
              <div className={`flex ${collapsed ? 'flex-col' : ''} gap-1`}>
                <button onClick={() => go('help')} title="Help & how-to" className={`sq-tool rounded-lg px-3 py-2 text-xs ${view === 'help' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600'}`}>{collapsed ? '?' : '? Help'}</button>
                <button onClick={signOut} title="Sign out" className={`sq-tool rounded-lg px-3 py-2 text-xs text-gray-600 ${collapsed ? '' : 'flex-1 text-left'}`}>{collapsed ? '⎋' : 'Sign out'}</button>
                <button onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'} className="sq-tool rounded-lg px-3 py-2 text-xs text-gray-600">{collapsed ? '»' : '«'}</button>
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <div className={`mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8 ${user ? 'max-w-[1400px]' : 'max-w-7xl'}`}>
            {loading ? (
              <div className="space-y-5 sq-pulse" aria-busy="true">
                <div className="h-8 w-64 rounded-lg bg-white/70" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/70" />)}</div>
                <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2 h-64 rounded-2xl bg-white/70" /><div className="h-64 rounded-2xl bg-white/70" /></div>
              </div>
            ) : !user ? (
              <div className="text-center py-20 sq-fade-in">
                <div className="hidden md:block mb-10 text-2xl font-extrabold tracking-tight"><span className="sq-gradient-text">SocialQueue</span></div>
                <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-5">
                  Write once.<br /><span className="sq-gradient-text">Post everywhere.</span>
                </h2>
                <p className="text-gray-600 text-lg max-w-xl mx-auto mb-8">
                  One composer for Threads, X, Bluesky, LinkedIn, and your blog — with AI analysis, image generation sized for each platform, and autosaved drafts.
                </p>
                <button onClick={signIn} className="sq-btn-primary px-8 py-4 rounded-2xl text-lg font-semibold">Sign in with Google</button>
                <p className="mt-4 text-sm text-gray-500">Threads · Bluesky · X · LinkedIn · blog drafts · AI analysis · batch scheduling · trends</p>
                {authError && (
                  <div className="max-w-xl mx-auto mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left sq-fade-in">
                    <p className="text-sm font-semibold text-red-800">Sign-in didn't complete</p>
                    <p className="text-sm text-red-700 mt-1">{authError}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Mobile bottom nav */}
                <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/85 backdrop-blur-md border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                  <div className="flex overflow-x-auto sq-scroll">
                    {tabs.map((t) => {
                      const [icon, ...rest] = t.label.split(' ')
                      const active = view === t.key
                      return (
                        <button key={t.key} onClick={() => go(t.key)}
                          className={`relative shrink-0 w-[68px] flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? 'text-indigo-600 font-semibold' : 'text-gray-500'}`}>
                          <span className="text-lg leading-none">{icon}</span>
                          <span className="truncate max-w-full px-0.5">{rest.join(' ')}</span>
                          {t.count ? <span className="absolute top-1 right-1/2 translate-x-4 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">{t.count}</span> : null}
                        </button>
                      )
                    })}
                  </div>
                </nav>

                {connections.length === 0 && (view === 'compose' || view === 'home') && (
                  <button onClick={() => go('accounts')} className="w-full mb-5 text-left sq-card p-4 flex items-center gap-3 border-amber-200 bg-amber-50/70 hover:bg-amber-50 sq-fade-in">
                    <span className="text-xl">🔗</span>
                    <span className="text-sm text-amber-900"><strong>No accounts connected.</strong> Scheduled posts won't publish anywhere yet — connect an account to start.</span>
                    <span className="ml-auto text-amber-700 text-sm font-medium">Connect →</span>
                  </button>
                )}

                {view === 'home' && <Dashboard user={user} items={items} connections={connections} trends={trends?.sources ?? null} onGo={(v) => go(v)} onEdit={edit} onQuickPost={quickPost} />}
                {view === 'compose' && (
                  <UnifiedComposer key={editing?.id || 'new'} userId={user.id} accounts={accounts} connections={connections} structure={structure} item={editing} onSaved={upsertLocal} onScheduled={() => { setEditing(null); go('queue') }} />
                )}
                {view === 'structure' && <Structure state={structureState} data={structure} items={items} onSeed={seedStructure} onRecheck={() => loadStructure(user.id)} onRename={renameStructure} onRenamePublication={renamePublication}
                  onNew={(f, ctx) => edit(newStructureItem(f, ctx))} onOpen={edit} onRepurpose={repurposeStructure} onMarkPublished={markPublished} onDelete={remove} onPlan={planTwoWeeks} />}
                {view === 'batch' && <BatchComposer userId={user.id} connections={connections} onDone={(n) => { loadItems(user.id); go(n ? 'calendar' : 'drafts') }} />}
                {view === 'drafts' && <Drafts items={drafts} onEdit={edit} onSchedule={schedule} onDelete={remove} />}
                {view === 'calendar' && <Calendar items={items.filter((i) => i.schedule_date)} onSelect={edit}
                  onMove={(it, date, time) => setStatus(it, { schedule_date: date, schedule_time: time, ...(it.status === 'failed' ? { status: 'scheduled', publish_log: null } : {}) })}
                  onCreate={(date, time) => { setEditing({ id: '', kind: 'post', title: null, content: '', tone: 'casual', platforms: Object.fromEntries(['threads', 'twitter', 'bluesky', 'linkedin'].map((p) => [p, !!connections.find((c) => c.platform === p)])), hashtags: [], image_urls: [], analysis: null, status: 'draft', schedule_date: date, schedule_time: time, created_at: '', updated_at: '' } as unknown as Item); setView('compose') }} />}
                {view === 'queue' && <ScheduledPosts items={queue} onEdit={edit} onUnschedule={unschedule} onDelete={remove} onPublishNow={publishNow} />}
                {view === 'profiles' && <Profiles profiles={profiles} loading={profilesLoading} onRefresh={() => loadProfiles(user.id, true)} onRepurpose={repurpose} onConnect={() => go('accounts')} />}
                {view === 'trends' && <Trends sources={trends?.sources ?? null} note={trends?.note ?? ''} loading={trendsLoading} onRefresh={() => loadTrends(user.id)} profiles={profiles} onWrite={(text) => quickPost(text)} />}
                {view === 'help' && <Help onGo={go} />}
                {view === 'accounts' && <Accounts connections={connections} onChange={() => { loadConnections(user.id); loadProfiles(user.id, true) }} />}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
