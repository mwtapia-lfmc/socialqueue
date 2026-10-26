'use client'

import { seriesColor } from '../lib/seriesColor'

import { useMemo, useState } from 'react'
import { formatTime, timeAgo } from '../lib/text'
import { cadenceOf, EMOJI_CHOICES, FORMAT_LABEL, STAGES, STAGE_STYLE, STRUCTURE_SQL, isPlaceholder, itemTags, seriesEmoji, shortDate, stageOf, tagRegistry, weekDates, weekOfYear, weekYear, weeksInYear, ymd, type Format, type Series, type Stage, type StructureData, type TagInfo } from '../lib/structure'
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
  onClearPlaceholders: (ids: string[]) => Promise<void>
  onCadence: (patch: { notes_per_week?: number; longform_per_week?: number }) => Promise<void>
  onPlace: (item: Item, date: string | null, time?: string | null) => Promise<void>
  onNewSeries: (name: string) => Promise<Series | null>
  onEmoji: (kind: 'series' | 'tag', ref: string, emoji: string) => Promise<void>
}

type Sel = { kind: 'all' } | { kind: 'series'; id: string } | { kind: 'tag'; key: string }

const fmtOf = (i: Item): Format => (i.format as Format) || (i.kind === 'blog' ? 'longform' : 'note')
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

function EmojiBtn({ emoji, onPick, size = 'text-lg' }: { emoji: string; onPick: (e: string) => void; size?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)} title="Change emoji" className={`cursor-pointer hover:bg-orange-100 rounded-md px-0.5 ${size}`}>{emoji}</span>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <span className="absolute left-0 top-full mt-1 z-50 grid grid-cols-8 gap-1 p-2 rounded-xl bg-white border border-gray-200 shadow-xl w-[272px]" onClick={(e) => e.stopPropagation()}>
            {EMOJI_CHOICES.map((em) => <button key={em} type="button" onClick={() => { onPick(em); setOpen(false) }} className="h-8 w-8 rounded-lg hover:bg-orange-100 text-lg">{em}</button>)}
          </span>
        </>
      )}
    </span>
  )
}

function GoalEdit({ placed, target, onSave }: { placed: number; target: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(String(target))
  if (!editing) {
    return <span role="button" tabIndex={0} title="Click to change the weekly goal (applies to every week)" onClick={(e) => { e.stopPropagation(); setV(String(target)); setEditing(true) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setV(String(target)); setEditing(true) } }} className="cursor-pointer underline decoration-dotted underline-offset-2 hover:bg-orange-100 rounded px-0.5">{placed}/{target}</span>
  }
  const commit = () => { setEditing(false); const n = parseInt(v, 10); if (!Number.isNaN(n)) { const c = Math.max(0, Math.min(21, n)); if (c !== target) onSave(c) } }
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center">{placed}/
      <input autoFocus onFocus={(e) => e.target.select()} type="number" min={0} max={21} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} className="w-11 h-6 ml-0.5 px-1 text-center text-xs font-bold rounded border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200 bg-white" />
    </span>
  )
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
  const todayWeek = weekOfYear(new Date())
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([weekOfYear(new Date())]))
  const [showPast, setShowPast] = useState(false)
  const [addingSeries, setAddingSeries] = useState(false)
  const [seriesName, setSeriesName] = useState('')
  const [openKey, setOpenKey] = useState<string | null | undefined>(undefined)
  const [repoFormat, setRepoFormat] = useState<Format>('note')
  const [innerTag, setInnerTag] = useState('')
  const [repoQuery, setRepoQuery] = useState('')
  const [renameKey, setRenameKey] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const mine = useMemo(() => (data ? items.filter((i) => (i.publication_id === data.publication.id || !i.publication_id) && !isPlaceholder(i)) : []), [items, data])
  const placeholders = useMemo(() => (data ? items.filter((i) => i.publication_id === data.publication.id && isPlaceholder(i)) : []), [items, data])
  const toggleWeek = (n: number) => setExpanded((cur) => { const x = new Set(cur); x.has(n) ? x.delete(n) : x.add(n); return x })
  const makeSeries = async () => {
    const name = seriesName.trim(); if (!name) return
    const made = await p.onNewSeries(name)
    setSeriesName(''); setAddingSeries(false)
    if (made) { setOpenKey('series:' + made.id); setSel({ kind: 'series', id: made.id }) }
  }
  const NewSeriesBox = (
    addingSeries
      ? <span className="flex items-center gap-1.5">
          <input autoFocus value={seriesName} onChange={(e) => setSeriesName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') makeSeries(); if (e.key === 'Escape') setAddingSeries(false) }} placeholder="Series name" className="h-7 w-32 px-2 text-xs rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200 normal-case font-normal" />
          <button onClick={makeSeries} className="text-[11px] px-2 py-1 rounded-md bg-[#ff6719] text-white normal-case font-medium">Add</button>
        </span>
      : <button onClick={() => setAddingSeries(true)} className="text-[11px] px-2 py-1 rounded-md bg-orange-100 text-orange-900 hover:bg-orange-200 normal-case font-medium">+ New series</button>
  )
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
  const cad = cadenceOf(publication)
  const registry = tagRegistry(buckets, mine)
  const tagInfo = (k: string) => registry.find((t) => t.key === k)

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

  const Banner = placeholders.length > 0 ? (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span>🧹 <strong>{placeholders.length}</strong> empty placeholder slot{placeholders.length > 1 ? 's' : ''} from the old Plan 2 weeks button {placeholders.length > 1 ? 'are' : 'is'} hidden. None of your writing is in them.</span>
      <button onClick={() => confirm(`Permanently delete ${placeholders.length} empty placeholder slot${placeholders.length > 1 ? 's' : ''}? Anything with text, a hook, or a real title is kept.`) && run(() => p.onClearPlaceholders(placeholders.map((i) => i.id)))} disabled={busy} className="ml-auto px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50">{busy ? 'Deleting…' : `Delete ${placeholders.length}`}</button>
    </div>
  ) : null

  // ---------------- PLANNER ----------------
  if (mode === 'planner') {
    const year = weekYear(new Date())
    const lastWeek = weeksInYear(year)
    const placedDate = (i: Item) => i.planned_for || (stageOf(i) === 'published' && i.published_at ? ymd(new Date(i.published_at)) : null) || (stageOf(i) === 'scheduled' ? i.schedule_date || null : null)
    const inCell = (day: string, f: Format) => mine.filter((i) => placedDate(i) === day && fmtOf(i) === f).sort((a, b) => (a.planned_time || a.schedule_time || '99').localeCompare(b.planned_time || b.schedule_time || '99'))
    const countIn = (days: string[], f: Format) => days.reduce((n, d) => n + inCell(d, f).length, 0)

    const repo = mine.filter((i) => !placedDate(i) && stageOf(i) !== 'published' && fmtOf(i) === repoFormat
      && (!repoQuery.trim() || `${label(i)} ${(i.tags || []).join(' ')}`.toLowerCase().includes(repoQuery.trim().toLowerCase())))
    type Group = { key: string; kind: 'series' | 'tag'; ref: string; emoji: string; name: string; logo?: string | null; list: Item[] }
    const seriesGroups: Group[] = [
      ...series.map((x) => ({ key: 'series:' + x.id, kind: 'series' as const, ref: x.id, emoji: seriesEmoji(x), name: x.name, logo: x.logo_url, list: repo.filter((i) => i.series_id === x.id) })),
      { key: 'series:none', kind: 'series' as const, ref: 'none', emoji: '📂', name: 'No series', logo: null, list: repo.filter((i) => !i.series_id || !series.some((x) => x.id === i.series_id)) },
    ].filter((g) => g.ref !== 'none' || g.list.length)
    const tagGroups: Group[] = registry.map((t) => ({ key: 'tag:' + t.key, kind: 'tag' as const, ref: t.key, emoji: t.emoji, name: t.name, list: repo.filter((i) => itemTags(i, buckets).includes(t.key)) })).filter((g) => g.list.length)
    const firstOpen = [...seriesGroups, ...tagGroups].find((g) => g.list.length)?.key ?? null
    const effectiveOpen = openKey === undefined ? firstOpen : openKey
    const openSeriesId = effectiveOpen?.startsWith('series:') && effectiveOpen !== 'series:none' ? effectiveOpen.slice(7) : null
    const dragged = dragId ? mine.find((i) => i.id === dragId) : undefined

    const drop = (day: string | null, cellFormat?: Format) => {
      const it = dragged; setDragId(null); setOverKey(null)
      if (!it || stageOf(it) === 'published') return
      if (day && cellFormat && fmtOf(it) !== cellFormat) return
      if (day === null && (!it.planned_for || stageOf(it) === 'scheduled')) return
      p.onPlace(it, day)
    }
    const dragProps = (it: Item) => stageOf(it) === 'published' ? {} : {
      draggable: true,
      onDragStart: (e: React.DragEvent) => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id) },
      onDragEnd: () => { setDragId(null); setOverKey(null) },
    }

    const RepoCard = ({ it }: { it: Item }) => (
      <div {...dragProps(it)} onClick={() => p.onOpen(it)} title="Click to open and edit" className={`rounded-xl border border-gray-200 bg-white px-2.5 py-2 space-y-1 cursor-pointer hover:border-orange-300 hover:shadow-sm transition ${dragId === it.id ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2">
          <span className="text-gray-300 text-xs leading-5 select-none">⋮⋮</span>
          <p className="text-[13px] leading-snug font-medium line-clamp-2 flex-1">{label(it)}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STAGE_STYLE[stageOf(it)]}`}>{stageOf(it)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10px] pl-4">
          {itemTags(it, buckets).map((k) => <span key={k} className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{tagInfo(k)?.emoji} {k}</span>)}
          <span className="ml-auto flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); p.onOpen(it) }} className="text-indigo-600 hover:underline">Edit</button>
            <label onClick={(e) => e.stopPropagation()} className="relative text-indigo-600 hover:underline cursor-pointer" title="Place on a date (works on phones too)">📅 place
              <input type="date" value="" onChange={(e) => e.target.value && p.onPlace(it, e.target.value)} className="absolute inset-0 opacity-0 w-full cursor-pointer" aria-label="Place on date" />
            </label>
          </span>
        </div>
      </div>
    )

    const renderGroup = (g: Group) => {
      const open = effectiveOpen === g.key
      const visible = g.kind === 'series' && innerTag ? g.list.filter((i) => itemTags(i, buckets).includes(innerTag)) : g.list
      const innerTags = g.kind === 'series' ? [...new Set(g.list.flatMap((i) => itemTags(i, buckets)))] : []
      const sc = g.kind === 'series' ? seriesColor(series.find((x) => x.id === g.ref)) : null
      return (
        <div key={g.key} className="rounded-xl border-2 overflow-hidden" style={sc ? { background: sc.bg, borderColor: open ? sc.solid : sc.border } : { background: 'rgba(255,255,255,0.6)', borderColor: '#f3f4f6' }}>
          <div onClick={() => { setOpenKey(open ? null : g.key); setInnerTag('') }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenKey(open ? null : g.key)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer" style={sc ? { color: sc.text } : undefined}>
            {g.logo ? <img src={g.logo} alt="" className="h-7 w-7 rounded-lg object-cover border border-orange-100" /> : null}
            <EmojiBtn emoji={g.emoji} onPick={(em) => p.onEmoji(g.kind, g.ref, em)} />
            {renameKey === g.key && g.kind === 'series' ? (
              <input autoFocus defaultValue={g.name} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { const v = e.target.value.trim(); setRenameKey(null); if (v && v !== g.name) p.onRename('series', g.ref, { name: v }) }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenameKey(null) }}
                className="min-w-0 flex-1 text-sm font-semibold border border-orange-300 rounded px-1 focus:outline-none focus:ring-2 focus:ring-orange-200" />
            ) : (
              <span onDoubleClick={g.kind === 'series' ? (e) => { e.stopPropagation(); setRenameKey(g.key) } : undefined} title={g.kind === 'series' ? 'Double-click to rename' : undefined} className="min-w-0 flex-1 text-sm font-semibold truncate">{g.kind === 'tag' ? '#' : ''}{g.name}</span>
            )}
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={sc ? { background: g.list.length ? sc.solid : '#e5e7eb', color: g.list.length ? 'white' : '#9ca3af' } : { color: g.list.length ? '#ea580c' : '#d1d5db' }}>{g.list.length}</span>
            <span className="text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
          </div>
          {open && (
            <div className="px-2.5 pb-2.5 space-y-2">
              {innerTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pb-0.5">
                  {innerTags.map((k) => <button key={k} onClick={() => setInnerTag(innerTag === k ? '' : k)} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${innerTag === k ? 'bg-orange-200 border-orange-300 text-orange-900' : 'bg-white border-gray-200 text-gray-500'}`}>{tagInfo(k)?.emoji} {k}</button>)}
                </div>
              )}
              {visible.length ? visible.map((it) => <RepoCard key={it.id} it={it} />) : <p className="text-xs text-gray-400 px-1 py-2">Nothing waiting here.</p>}
            </div>
          )}
        </div>
      )
    }

    const freeDay = (days: string[], f: Format) => days.find((d) => d >= todayKey && inCell(d, f).length === 0) ?? days.find((d) => inCell(d, f).length === 0) ?? days[0]

    const PlacedCard = ({ it }: { it: Item }) => {
      const st = stageOf(it)
      return (
        <div {...dragProps(it)} className={`group relative rounded-lg border px-2 py-1.5 text-left ${st === 'published' ? 'border-emerald-200 bg-emerald-50' : st === 'scheduled' ? 'border-blue-200 bg-blue-50 cursor-grab active:cursor-grabbing' : 'border-orange-200 bg-orange-50 cursor-grab active:cursor-grabbing'} ${dragId === it.id ? 'opacity-40' : ''}`}>
          {st !== 'published'
            ? <label className={`flex items-center gap-1 text-[11px] font-semibold mb-0.5 cursor-pointer ${st === 'scheduled' ? 'text-blue-900' : 'text-orange-900'}`} title="Set the time">{st === 'scheduled' ? '🚀' : '🕘'}<input type="time" value={(it.planned_time || it.schedule_time || '').slice(0, 5)} onChange={(e) => e.target.value && p.onPlace(it, placedDate(it), e.target.value)} className="bg-transparent w-[96px] text-[11px] font-semibold" /></label>
            : it.published_at && <span className="block text-[11px] font-semibold text-emerald-800 mb-0.5">🕘 {new Date(it.published_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
          <button onClick={() => p.onOpen(it)} className="block w-full text-left" title="Click to open and edit">
            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full mb-0.5 ${STAGE_STYLE[st]}`}>{st}</span>
            <span className="block text-[12px] leading-snug line-clamp-3 hover:text-indigo-700">{label(it)}</span>
            {nameOf(series, it.series_id) && <span className="block text-[10px] text-orange-800/70 mt-0.5 truncate">{nameOf(series, it.series_id)}</span>}
          </button>
          {st === 'idea' || st === 'drafting' ? <button onClick={() => p.onPlace(it, null)} title="Back to repository" className="absolute top-1 right-1 h-4 w-4 rounded-full bg-white border border-gray-200 text-gray-400 text-[10px] leading-none opacity-0 group-hover:opacity-100 hover:text-red-600">×</button> : null}
        </div>
      )
    }

    // A day cell is invisible when empty. It only shows a drop target while you drag a matching card, or a + on hover.
    const DayCell = ({ day, f }: { day: string; f: Format }) => {
      const list = inCell(day, f)
      const key = `${day}:${f}`
      const canDrop = !!dragged && fmtOf(dragged) === f
      const over = overKey === key && canDrop
      return (
        <div onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOverKey(key) } }} onDragLeave={() => setOverKey((k) => (k === key ? null : k))} onDrop={(e) => { e.preventDefault(); drop(day, f) }}
          className={`group/cell rounded-xl p-1 min-h-[44px] space-y-1.5 transition ${over ? 'bg-orange-100 ring-2 ring-orange-400' : canDrop ? 'border border-dashed border-orange-300 bg-orange-50/40' : day === todayKey ? 'bg-indigo-50/40' : ''}`}>
          {list.map((it) => <PlacedCard key={it.id} it={it} />)}
          {!dragged && (
            <button onClick={() => p.onNew(f, { plannedFor: day, seriesId: openSeriesId })} className="block w-full text-left px-1 text-[10px] text-gray-400 hover:text-orange-600 transition" aria-label={`Add a ${FORMAT_LABEL[f]} on ${day}`}>+ add</button>
          )}
        </div>
      )
    }

    const DayRow = ({ f, days }: { f: Format; days: string[] }) => {
      const placed = days.reduce((n, d) => n + inCell(d, f).length, 0)
      const target = cad[f]
      if (placed === 0 && target === 0) return null
      const cols = `84px repeat(${days.length}, minmax(0, 1fr))`
      return (
        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: cols }}>
          <div className="pt-1">
            <p className="text-[11px] font-bold leading-tight">{f === 'note' ? 'Posts / Notes' : 'Longform'}</p>
            <p className="text-[10px] text-gray-400 leading-tight">{f === 'longform' ? 'article or video' : 'short-form'}</p>
          </div>
          {days.map((d) => <DayCell key={d} day={d} f={f} />)}
        </div>
      )
    }

    return (
      <div className="sq-fade-in">
        {Header}
        {Banner}
        <div className="grid xl:grid-cols-[380px_1fr] gap-5 items-start">
          {/* ---------- repository ---------- */}
          <aside onDragOver={(e) => { if (dragged?.planned_for) { e.preventDefault(); setOverKey('repo') } }} onDragLeave={() => setOverKey((k) => (k === 'repo' ? null : k))} onDrop={(e) => { e.preventDefault(); drop(null) }}
            className={`sq-card p-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto sq-scroll space-y-3 ${overKey === 'repo' ? 'ring-2 ring-orange-300' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="mr-auto"><h3 className="font-bold">Repository</h3><p className="text-[11px] text-gray-500">Drag a title onto a day →</p></div>
              <button onClick={() => p.onNew(repoFormat, { seriesId: openSeriesId })} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#ff6719] text-white hover:brightness-95 font-medium">+ New {FORMAT_LABEL[repoFormat]}</button>
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
              {(['note', 'longform'] as const).map((f) => <button key={f} onClick={() => { setRepoFormat(f); setOpenKey(undefined); setInnerTag('') }} className={`flex-1 sq-tab px-3 py-1.5 rounded-full text-xs font-semibold ${repoFormat === f ? 'sq-tab-active' : 'text-gray-600'}`}>{f === 'note' ? '🗒 Posts / Notes' : '📰 Longform / Articles'}</button>)}
            </div>
            <input value={repoQuery} onChange={(e) => setRepoQuery(e.target.value)} placeholder="Search titles and tags" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />

            <div className="px-1 pt-1 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Series</p>{NewSeriesBox}</div>
            <div className="space-y-2">{seriesGroups.map(renderGroup)}</div>
            <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Buckets <span className="normal-case font-normal">· tags create these</span></p>
            <div className="space-y-2">{tagGroups.length ? tagGroups.map(renderGroup) : <p className="text-xs text-gray-400 px-1">No tagged {repoFormat === 'note' ? 'notes' : 'longform'} waiting. Add tags in the composer.</p>}</div>
            {repo.length === 0 && <p className="text-xs text-gray-400 text-center pt-2">Nothing waiting. Compose a {repoFormat === 'note' ? 'Note' : 'Longform'} in Compose, or press + New.</p>}
          </aside>

          {/* ---------- weeks: one tile each, current week first ---------- */}
          <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3 px-1">
              <div className="mr-auto" />
              {todayWeek > 1 && <button onClick={() => setShowPast((v) => !v)} className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">{showPast ? 'Hide earlier weeks' : `Show earlier weeks (${todayWeek - 1})`}</button>}
            </div>

            {Array.from({ length: lastWeek - (showPast ? 1 : todayWeek) + 1 }, (_, i) => (showPast ? 1 : todayWeek) + i).map((n) => {
              const days = weekDates(year, n)
              const open = expanded.has(n)
              const isNow = n === todayWeek
              const notes = countIn(days, 'note'), longs = countIn(days, 'longform')
              const cols = `64px repeat(${days.length}, minmax(0, 1fr))`
              return (
                <div key={n} onDragOver={(e) => { if (dragged && !open) { e.preventDefault(); toggleWeek(n) } }}
                  className={`rounded-2xl border bg-white/80 backdrop-blur ${isNow ? 'border-indigo-300 shadow-sm' : 'border-gray-200'}`}>
                  <button onClick={() => toggleWeek(n)} className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
                    <span className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${isNow ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Week {n}</span>
                    <span className="text-sm text-gray-600">{shortDate(days[0])} – {shortDate(days[days.length - 1])}</span>
                    {isNow && <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">this week</span>}
                    <span className="flex-1" />
                    <span className="hidden sm:flex gap-1">{days.map((d) => { const c = inCell(d, 'note').length + inCell(d, 'longform').length; return <span key={d} title={`${prettyDate(d)}: ${c}`} className={`h-2.5 w-2.5 rounded-sm ${c ? 'bg-orange-400' : 'bg-gray-200'}`} /> })}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-900">Notes <strong className={notes >= cad.note ? 'text-emerald-600' : ''}><GoalEdit placed={notes} target={cad.note} onSave={(n) => p.onCadence({ notes_per_week: n })} /></strong></span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-900">Longform <strong className={longs >= cad.longform ? 'text-emerald-600' : ''}><GoalEdit placed={longs} target={cad.longform} onSave={(n) => p.onCadence({ longform_per_week: n })} /></strong></span>
                    <span className="text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 overflow-x-auto sq-scroll">
                      <div className="min-w-[860px]">
                        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `84px repeat(${days.length}, minmax(0, 1fr))` }}>
                          <div />
                          {days.map((d) => { const dt = parse(d); const isToday = d === todayKey; return (
                            <div key={d} className={`rounded-lg text-center py-1 text-[11px] font-semibold ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                              {dt.toLocaleDateString(undefined, { weekday: 'short' })} {dt.getDate()}<span className="font-normal opacity-70"> {dt.toLocaleDateString(undefined, { month: 'short' })}</span>
                            </div>
                          ) })}
                        </div>
                        <DayRow f="note" days={days} />
                        <DayRow f="longform" days={days} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <p className="text-[11px] text-gray-400 px-1">One tile per week. Drag a card to another day to change its publish day, or from the repository onto a day. Use + add under any day to start something there. Set a time on any card. Everything here also shows on the Calendar.</p>
          </section>
        </div>
      </div>
    )
  }

  // ---------------- LIBRARY ----------------
  const listItems = (() => {
    let list = mine
    if (sel.kind === 'series') list = list.filter((i) => i.series_id === sel.id)
    if (sel.kind === 'tag') list = list.filter((i) => itemTags(i, buckets).includes(sel.key))
    if (formatF !== 'all') list = list.filter((i) => fmtOf(i) === formatF)
    if (stageF !== 'all') list = list.filter((i) => stageOf(i) === stageF)
    if (crossF) list = list.filter((i) => (sel.kind === 'series' ? itemTags(i, buckets).includes(crossF) : i.series_id === crossF))
    return [...list].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  })()
  const pick = (x: Sel) => { setSel(x); setFormatF('all'); setStageF('all'); setCrossF('') }
  const active = (x: Sel) => JSON.stringify(sel) === JSON.stringify(x)
  const navBtn = (x: Sel, lbl: React.ReactNode, sub?: string) => (
    <div key={JSON.stringify(x)} role="button" tabIndex={0} onClick={() => pick(x)} onKeyDown={(e) => e.key === 'Enter' && pick(x)} className={`w-full text-left rounded-lg px-3 py-2 transition cursor-pointer ${active(x) ? 'bg-orange-100 text-orange-900' : 'hover:bg-white/80 text-gray-800'}`}>
      <span className="block text-sm font-medium">{lbl}</span>{sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
    </div>
  )
  const selSeries: Series | undefined = sel.kind === 'series' ? series.find((x) => x.id === sel.id) : undefined
  const selTag: TagInfo | undefined = sel.kind === 'tag' ? registry.find((t) => t.key === sel.key) : undefined
  const crossOptions: { id: string; name: string }[] = sel.kind === 'series' ? registry.filter((t) => t.count).map((t) => ({ id: t.key, name: `${t.emoji} ${t.name}` })) : sel.kind === 'tag' ? series.map((x) => ({ id: x.id, name: `${seriesEmoji(x)} ${x.name}` })) : []

  const Row = ({ it }: { it: Item }) => {
    const st = stageOf(it)
    return (
      <div className="sq-card p-4 flex gap-3 items-start">
        <div className="shrink-0 flex flex-col gap-1.5 items-start w-24">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-900 text-white">{FORMAT_LABEL[fmtOf(it)]}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STAGE_STYLE[st]}`}>{st}</span>
        </div>
        <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => p.onOpen(it)} onKeyDown={(e) => e.key === 'Enter' && p.onOpen(it)} title="Click to open and edit">
          <p className="font-semibold leading-snug hover:text-indigo-700">{label(it)}</p>
          {it.hook && it.title && <p className="text-sm text-gray-600 italic mt-0.5">“{it.hook}”</p>}
          <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
            {nameOf(series, it.series_id) && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-800">{seriesEmoji(series.find((x) => x.id === it.series_id)!)} {nameOf(series, it.series_id)}</span>}
            {itemTags(it, buckets).map((k) => <span key={k} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{tagInfo(k)?.emoji} #{k}</span>)}
            {it.planned_for && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">📅 {prettyDate(it.planned_for)}</span>}
            <span className="text-gray-400 py-0.5">{timeAgo(it.updated_at)}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <button onClick={() => p.onOpen(it)} className="text-xs px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-700">Edit</button>
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
      {Banner}
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <nav className="sq-card p-3 self-start lg:sticky lg:top-6 space-y-1">
          {navBtn({ kind: 'all' }, '🗂 All posts', countText(mine))}
          <div className="px-3 pt-3 pb-1 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Series</p>{NewSeriesBox}</div>
          {series.map((x) => navBtn({ kind: 'series', id: x.id }, <span className="flex items-center gap-2">{x.logo_url ? <img src={x.logo_url} alt="" className="h-5 w-5 rounded object-cover border border-orange-100" /> : null}<span>{seriesEmoji(x)}</span>{x.name}</span>, countText(mine.filter((i) => i.series_id === x.id))))}
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Buckets <span className="normal-case font-normal">· tags</span></p>
          {registry.map((t) => navBtn({ kind: 'tag', key: t.key }, <span className="flex items-center gap-2"><span>{t.emoji}</span>#{t.name}</span>, t.count ? countText(mine.filter((i) => itemTags(i, buckets).includes(t.key))) : 'unused'))}
        </nav>
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            {selSeries && <LogoPicker url={selSeries.logo_url} size={64} label="series" onPick={(f) => p.onLogo('series', selSeries.id, f)} onClear={() => p.onLogo('series', selSeries.id, null)} />}
            <div className="mr-auto min-w-0 flex-1">
              {selSeries ? (
                <>
                  <div className="flex items-center gap-2"><EmojiBtn emoji={seriesEmoji(selSeries)} size="text-2xl" onPick={(em) => p.onEmoji('series', selSeries.id, em)} />
                    <Inline value={selSeries.name} onSave={(name) => p.onRename('series', selSeries.id, { name })} className="text-xl font-bold block w-full" /></div>
                  <Inline value={selSeries.description || ''} placeholder="Add a description" onSave={(description) => p.onRename('series', selSeries.id, { description })} className="text-sm text-gray-600 block w-full" />
                </>
              ) : selTag ? (
                <div className="flex items-center gap-2"><EmojiBtn emoji={selTag.emoji} size="text-2xl" onPick={(em) => p.onEmoji('tag', selTag.key, em)} /><h2 className="text-xl font-bold">#{selTag.name}</h2><span className="text-xs text-gray-400">bucket · created by tagging</span></div>
              ) : <h2 className="text-xl font-bold">All posts</h2>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => p.onNew('note', { seriesId: selSeries?.id ?? null })} className="text-sm px-3 py-2 rounded-lg bg-orange-100 text-orange-900 hover:bg-orange-200 font-medium">+ New Note</button>
              <button onClick={() => p.onNew('longform', { seriesId: selSeries?.id ?? null })} className="text-sm px-3 py-2 rounded-lg bg-[#ff6719] text-white hover:brightness-95 font-medium">+ New Longform</button>
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
