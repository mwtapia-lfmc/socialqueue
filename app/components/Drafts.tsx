'use client'

import { useMemo, useState } from 'react'
import { PLATFORM_META, timeAgo, type Platform } from '../lib/text'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  onEdit: (item: Item) => void
  onSchedule: (item: Item, date: string, time: string) => Promise<void>
  onDelete: (item: Item) => Promise<void>
}

export default function Drafts({ items, onEdit, onSchedule, onDelete }: Props) {
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [q, setQ] = useState('')

  const label = (it: Item) => it.title || it.content.split('\n')[0].slice(0, 90) || 'Untitled'
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = items
      .filter((it) => !needle || `${it.title || ''} ${it.content}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return [
      { key: 'notes', title: '📝 Notes / Posts', rows: rows.filter((it) => it.kind !== 'blog') },
      { key: 'long', title: '📄 Longform / Articles', rows: rows.filter((it) => it.kind === 'blog') },
    ]
  }, [items, q])

  if (items.length === 0) {
    return (
      <div className="sq-card p-10 text-center sq-fade-in">
        <p className="text-4xl mb-2">📝</p>
        <p className="font-semibold">No drafts yet</p>
        <p className="text-sm text-gray-500">Anything you write in Compose autosaves here. Loose ideas live in Brainstorm.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 sq-fade-in">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts…" className="w-full sm:w-72 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      {sections.map((sec) => (
        <section key={sec.key}>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">{sec.title} <span className="font-normal text-gray-400">· {sec.rows.length}</span></h3>
          {sec.rows.length === 0 ? <p className="text-sm text-gray-400">Nothing here.</p> : (
            <ul className="sq-card divide-y divide-gray-100 overflow-hidden">
              {sec.rows.map((it) => (
                <li key={it.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => onEdit(it)} className="flex-1 min-w-0 text-left">
                      <span className="block text-sm font-medium truncate">{label(it)}</span>
                      {it.title && it.content && <span className="block text-xs text-gray-500 truncate">{it.content.replace(/\s+/g, ' ')}</span>}
                    </button>
                    {it.kind === 'post' && (
                      <span className="hidden sm:flex gap-1 shrink-0">
                        {(Object.keys(it.platforms) as Platform[]).filter((p) => it.platforms[p]).map((p) => (
                          <span key={p} title={PLATFORM_META[p].label} className={`text-[10px] px-1.5 py-0.5 rounded-full ${PLATFORM_META[p].color}`}>{PLATFORM_META[p].icon}</span>
                        ))}
                      </span>
                    )}
                    {(it.image_urls?.length || 0) > 0 && <span className="text-[11px] text-gray-500 shrink-0">🖼 {it.image_urls!.length}</span>}
                    <span className="hidden md:inline text-[11px] text-gray-400 shrink-0 w-14 text-right">{timeAgo(it.updated_at)}</span>
                    <button onClick={() => { setScheduling(scheduling === it.id ? null : it.id) }} className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium shrink-0">📅 Schedule</button>
                    <button onClick={() => confirm('Delete this draft?') && onDelete(it)} title="Delete" className="text-gray-400 hover:text-red-600 px-1 shrink-0">×</button>
                  </div>
                  {scheduling === it.id && (
                    <div className="flex flex-wrap items-center gap-2 mt-2 pl-1">
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 px-2 text-sm border border-gray-200 rounded-lg" />
                      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8 px-2 text-sm border border-gray-200 rounded-lg" />
                      <button onClick={async () => { if (!date) return alert('Pick a date'); await onSchedule(it, date, time); setScheduling(null) }} className="sq-btn-primary h-8 px-3 rounded-lg text-sm font-semibold">Confirm</button>
                      <button onClick={() => setScheduling(null)} className="text-sm text-gray-500 px-2">Cancel</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
