'use client'

import { useMemo, useState } from 'react'
import { PLATFORM_META, formatTime, parseYmd, type Platform } from '../lib/text'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  onSelect: (item: Item) => void
  onMove: (item: Item, date: string, time: string) => Promise<void>
  onCreate: (date: string, time: string) => void
}

type Mode = 'month' | 'week' | 'agenda'
const PLATFORMS = Object.keys(PLATFORM_META) as Platform[]
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }
const startOfWeek = (d: Date) => addDays(d, -d.getDay())
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am → 11pm
const platformsOf = (it: Item) => PLATFORMS.filter((p) => it.platforms?.[p])
const statusCls = (it: Item) =>
  it.status === 'published' ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
  : it.status === 'failed' ? 'bg-red-100 text-red-900 border-red-200'
  : it.kind === 'blog' ? 'bg-purple-100 text-purple-900 border-purple-200'
  : 'bg-blue-100 text-blue-900 border-blue-200'
const statusIcon = (it: Item) => (it.status === 'published' ? '✓' : it.status === 'failed' ? '✗' : '')

export default function Calendar({ items, onSelect, onMove, onCreate }: Props) {
  const today = new Date(); const todayKey = ymd(today)
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [dragging, setDragging] = useState<Item | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const filtered = useMemo(() => items.filter((it) =>
    (statusFilter === 'all' || it.status === statusFilter) &&
    (platformFilter === 'all' || !!it.platforms?.[platformFilter])
  ), [items, statusFilter, platformFilter])

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of filtered) if (it.schedule_date) m.set(it.schedule_date, [...(m.get(it.schedule_date) || []), it])
    for (const v of m.values()) v.sort((a, b) => (a.schedule_time || '').localeCompare(b.schedule_time || ''))
    return m
  }, [filtered])

  const title = mode === 'month' ? cursor.toLocaleString('default', { month: 'long', year: 'numeric' })
    : mode === 'week' ? `${startOfWeek(cursor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'Next 30 days'
  const step = (dir: 1 | -1) => setCursor(mode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1) : addDays(cursor, 7 * dir))

  const drop = async (date: string, time?: string) => {
    if (!dragging) return
    const it = dragging; setDragging(null); setDropTarget(null)
    if (it.status === 'published') return
    await onMove(it, date, time || it.schedule_time || '09:00')
  }
  const dragProps = (it: Item) => it.status === 'published' ? {} : {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDragging(it); e.dataTransfer.effectAllowed = 'move' },
    onDragEnd: () => { setDragging(null); setDropTarget(null) },
  }
  const dropProps = (key: string, date: string, time?: string) => ({
    onDragOver: (e: React.DragEvent) => { if (dragging) { e.preventDefault(); setDropTarget(key) } },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); drop(date, time) },
  })

  const Chip = ({ it, compact = false }: { it: Item; compact?: boolean }) => (
    <button onClick={(e) => { e.stopPropagation(); onSelect(it) }} title={`${it.status} · ${formatTime(it.schedule_time)}\n${it.title || it.content}`} {...dragProps(it)}
      className={`w-full text-left rounded-md border px-1.5 py-1 text-[11px] leading-tight transition hover:brightness-95 ${statusCls(it)} ${it.status === 'published' ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${dragging?.id === it.id ? 'opacity-40' : ''}`}>
      <span className="flex items-center gap-1">
        <span className="font-semibold shrink-0">{statusIcon(it)}{compact ? '' : formatTime(it.schedule_time)}</span>
        <span className="shrink-0">{it.kind === 'blog' ? '📝' : platformsOf(it).map((p) => PLATFORM_META[p].icon).join('')}</span>
        <span className="truncate">{it.title || it.content.split('\n')[0]}</span>
      </span>
    </button>
  )

  // ---------- MONTH ----------
  const Month = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth()
    const first = new Date(y, m, 1); const gridStart = startOfWeek(first)
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    return (
      <>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d) => {
            const key = ymd(d); const inMonth = d.getMonth() === m; const isToday = key === todayKey
            const dayItems = byDay.get(key) || []; const open = expandedDay === key
            const show = open ? dayItems : dayItems.slice(0, 3)
            return (
              <div key={key} {...dropProps(key, key)} onClick={() => onCreate(key, '09:00')}
                className={`relative min-h-28 rounded-xl p-1.5 border transition cursor-pointer ${dropTarget === key ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : isToday ? 'border-indigo-300 bg-indigo-50/60' : inMonth ? 'border-gray-100 bg-white/70 hover:bg-white' : 'border-transparent bg-white/30 text-gray-300'} ${open ? 'z-10 col-span-1 row-span-2' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${isToday ? 'h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center' : inMonth ? 'text-gray-600' : 'text-gray-300'}`}>{d.getDate()}</span>
                  {dayItems.length > 0 && <span className="text-[10px] text-gray-400">{dayItems.length}</span>}
                </div>
                <div className="space-y-1">
                  {show.map((it) => <Chip key={it.id} it={it} />)}
                  {!open && dayItems.length > 3 && <button onClick={(e) => { e.stopPropagation(); setExpandedDay(key) }} className="text-[10px] text-indigo-600 hover:underline px-1">+{dayItems.length - 3} more</button>}
                  {open && <button onClick={(e) => { e.stopPropagation(); setExpandedDay(null) }} className="text-[10px] text-gray-500 hover:underline px-1">collapse</button>}
                </div>
                {dayItems.length === 0 && inMonth && <span className="absolute inset-x-0 bottom-1.5 text-center text-[10px] text-gray-300 opacity-0 hover:opacity-100 transition">+ new post</span>}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  // ---------- WEEK ----------
  const Week = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
    const rowH = 44
    const hourOf = (t?: string | null) => { const [h, mi] = (t || '09:00').split(':').map(Number); return h + mi / 60 }
    return (
      <div className="overflow-x-auto sq-scroll">
        <div className="min-w-[760px]">
          <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
            <div />
            {days.map((d) => { const key = ymd(d); const isToday = key === todayKey; return (
              <div key={key} className="text-center py-2 border-b border-gray-100">
                <div className="text-[10px] uppercase text-gray-400">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div className={`mx-auto text-sm font-bold h-7 w-7 rounded-full flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-800'}`}>{d.getDate()}</div>
              </div>
            ) })}
          </div>
          <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
            <div>
              {HOURS.map((h) => <div key={h} className="text-[10px] text-gray-400 text-right pr-2 -mt-1.5" style={{ height: rowH }}>{((h + 11) % 12) + 1}{h >= 12 ? 'pm' : 'am'}</div>)}
            </div>
            {days.map((d) => {
              const key = ymd(d); const dayItems = byDay.get(key) || []
              return (
                <div key={key} className={`relative border-l border-gray-100 ${key === todayKey ? 'bg-indigo-50/40' : ''}`} style={{ height: rowH * HOURS.length }}>
                  {HOURS.map((h) => {
                    const t = `${String(h).padStart(2, '0')}:00`; const k = `${key}T${t}`
                    return <div key={h} {...dropProps(k, key, t)} onClick={() => onCreate(key, t)} title={`New post ${formatTime(t)}`}
                      className={`border-t border-gray-100 hover:bg-indigo-50/70 cursor-pointer transition ${dropTarget === k ? 'bg-indigo-100' : ''}`} style={{ height: rowH }} />
                  })}
                  {dayItems.map((it, i) => {
                    const top = (hourOf(it.schedule_time) - HOURS[0]) * rowH
                    if (top < 0 || top > rowH * HOURS.length) return null
                    const overlap = dayItems.filter((o) => o.schedule_time === it.schedule_time); const idx = overlap.indexOf(it)
                    return (
                      <div key={it.id} className="absolute left-0.5 right-0.5 px-0.5" style={{ top: top + idx * 22 + 1, zIndex: 2 }}>
                        <Chip it={it} compact />
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {ymd(today) >= ymd(days[0]) && ymd(today) <= ymd(days[6]) && (() => {
              const now = today.getHours() + today.getMinutes() / 60; const top = (now - HOURS[0]) * rowH
              return top > 0 ? <div className="absolute left-14 right-0 border-t-2 border-pink-500 pointer-events-none" style={{ top }}><span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-pink-500" /></div> : null
            })()}
          </div>
        </div>
      </div>
    )
  }

  // ---------- AGENDA ----------
  const Agenda = () => {
    const days = Array.from({ length: 30 }, (_, i) => ymd(addDays(today, i))).filter((k) => byDay.has(k))
    if (!days.length) return <p className="text-sm text-gray-400 text-center py-10">Nothing in the next 30 days.</p>
    return (
      <div className="space-y-4">
        {days.map((k) => { const d = parseYmd(k); const isToday = k === todayKey; return (
          <div key={k} className="flex gap-4">
            <div className={`shrink-0 w-16 text-center rounded-xl py-2 self-start ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              <div className="text-[9px] uppercase font-semibold">{isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div className="text-xl font-bold leading-none">{d.getDate()}</div>
              <div className="text-[9px]">{d.toLocaleDateString(undefined, { month: 'short' })}</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {(byDay.get(k) || []).map((it) => (
                <button key={it.id} onClick={() => onSelect(it)} className={`w-full text-left rounded-xl border px-3 py-2 flex items-start gap-3 hover:brightness-95 ${statusCls(it)}`}>
                  <span className="text-xs font-semibold w-16 shrink-0">{formatTime(it.schedule_time)}</span>
                  <span className="text-xs shrink-0">{it.kind === 'blog' ? '📝' : platformsOf(it).map((p) => PLATFORM_META[p].icon).join(' ')}</span>
                  <span className="text-sm line-clamp-2 flex-1">{statusIcon(it) && <span className="mr-1">{statusIcon(it)}</span>}{it.title || it.content}</span>
                </button>
              ))}
            </div>
          </div>
        ) })}
      </div>
    )
  }

  const counts = { scheduled: items.filter((i) => i.status === 'scheduled').length, published: items.filter((i) => i.status === 'published').length, failed: items.filter((i) => i.status === 'failed').length }

  return (
    <div className="sq-card p-4 md:p-6 sq-fade-in">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="sq-tool h-9 w-9 rounded-full text-lg" disabled={mode === 'agenda'}>‹</button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))} className="sq-tool h-9 px-3 rounded-full text-sm font-medium">Today</button>
          <button onClick={() => step(1)} className="sq-tool h-9 w-9 rounded-full text-lg" disabled={mode === 'agenda'}>›</button>
        </div>
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="flex-1" />
        <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
          {(['month', 'week', 'agenda'] as Mode[]).map((m) => <button key={m} onClick={() => setMode(m)} className={`sq-tab px-3 py-1 rounded-full text-xs font-medium capitalize ${mode === m ? 'sq-tab-active' : 'text-gray-600'}`}>{m}</button>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
        <button onClick={() => setPlatformFilter('all')} className={`px-2.5 py-1 rounded-full border ${platformFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>All platforms</button>
        {PLATFORMS.map((p) => <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? 'all' : p)} className={`px-2.5 py-1 rounded-full border ${platformFilter === p ? PLATFORM_META[p].color + ' border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>{PLATFORM_META[p].icon} {PLATFORM_META[p].label}</button>)}
        <span className="mx-1 h-4 w-px bg-gray-200" />
        {([['all', 'Everything', 'bg-gray-900 text-white'], ['scheduled', `Scheduled · ${counts.scheduled}`, 'bg-blue-600 text-white'], ['published', `Published · ${counts.published}`, 'bg-emerald-600 text-white'], ['failed', `Failed · ${counts.failed}`, 'bg-red-600 text-white']] as const).map(([k, label, cls]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={`px-2.5 py-1 rounded-full border ${statusFilter === k ? cls + ' border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>{label}</button>
        ))}
        <span className="flex-1" />
        <span className="text-gray-400 hidden md:inline">Drag to reschedule · click empty space to start a post</span>
      </div>

      {mode === 'month' && <Month />}
      {mode === 'week' && <Week />}
      {mode === 'agenda' && <Agenda />}
    </div>
  )
}
