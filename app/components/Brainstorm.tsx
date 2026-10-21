'use client'

import { useState } from 'react'
import { timeAgo } from '../lib/text'
import { seriesEmoji, type StructureData } from '../lib/structure'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  structure: StructureData | null
  onAdd: (title: string, format: 'note' | 'longform', seriesId: string | null) => Promise<void>
  onRename: (item: Item, title: string) => Promise<void>
  onStart: (item: Item) => void
  onDelete: (item: Item) => Promise<void>
}

export default function Brainstorm({ items, structure, onAdd, onRename, onStart, onDelete }: Props) {
  const [text, setText] = useState('')
  const [format, setFormat] = useState<'note' | 'longform'>('longform')
  const [seriesId, setSeriesId] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const add = async () => {
    const t = text.trim(); if (!t || busy) return
    setBusy(true); await onAdd(t, format, seriesId || null); setText(''); setBusy(false)
  }
  const label = (it: Item) => it.title || it.content.split('\n')[0] || 'Untitled'

  return (
    <div className="space-y-4 sq-fade-in">
      <div className="sq-card p-4 space-y-2">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} autoFocus
            placeholder="An idea, a title, a half-thought. Hit Enter."
            className="flex-1 h-10 px-3 text-[15px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
          <button onClick={add} disabled={!text.trim() || busy} className="sq-btn-primary h-10 px-4 rounded-lg text-sm font-semibold">＋ Add</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {(['longform', 'note'] as const).map((f) => (
              <button key={f} onClick={() => setFormat(f)} className={`px-3 py-1.5 ${format === f ? 'bg-amber-100 text-amber-900 font-semibold' : 'bg-white text-gray-600'}`}>{f === 'longform' ? 'Longform' : 'Note'}</button>
            ))}
          </span>
          {structure && (
            <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="h-8 bg-white border border-gray-200 rounded-lg px-2">
              <option value="">No series</option>
              {structure.series.map((x) => <option key={x.id} value={x.id}>{seriesEmoji(x)} {x.name}</option>)}
            </select>
          )}
          <span className="text-gray-400">Just titles and ideas. Nothing is a draft until you start writing it.</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="sq-card p-10 text-center">
          <p className="text-4xl mb-2">🧠</p>
          <p className="font-semibold">No ideas yet</p>
          <p className="text-sm text-gray-500">Dump them above. Sort them out later.</p>
        </div>
      ) : (
        <ul className="sq-card divide-y divide-gray-100 overflow-hidden">
          {items.map((it) => {
            const ser = structure?.series.find((x) => x.id === it.series_id)
            return (
              <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/40">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{it.kind === 'blog' ? 'LONG' : 'NOTE'}</span>
                {editId === it.id ? (
                  <input value={editText} autoFocus onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { onRename(it, editText.trim() || label(it)); setEditId(null) } if (e.key === 'Escape') setEditId(null) }}
                    onBlur={() => setEditId(null)} className="flex-1 h-8 px-2 text-sm border border-amber-300 rounded-md" />
                ) : (
                  <button onClick={() => { setEditId(it.id); setEditText(label(it)) }} title="Click to rename" className="flex-1 min-w-0 text-left text-sm font-medium truncate">{label(it)}</button>
                )}
                {ser && <span className="hidden sm:inline text-[11px] text-gray-500 shrink-0">{seriesEmoji(ser)} {ser.name}</span>}
                <span className="hidden md:inline text-[11px] text-gray-400 shrink-0">{timeAgo(it.updated_at)}</span>
                <button onClick={() => onStart(it)} className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium shrink-0">Start writing →</button>
                <button onClick={() => onDelete(it)} title="Delete idea" className="text-gray-400 hover:text-red-600 px-1 shrink-0">×</button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
