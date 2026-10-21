'use client'

import { useMemo, useState } from 'react'
import { timeAgo } from '../lib/text'
import { CADENCE, FORMAT_LABEL, STAGES, STAGE_STYLE, STRUCTURE_SQL, stageOf, ymd, type Bucket, type Format, type Series, type Stage, type StructureData } from '../lib/structure'
import type { Item } from './UnifiedComposer'

export type StructureState = 'loading' | 'missing' | 'empty' | 'ready'
export interface NewCtx { seriesId?: string | null; bucketId?: string | null; plannedFor?: string | null }

interface Props {
  state: StructureState
  data: StructureData | null
  items: Item[]
  onSeed: () => Promise<void>
  onRecheck: () => void
  onRename: (table: 'series' | 'buckets', id: string, patch: { name?: string; description?: string }) => Promise<void>
  onRenamePublication: (patch: { name?: string; year_theme?: string }) => Promise<void>
  onLogo: (table: 'publications' | 'series', id: string, file: File | null) => Promise<void>
  onNew: (format: Format, ctx: NewCtx) => void
  onOpen: (item: Item) => void
  onRepurpose: (item: Item) => void
  onMarkPublished: (item: Item) => Promise<void>
  onDelete: (item: Item) => Promise<void>
  onPlan: () => Promise<void>
  onPlace: (item: Item, date: string | null) => Promise<void>
}

type Sel = { kind: 'all' } | { kind: 'series'; id: string } | { kind: 'bucket'; id: string }

const fmtOf = (i: Item): Format => (i.format as Format) || 'note'
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }
const label = (i: Item) => i.title || i.hook || i.content.split('\n')[0] || 'Untitled'
const prettyDate = (k: string) => parse(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

function Inline({ value, onSave, className = '', placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  if (!editing) return <button type="button" onClick={() => { setV(value); setEditing(true) }} title="Click to rename" className={`text-left hover:bg-orange-50 rounded px-1 -mx-1 ${className}`}>{value || <span className="text-gray-300">{placeholder}</span>}</button>
  const commit = () => { setEditing(false); if (v.trim() && v !== value) onSave(v.trim()) }
  return <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} className={`border border-orange-300 rounded px-1 -mx-1 w-full focus:outline-none focus:ring-2 focus:ring-orange-200 ${className}`} />
}

function LogoPicker({ url, size, label: lbl, onPick, onClear }: { url?: string | null; size: number; label: string; onPick: (f: File) => void; onClear: () => void }) {
  return (
    <div className="relative group shrink-0" style={{ width: size, height: size }}>
      <label title={url ? `Change ${lbl} logo` : `Add a ${lbl} logo`} className="block w-full h-full cursor-pointer">
        {url
          ? <img src={url} alt="" className="w-full h-full rounded-xl object-cover border border-orange-200 bg-white" />
          : <span className="flex w-full h-full items-center justify-center rounded-xl border-2 border-dashed border-orange-300 text-orange-400 hover:bg-orange-50 text-[10px] font-medium text-center leading-tight">+ logo</span>}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
      </label>
      {url && <button type="button" onClick={onClear} title="Remove logo" className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border border-gray-200 text-gray-500 text-xs opacity-0 group-hover:opacity-100 hover:text-red-600 transition">×</button>}
    </div>
  )
}

export default function Structure(p: Props) {
  const { state, data, items } = p
  const [mode, setMode] = useState<'planner' | 'library'>('planner')
  // library
  const [sel, setSel] = useState<Sel>({ kind: 'all' })
  const [formatF, setFormatF] = useState<'all' | Format>('all')
  const [stageF, setStageF] = useState<'all' | Stage>('all')
  const [crossF, setCrossF] = useState('')
  // planner
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [openSeries, setOpenSeries] = useState<string | null | undefined>(undefined)
  const [repoFormat, setRepoFormat] = useState<'all' | Format>('all')
  const [repoBucket, setRepoBucket] = useState('')
  const [repoQuery, setRepoQuery] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const mine = useMemo(() => (data ? items.filter((i) => i.publication_id === data.publication.id) : []), [items, data])
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }

  if (state === 'loading') return <div className="sq-card p-10 text-center text-gray-400 sq-pulse">Loading structure…</div>

  if (state === 'missing') {
    return (
      <div className="sq-card p-6 space-y-3 max-w-3xl sq-fade-in">
        <h2 className="text-xl font-bold">One setup step</h2>
        <p className="text-sm text-gray-600">The structure tables aren't in your database yet. Open the Supabase SQL editor, paste this, run it, then come back and press the button.</p>
        <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-xl p-4 overflow-auto max-h-72">{STRUCTURE_SQL}</pre>
        <div className="flex gap-2 flex-wrap">
          <button onClick={async () => { await navigator.clipboard.writeText(STRUCTURE_SQL); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200">{copied ? '✓ Copied' : 'Copy SQL'}</button>
          <a href="https://supabase.com/dashboard/project/fbkroevujomkefgnprym/sql/new" target="_blank" rel="noopener" className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200">Open SQL editor ↗</a>
          <button onClick={p.onRecheck} className="sq-btn-primary px-4 py-2 rounded-lg text-sm font-semibold">I ran it — check again</button>
        </div>
      </div>
    )
  }

  if (state === 'empty' || !data) {
    return (
      <div className="sq-card p-8 text-center max-w-xl mx-auto sq-fade-in space-y-3">
        <p className="text-4xl">🗂</p>
        <h2 className="text-xl font-bold">Set up the Substack structure</h2>
        <p className="text-sm text-gray-600">Creates one publication, four series, four buckets, and your eight longform ideas. Everything is renamable afterward.</p>
        <button onClick={() => run(p.onSeed)} disabled={busy} className="sq-btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">{busy ? <span className="sq-pulse">Setting up…</span> : 'Set it up'}</button>
      </div>
    )
  }

  const { publication, series, buckets } = data
  const nameOf = (list: { id: string; name: string }[], id?: string | null) => list.find((x) => x.id === id)?.name
  const todayKey = ymd(new Date())

  const countsFor = (list: Item[]) => { const c: Record<Stage, number> = { idea: 0, drafting: 0, scheduled: 0, published: 0 }; for (const it of list) c[stageOf(it)]++; return c }
  const countText = (list: Item[]) => {
    const c = countsFor(list)
    const parts = [c.idea && `${c.idea} idea${c.idea > 1 ? 's' : ''}`, c.drafting && `${c.drafting} drafting`, c.scheduled && `${c.scheduled} scheduled`, c.published && `${c.published} published`].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'empty'
  }

  // ---------------- header (shared) ----------------
  const Header = (
    <div className="flex flex-wrap items-center gap-4 mb-5">
      <LogoPicker url={publication.logo_url} size={52} label="publication" onPick={(f) => p.onLogo('publications', publication.id, f)} onClear={() => p.onLogo('publications', publication.id, null)} />
      <div className="min-w-0 mr-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ff6719]">Substack</p>
        <Inline value={publication.name} onSave={(name) => p.onRenamePublication({ name })} className="text-2xl font-extrabold leading-tight tracking-tight block" />
        <Inline value={publication.year_theme || ''} placeholder="Add a theme" onSave={(year_theme) => p.onRenamePublication({ year_theme })} className="text-sm text-gray-500 block" />
      </div>
      <div className="flex gap-1 p-1 bg-white/70 border border-gray-200 rounded-full">
        {(['planner', 'library'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`sq-tab px-4 py-1.5 rounded-full text-sm font-medium capitalize ${mode === m ? 'sq-tab-active' : 'text-gray-600 hover:text-gray-900'}`}>{m}</button>)}
      </div>
    </div>
  )

  // ---------------- PLANNER ----------------
  if (mode === 'planner') {
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i)))
    const weekEnd = addDays(weekStart, 6)
    const rangeTitle = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`

    const placedDate = (i: Item) => i.planned_for || (stageOf(i) === 'published' && i.published_at ? ymd(new Date(i.published_at)) : null)
    const inCell = (day: string, f: Format) => mine.filter((i) => placedDate(i) === day && fmtOf(i) === f)
    const placedThisWeek = (f: Format) => days.reduce((n, d) => n + inCell(d, f).length, 0)

    const repo = mine.filter((i) => !i.planned_for && stageOf(i) !== 'published'
      && (repoFormat === 'all' || fmtOf(i) === repoFormat)
      && (!repoBucket || i.bucket_id === repoBucket)
      && (!repoQuery.trim() || `${label(i)} ${(i.tags || []).join(' ')}`.toLowerCase().includes(repoQuery.trim().toLowerCase())))
    const groups: { id: string; name: string; logo?: string | null; list: Item[] }[] = [
      ...series.map((s) => ({ id: s.id, name: s.name, logo: s.logo_url, list: repo.filter((i) => i.series_id === s.id) })),
      { id: 'none', name: 'No series', logo: null, list: repo.filter((i) => !i.series_id || !series.some((s) => s.id === i.series_id)) },
    ]
    const effectiveOpen = openSeries === undefined ? groups.find((g) => g.list.length)?.id ?? null : openSeries
    const dragged = dragId ? mine.find((i) => i.id === dragId) : undefined

    const drop = (day: string | null, cellFormat?: Format) => {
      const it = dragged; setDragId(null); setOverKey(null)
      if (!it || stageOf(it) === 'published') return
      if (day && cellFormat && fmtOf(it) !== cellFormat) return
      if (day === null && !it.planned_for) return
      p.onPlace(it, day)
    }
    const dragProps = (it: Item) => stageOf(it) === 'published' ? {} : {
      draggable: true,
      onDragStart: (e: React.DragEvent) => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id) },
      onDragEnd: () => { setDragId(null); setOverKey(null) },
    }

    const RepoCard = ({ it }: { it: Item }) => (
      <div {...dragProps(it)} className={`rounded-xl border border-gray-200 bg-white p-2.5 space-y-1.5 cursor-grab active:cursor-grabbing hover:border-orange-300 transition ${dragId === it.id ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-900 text-white">{FORMAT_LABEL[fmtOf(it)]}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STAGE_STYLE[stageOf(it)]}`}>{stageOf(it)}</span>
          <span className="flex-1" />
          <button onClick={() => p.onOpen(it)} className="text-[11px] text-indigo-600 hover:underline">Open</button>
        </div>
        <p className="text-[13px] leading-snug font-medium line-clamp-2">{label(it)}</p>
        {it.hook && it.title && <p className="text-[11px] italic text-gray-500 line-clamp-1">“{it.hook}”</p>}
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {nameOf(buckets, it.bucket_id) && <span className="px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-800">{nameOf(buckets, it.bucket_id)}</span>}
          {(it.tags || []).map((t) => <span key={t} className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">#{t}</span>)}
          <label className="ml-auto flex items-center gap-1 text-gray-400" title="Place on a date (works on phones too)">📅
            <input type="date" value="" onChange={(e) => e.target.value && p.onPlace(it, e.target.value)} className="w-[22px] opacity-0 absolute" aria-label="Place on date" />
            <span className="text-indigo-600 hover:underline cursor-pointer">place</span>
          </label>
        </div>
      </div>
    )

    const Cell = ({ day, f }: { day: string; f: Format }) => {
      const list = inCell(day, f)
      const key = `${day}:${f}`
      const canDrop = !!dragged && fmtOf(dragged) === f
      return (
        <div onDragOver={(e) => { if (dragged) { e.preventDefault(); setOverKey(key) } }} onDragLeave={() => setOverKey((k) => (k === key ? null : k))} onDrop={(e) => { e.preventDefault(); drop(day, f) }}
          className={`rounded-xl border p-1.5 min-h-[92px] space-y-1.5 transition ${overKey === key && canDrop ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : dragged ? (canDrop ? 'border-dashed border-orange-300 bg-orange-50/30' : 'border-dashed border-gray-200 opacity-50') : day === todayKey ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-200 bg-white/70'}`}>
          {list.map((it) => {
            const st = stageOf(it)
            return (
              <div key={it.id} {...dragProps(it)} className={`group relative rounded-lg border px-2 py-1.5 text-left ${st === 'published' ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50 cursor-grab active:cursor-grabbing'} ${dragId === it.id ? 'opacity-40' : ''}`}>
                <button onClick={() => p.onOpen(it)} className="block w-full text-left">
                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full mb-0.5 ${STAGE_STYLE[st]}`}>{st}</span>
                  <span className="block text-[12px] leading-snug line-clamp-3">{label(it)}</span>
                  {nameOf(series, it.series_id) && <span className="block text-[10px] text-orange-800/70 mt-0.5 truncate">{nameOf(series, it.series_id)}</span>}
                </button>
                {st !== 'published' && <button onClick={() => p.onPlace(it, null)} title="Back to repository" className="absolute top-1 right-1 h-4 w-4 rounded-full bg-white border border-gray-200 text-gray-400 text-[10px] leading-none opacity-0 group-hover:opacity-100 hover:text-red-600">×</button>}
              </div>
            )
          })}
          {list.length === 0 && (
            <button onClick={() => p.onNew(f, { plannedFor: day, seriesId: effectiveOpen && effectiveOpen !== 'none' ? effectiveOpen : null })} className="w-full h-full min-h-[72px] rounded-lg text-[11px] text-gray-300 hover:text-orange-600 hover:bg-orange-50/60 transition">drop here<br />or + new</button>
          )}
        </div>
      )
    }

    return (
      <div className="sq-fade-in">
        {Header}
        <div className="grid xl:grid-cols-[380px_1fr] gap-5 items-start">
          {/* ---------- repository ---------- */}
          <aside onDragOver={(e) => { if (dragged?.planned_for) { e.preventDefault(); setOverKey('repo') } }} onDragLeave={() => setOverKey((k) => (k === 'repo' ? null : k))} onDrop={(e) => { e.preventDefault(); drop(null) }}
            className={`sq-card p-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto sq-scroll space-y-3 ${overKey === 'repo' ? 'ring-2 ring-orange-300' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="mr-auto"><h3 className="font-bold">Repository</h3><p className="text-[11px] text-gray-500">Composed, saved, tagged. Drag onto a day →</p></div>
              <button onClick={() => p.onNew('note', { seriesId: effectiveOpen && effectiveOpen !== 'none' ? effectiveOpen : null })} className="text-[11px] px-2 py-1.5 rounded-lg bg-orange-100 text-orange-900 hover:bg-orange-200 font-medium">+ Note</button>
              <button onClick={() => p.onNew('longform', { seriesId: effectiveOpen && effectiveOpen !== 'none' ? effectiveOpen : null })} className="text-[11px] px-2 py-1.5 rounded-lg bg-[#ff6719] text-white hover:brightness-95 font-medium">+ Longform</button>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center text-[11px]">
              {(['all', 'note', 'longform'] as const).map((f) => <button key={f} onClick={() => setRepoFormat(f)} className={`px-2 py-1 rounded-full border ${repoFormat === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{f === 'all' ? 'All' : FORMAT_LABEL[f] + 's'}</button>)}
              <select value={repoBucket} onChange={(e) => setRepoBucket(e.target.value)} className="h-7 bg-white border border-gray-200 rounded-lg px-1.5 ml-auto"><option value="">Any bucket</option>{buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </div>
            <input value={repoQuery} onChange={(e) => setRepoQuery(e.target.value)} placeholder="Search titles and tags" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />

            <div className="space-y-2">
              {groups.map((g) => {
                const notes = g.list.filter((i) => fmtOf(i) === 'note').length, longs = g.list.length - notes
                const open = effectiveOpen === g.id
                if (g.id === 'none' && !g.list.length) return null
                return (
                  <div key={g.id} className="rounded-xl border border-gray-100 bg-white/60">
                    <button onClick={() => setOpenSeries(open ? null : g.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                      {g.logo ? <img src={g.logo} alt="" className="h-7 w-7 rounded-lg object-cover border border-orange-100" /> : <span className="h-7 w-7 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center">{g.name[0]}</span>}
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{g.name}</span><span className="block text-[11px] text-gray-500">{notes} note{notes === 1 ? '' : 's'} · {longs} longform</span></span>
                      <span className={`text-sm font-bold ${g.list.length ? 'text-orange-600' : 'text-gray-300'}`}>{g.list.length}</span>
                      <span className="text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
                    </button>
                    {open && <div className="px-2.5 pb-2.5 space-y-2">{g.list.length ? g.list.map((it) => <RepoCard key={it.id} it={it} />) : <p className="text-xs text-gray-400 px-1 py-2">Nothing waiting in {g.name}.</p>}</div>}
                  </div>
                )
              })}
            </div>
            {repo.length === 0 && <p className="text-xs text-gray-400 text-center pt-2">Everything is placed, or nothing matches. Write in Compose and use <strong>File under Substack</strong>, or press + Note.</p>}
          </aside>

          {/* ---------- week ---------- */}
          <section className="sq-card p-4 md:p-5 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="sq-tool h-9 w-9 rounded-full text-lg" aria-label="Previous week">‹</button>
                <button onClick={() => setWeekStart(mondayOf(new Date()))} className="sq-tool h-9 px-3 rounded-full text-sm font-medium">Today</button>
                <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="sq-tool h-9 w-9 rounded-full text-lg" aria-label="Next week">›</button>
              </div>
              <h3 className="text-lg font-bold">{rangeTitle}</h3>
              <span className="flex-1" />
              <div className="flex gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-900">Notes <strong className={placedThisWeek('note') >= CADENCE.note ? 'text-emerald-600' : ''}>{placedThisWeek('note')}/{CADENCE.note}</strong></span>
                <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-900">Longform <strong className={placedThisWeek('longform') >= CADENCE.longform ? 'text-emerald-600' : ''}>{placedThisWeek('longform')}/{CADENCE.longform}</strong></span>
              </div>
              <button onClick={() => confirm('Create 14 Note placeholders and 2 Longform placeholders on the calendar over the next two weeks?') && run(p.onPlan)} disabled={busy} className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">{busy ? 'Planning…' : 'Plan 2 weeks'}</button>
            </div>

            <div className="overflow-x-auto sq-scroll">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2 mb-2">
                  <div />
                  {days.map((d) => { const dt = parse(d); const isToday = d === todayKey; return (
                    <div key={d} className={`rounded-xl text-center py-2 ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      <div className="text-[10px] uppercase font-semibold tracking-wide">{dt.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-xl font-extrabold leading-none">{dt.getDate()}</div>
                      <div className="text-[10px] opacity-80">{dt.toLocaleDateString(undefined, { month: 'short' })}</div>
                    </div>
                  ) })}
                </div>
                {(['note', 'longform'] as Format[]).map((f) => (
                  <div key={f} className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2 mb-2">
                    <div className="pt-2"><p className="text-xs font-bold">{FORMAT_LABEL[f]}s</p><p className="text-[10px] text-gray-400">{f === 'note' ? 'discovery' : 'consideration'}</p></div>
                    {days.map((d) => <Cell key={d} day={d} f={f} />)}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-gray-400">Drag cards from the repository onto a day. Notes go in the Notes row, longform in the Longform row. Drag a placed card to another day, or back to the repository. Click an empty cell to start a new post for that date.</p>
          </section>
        </div>
      </div>
    )
  }

  // ---------------- LIBRARY ----------------
  const listItems = (() => {
    let list = mine
    if (sel.kind === 'series') list = list.filter((i) => i.series_id === sel.id)
    if (sel.kind === 'bucket') list = list.filter((i) => i.bucket_id === sel.id)
    if (formatF !== 'all') list = list.filter((i) => fmtOf(i) === formatF)
    if (stageF !== 'all') list = list.filter((i) => stageOf(i) === stageF)
    if (crossF) list = list.filter((i) => (sel.kind === 'series' ? i.bucket_id : i.series_id) === crossF)
    return [...list].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  })()
  const pick = (s: Sel) => { setSel(s); setFormatF('all'); setStageF('all'); setCrossF('') }
  const active = (s: Sel) => JSON.stringify(sel) === JSON.stringify(s)
  const navBtn = (s: Sel, lbl: React.ReactNode, sub?: string) => (
    <button key={JSON.stringify(s)} onClick={() => pick(s)} className={`w-full text-left rounded-lg px-3 py-2 transition ${active(s) ? 'bg-orange-100 text-orange-900' : 'hover:bg-white/80 text-gray-800'}`}>
      <span className="block text-sm font-medium">{lbl}</span>{sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
    </button>
  )
  const selSeries = sel.kind === 'series' ? series.find((x) => x.id === sel.id) : undefined
  const selBucket = sel.kind === 'bucket' ? buckets.find((x) => x.id === sel.id) : undefined
  const selected = (selSeries || selBucket) as (Series | Bucket) | undefined
  const crossOptions = sel.kind === 'series' ? buckets : sel.kind === 'bucket' ? series : []

  const Row = ({ it }: { it: Item }) => {
    const st = stageOf(it)
    return (
      <div className="sq-card p-4 flex gap-3 items-start">
        <div className="shrink-0 flex flex-col gap-1.5 items-start w-24">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-900 text-white">{FORMAT_LABEL[fmtOf(it)]}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STAGE_STYLE[st]}`}>{st}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{label(it)}</p>
          {it.hook && it.title && <p className="text-sm text-gray-600 italic mt-0.5">“{it.hook}”</p>}
          <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
            {nameOf(series, it.series_id) && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-800">{nameOf(series, it.series_id)}</span>}
            {nameOf(buckets, it.bucket_id) && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800">{nameOf(buckets, it.bucket_id)}</span>}
            {(it.tags || []).map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">#{t}</span>)}
            {it.planned_for && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">📅 {prettyDate(it.planned_for)}</span>}
            <span className="text-gray-400 py-0.5">{timeAgo(it.updated_at)}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <button onClick={() => p.onOpen(it)} className="text-xs px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-700">Open</button>
          {st === 'published'
            ? <button onClick={() => p.onRepurpose(it)} className="text-xs px-2.5 py-1 rounded-lg text-indigo-700 hover:bg-indigo-50">Repurpose</button>
            : <button onClick={() => p.onMarkPublished(it)} className="text-xs px-2.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50">Mark published</button>}
          <button onClick={() => confirm('Delete this post?') && p.onDelete(it)} className="text-xs px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50">Delete</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sq-fade-in">
      {Header}
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <nav className="sq-card p-3 self-start lg:sticky lg:top-6 space-y-1">
          {navBtn({ kind: 'all' }, 'All posts', countText(mine))}
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Series</p>
          {series.map((s) => navBtn({ kind: 'series', id: s.id }, <span className="flex items-center gap-2">{s.logo_url && <img src={s.logo_url} alt="" className="h-5 w-5 rounded object-cover border border-orange-100" />}{s.name}</span>, countText(mine.filter((i) => i.series_id === s.id))))}
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Buckets</p>
          {buckets.map((b) => navBtn({ kind: 'bucket', id: b.id }, b.name, countText(mine.filter((i) => i.bucket_id === b.id))))}
        </nav>
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            {selSeries && <LogoPicker url={selSeries.logo_url} size={64} label="series" onPick={(f) => p.onLogo('series', selSeries.id, f)} onClear={() => p.onLogo('series', selSeries.id, null)} />}
            <div className="mr-auto min-w-0 flex-1">
              {selected ? (
                <>
                  <Inline value={selected.name} onSave={(name) => p.onRename(sel.kind === 'series' ? 'series' : 'buckets', selected.id, { name })} className="text-xl font-bold block w-full" />
                  <Inline value={selected.description || ''} placeholder="Add a description" onSave={(description) => p.onRename(sel.kind === 'series' ? 'series' : 'buckets', selected.id, { description })} className="text-sm text-gray-600 block w-full" />
                </>
              ) : <h2 className="text-xl font-bold">All posts</h2>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => p.onNew('note', { seriesId: selSeries?.id ?? null, bucketId: selBucket?.id ?? null })} className="text-sm px-3 py-2 rounded-lg bg-orange-100 text-orange-900 hover:bg-orange-200 font-medium">+ New Note</button>
              <button onClick={() => p.onNew('longform', { seriesId: selSeries?.id ?? null, bucketId: selBucket?.id ?? null })} className="text-sm px-3 py-2 rounded-lg bg-[#ff6719] text-white hover:brightness-95 font-medium">+ New Longform</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(['all', 'note', 'longform'] as const).map((f) => <button key={f} onClick={() => setFormatF(f)} className={`px-2.5 py-1 rounded-full border ${formatF === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{f === 'all' ? 'All formats' : FORMAT_LABEL[f] + 's'}</button>)}
            <span className="h-4 w-px bg-gray-200 mx-1" />
            {(['all', ...STAGES] as const).map((st) => <button key={st} onClick={() => setStageF(st)} className={`px-2.5 py-1 rounded-full border capitalize ${stageF === st ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{st === 'all' ? 'Any stage' : st}</button>)}
            {crossOptions.length > 0 && (
              <select value={crossF} onChange={(e) => setCrossF(e.target.value)} className="ml-auto h-8 bg-white border border-gray-200 rounded-lg px-2 text-xs">
                <option value="">{sel.kind === 'series' ? 'Any bucket' : 'Any series'}</option>
                {crossOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>
          {listItems.length === 0
            ? <div className="sq-card p-8 text-center text-sm text-gray-500">Nothing here yet. Start with a <strong>+ New Note</strong> or <strong>+ New Longform</strong>.</div>
            : <div className="space-y-2.5">{listItems.map((it) => <Row key={it.id} it={it} />)}</div>}
        </section>
      </div>
    </div>
  )
}
