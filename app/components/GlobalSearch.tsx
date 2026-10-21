'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { notebookOf, type Note } from '../lib/notes'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  notes: Note[]
  onOpenItem: (item: Item) => void
  onOpenNote: (note: Note) => void
}

const norm = (s: string) => s.toLowerCase()
const snippet = (text: string, q: string, len = 110) => {
  const flat = text.replace(/\s+/g, ' ')
  const i = norm(flat).indexOf(q)
  if (i < 0) return flat.slice(0, len)
  const from = Math.max(0, i - 30)
  return (from > 0 ? '…' : '') + flat.slice(from, from + len)
}
const stageOf = (i: Item) => (i.status === 'draft' ? (i.stage === 'idea' ? 'idea' : 'draft') : i.status)

export default function GlobalSearch({ items, notes, onOpenItem, onOpenNote }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); setOpen(true) } }
    const click = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('keydown', key); document.addEventListener('mousedown', click)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('mousedown', click) }
  }, [])

  const needle = norm(q.trim())
  const res = useMemo(() => {
    if (needle.length < 2) return null
    const hitItem = (i: Item) => norm(`${i.title || ''} ${i.hook || ''} ${i.content} ${(i.tags || []).join(' ')}`).includes(needle)
    const live = items.filter((i) => hitItem(i))
    return {
      posts: live.filter((i) => i.kind !== 'blog'),
      long: live.filter((i) => i.kind === 'blog'),
      notes: notes.filter((n) => norm(`${n.title} ${n.body} ${notebookOf(n)}`).includes(needle)),
    }
  }, [needle, items, notes])

  const pick = (fn: () => void) => { fn(); setOpen(false); setQ('') }
  const Group = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => count ? (
    <div>
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{title} · {count}</p>
      {children}
    </div>
  ) : null
  const itemRow = (i: Item) => (
    <button key={i.id} onClick={() => pick(() => onOpenItem(i))} className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 flex items-baseline gap-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{i.title || i.hook || i.content.split('\n')[0] || 'Untitled'}</span>
        <span className="block text-xs text-gray-500 truncate">{snippet(i.content, needle)}</span>
      </span>
      <span className="text-[10px] uppercase text-gray-400 shrink-0">{stageOf(i)}</span>
    </button>
  )

  return (
    <div ref={box} className="relative flex-1 min-w-0 max-w-xl">
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={(e) => e.key === 'Escape' && (setOpen(false), ref.current?.blur())}
        placeholder="Search posts, longform, notebooks…  ⌘K" className="w-full h-11 pl-10 pr-3 text-sm rounded-full border border-gray-200 bg-white/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
      {open && needle.length >= 2 && res && (
        <div className="absolute z-40 mt-2 w-full max-h-[70vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-xl pb-2 sq-scroll">
          {res.posts.length + res.long.length + res.notes.length === 0 && <p className="px-4 py-5 text-sm text-gray-400">Nothing found for “{q.trim()}”.</p>}
          <Group title="Posts / Notes" count={res.posts.length}>{res.posts.slice(0, 6).map(itemRow)}</Group>
          <Group title="Longform / Articles" count={res.long.length}>{res.long.slice(0, 6).map(itemRow)}</Group>
          <Group title="Notebooks" count={res.notes.length}>
            {res.notes.slice(0, 8).map((n) => (
              <button key={n.id} onClick={() => pick(() => onOpenNote(n))} className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 flex items-baseline gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{n.title}</span>
                  <span className="block text-xs text-gray-500 truncate">{snippet(n.body, needle)}</span>
                </span>
                <span className="text-[10px] text-gray-400 shrink-0 max-w-[7rem] truncate">📓 {notebookOf(n)}</span>
              </button>
            ))}
          </Group>
        </div>
      )}
    </div>
  )
}
