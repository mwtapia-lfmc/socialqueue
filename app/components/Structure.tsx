'use client'

import { useMemo, useState } from 'react'
import { timeAgo } from '../lib/text'
import { CADENCE, FORMAT_LABEL, STAGES, STAGE_STYLE, STRUCTURE_SQL, itemDate, stageOf, weekRange, ymd, type Bucket, type Format, type Series, type Stage, type StructureData } from '../lib/structure'
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
  onNew: (format: Format, ctx: NewCtx) => void
  onOpen: (item: Item) => void
  onRepurpose: (item: Item) => void
  onMarkPublished: (item: Item) => Promise<void>
  onDelete: (item: Item) => Promise<void>
  onPlan: () => Promise<void>
}

type Sel = { kind: 'week' } | { kind: 'all' } | { kind: 'series'; id: string } | { kind: 'bucket'; id: string }

function Inline({ value, onSave, className = '', placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  if (!editing) return <button type="button" onClick={() => { setV(value); setEditing(true) }} title="Click to rename" className={`text-left hover:bg-orange-50 rounded px-1 -mx-1 ${className}`}>{value || <span className="text-gray-300">{placeholder}</span>}</button>
  const commit = () => { setEditing(false); if (v.trim() && v !== value) onSave(v.trim()) }
  return <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} className={`border border-orange-300 rounded px-1 -mx-1 w-full focus:outline-none focus:ring-2 focus:ring-orange-200 ${className}`} />
}

export default function Structure(p: Props) {
  const { state, data, items } = p
  const [sel, setSel] = useState<Sel>({ kind: 'week' })
  const [formatF, setFormatF] = useState<'all' | Format>('all')
  const [stageF, setStageF] = useState<'all' | Stage>('all')
  const [crossF, setCrossF] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const mine = useMemo(() => (data ? items.filter((i) => i.publication_id === data.publication.id) : []), [items, data])
  const countsFor = (list: Item[]) => {
    const c: Record<Stage, number> = { idea: 0, drafting: 0, scheduled: 0, published: 0 }
    for (const it of list) c[stageOf(it)]++
    return c
  }
  const countText = (list: Item[]) => {
    const c = countsFor(list)
    const parts = [c.idea && `${c.idea} idea${c.idea > 1 ? 's' : ''}`, c.drafting && `${c.drafting} drafting`, c.scheduled && `${c.scheduled} scheduled`, c.published && `${c.published} published`].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'empty'
  }
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
        <p className="text-sm text-gray-600">Creates one publication (Media Literacy), four series (Semiotics, Etymology, Media Politics, Consuming Media), four buckets (Inspirational, Topical, Educational, Repurposed), and your eight longform ideas. Everything is renamable afterward.</p>
        <button onClick={() => run(p.onSeed)} disabled={busy} className="sq-btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">{busy ? <span className="sq-pulse">Setting up…</span> : 'Set it up'}</button>
      </div>
    )
  }

  const { publication, series, buckets } = data
  const nameOf = (list: { id: string; name: string }[], id?: string | null) => list.find((x) => x.id === id)?.name
  const wk = weekRange()
  const week = mine.filter((i) => stageOf(i) !== 'idea' && wk.days.includes(itemDate(i)))
  const weekNotes = week.filter((i) => i.format === 'note'); const weekLong = week.filter((i) => i.format === 'longform')

  const listItems = (() => {
    let list = mine
    if (sel.kind === 'series') list = list.filter((i) => i.series_id === sel.id)
    if (sel.kind === 'bucket') list = list.filter((i) => i.bucket_id === sel.id)
    if (formatF !== 'all') list = list.filter((i) => i.format === formatF)
    if (stageF !== 'all') list = list.filter((i) => stageOf(i) === stageF)
    if (crossF) list = list.filter((i) => (sel.kind === 'series' ? i.bucket_id : i.series_id) === crossF)
    return [...list].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  })()

  const pick = (s: Sel) => { setSel(s); setFormatF('all'); setStageF('all'); setCrossF('') }
  const active = (s: Sel) => JSON.stringify(sel) === JSON.stringify(s)
  const navBtn = (s: Sel, label: React.ReactNode, sub?: string) => (
    <button key={JSON.stringify(s)} onClick={() => pick(s)} className={`w-full text-left rounded-lg px-3 py-2 transition ${active(s) ? 'bg-orange-100 text-orange-900' : 'hover:bg-white/80 text-gray-800'}`}>
      <span className="block text-sm font-medium">{label}</span>{sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
    </button>
  )

  const NewButtons = ({ ctx }: { ctx: NewCtx }) => (
    <div className="flex gap-2">
      <button onClick={() => p.onNew('note', ctx)} className="text-sm px-3 py-2 rounded-lg bg-orange-100 text-orange-900 hover:bg-orange-200 font-medium">+ New Note</button>
      <button onClick={() => p.onNew('longform', ctx)} className="text-sm px-3 py-2 rounded-lg bg-[#ff6719] text-white hover:brightness-95 font-medium">+ New Longform</button>
    </div>
  )

  const Row = ({ it }: { it: Item }) => {
    const st = stageOf(it)
    return (
      <div className="sq-card p-4 flex gap-3 items-start">
        <div className="shrink-0 flex flex-col gap-1.5 items-start w-24">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-900 text-white">{FORMAT_LABEL[(it.format as Format) || 'note']}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STAGE_STYLE[st]}`}>{st}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{it.title || it.hook || it.content.split('\n')[0] || <span className="text-gray-300">Untitled</span>}</p>
          {it.hook && it.title && <p className="text-sm text-gray-600 italic mt-0.5">“{it.hook}”</p>}
          <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
            {nameOf(series, it.series_id) && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-800">{nameOf(series, it.series_id)}</span>}
            {nameOf(buckets, it.bucket_id) && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800">{nameOf(buckets, it.bucket_id)}</span>}
            {(it.tags || []).map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">#{t}</span>)}
            {it.planned_for && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">planned {it.planned_for}</span>}
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

  const Slot = ({ it, format }: { it?: Item; format: Format }) => it ? (
    <button onClick={() => p.onOpen(it)} className="text-left rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2 hover:bg-orange-100 transition min-h-14">
      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mb-1 ${STAGE_STYLE[stageOf(it)]}`}>{stageOf(it)}</span>
      <span className="block text-sm leading-snug line-clamp-2">{it.title || it.hook || it.content.split('\n')[0] || 'Untitled'}</span>
    </button>
  ) : (
    <button onClick={() => p.onNew(format, { plannedFor: ymd(new Date()) })} className="rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-orange-400 hover:text-orange-600 transition min-h-14 text-sm">+ {FORMAT_LABEL[format]}</button>
  )

  const slots = (list: Item[], format: Format) => {
    const target = CADENCE[format]
    const filled = [...list].sort((a, b) => itemDate(a).localeCompare(itemDate(b)))
    const empties = Math.max(0, target - filled.length)
    return [...filled.map((it) => <Slot key={it.id} it={it} format={format} />), ...Array.from({ length: empties }, (_, i) => <Slot key={`e${i}`} format={format} />)]
  }

  const plannedIdeas = mine.filter((i) => stageOf(i) === 'idea' && i.planned_for && wk.days.includes(i.planned_for)).sort((a, b) => (a.planned_for || '').localeCompare(b.planned_for || ''))

  const selSeries = sel.kind === 'series' ? series.find((x) => x.id === sel.id) : undefined
  const selBucket = sel.kind === 'bucket' ? buckets.find((x) => x.id === sel.id) : undefined
  const selected = (selSeries || selBucket) as (Series | Bucket) | undefined
  const crossOptions = sel.kind === 'series' ? buckets : sel.kind === 'bucket' ? series : []

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 sq-fade-in">
      <nav className="sq-card p-3 self-start lg:sticky lg:top-6 space-y-1">
        <div className="px-3 pt-1 pb-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#ff6719]">Substack</p><p className="font-bold leading-tight">{publication.name}</p>{publication.year_theme && <p className="text-[11px] text-gray-500">{publication.year_theme}</p>}</div>
        {navBtn({ kind: 'week' }, 'This week', `${weekNotes.length}/${CADENCE.note} Notes · ${weekLong.length}/${CADENCE.longform} Longform`)}
        {navBtn({ kind: 'all' }, 'All posts', countText(mine))}
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Series</p>
        {series.map((s) => navBtn({ kind: 'series', id: s.id }, s.name, countText(mine.filter((i) => i.series_id === s.id))))}
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Buckets</p>
        {buckets.map((b) => navBtn({ kind: 'bucket', id: b.id }, b.name, countText(mine.filter((i) => i.bucket_id === b.id))))}
      </nav>

      <section className="min-w-0 space-y-4">
        {sel.kind === 'week' ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto"><h2 className="text-xl font-bold">This week</h2><p className="text-xs text-gray-500">{wk.start} → {wk.end} · counts drafting, scheduled and published posts</p></div>
              <button onClick={() => confirm('Create 14 Note ideas and 2 Longform ideas over the next two weeks?') && run(p.onPlan)} disabled={busy} className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">{busy ? 'Planning…' : 'Plan 2 weeks'}</button>
            </div>
            <div className="sq-card p-5 space-y-3">
              <div className="flex items-baseline gap-2"><h3 className="font-semibold">Notes</h3><span className={`text-sm font-bold ${weekNotes.length >= CADENCE.note ? 'text-emerald-600' : 'text-gray-700'}`}>{weekNotes.length}/{CADENCE.note}</span><span className="text-xs text-gray-400">discovery</span></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{slots(weekNotes, 'note')}</div>
            </div>
            <div className="sq-card p-5 space-y-3">
              <div className="flex items-baseline gap-2"><h3 className="font-semibold">Longform</h3><span className={`text-sm font-bold ${weekLong.length >= CADENCE.longform ? 'text-emerald-600' : 'text-gray-700'}`}>{weekLong.length}/{CADENCE.longform}</span><span className="text-xs text-gray-400">consideration</span></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{slots(weekLong, 'longform')}</div>
            </div>
            {plannedIdeas.length > 0 && (
              <div className="sq-card p-5 space-y-2">
                <h3 className="font-semibold">Ideas planned this week</h3>
                {plannedIdeas.map((it) => <button key={it.id} onClick={() => p.onOpen(it)} className="w-full text-left flex gap-3 items-center rounded-lg px-2 py-1.5 hover:bg-orange-50"><span className="text-[11px] text-gray-400 w-20 shrink-0">{it.planned_for}</span><span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-gray-900 text-white">{FORMAT_LABEL[(it.format as Format) || 'note']}</span><span className="text-sm truncate">{it.title || 'Untitled'}</span></button>)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-3">
              <div className="mr-auto min-w-0 flex-1">
                {selected ? (
                  <>
                    <Inline value={selected.name} onSave={(name) => p.onRename(sel.kind === 'series' ? 'series' : 'buckets', selected.id, { name })} className="text-xl font-bold block w-full" />
                    <Inline value={selected.description || ''} placeholder="Add a description" onSave={(description) => p.onRename(sel.kind === 'series' ? 'series' : 'buckets', selected.id, { description })} className="text-sm text-gray-600 block w-full" />
                  </>
                ) : <h2 className="text-xl font-bold">All posts</h2>}
              </div>
              <NewButtons ctx={{ seriesId: selSeries?.id ?? null, bucketId: selBucket?.id ?? null }} />
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
          </>
        )}
      </section>
    </div>
  )
}
