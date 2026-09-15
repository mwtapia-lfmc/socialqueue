'use client'

import { useState } from 'react'
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

  if (items.length === 0) {
    return (
      <div className="sq-card p-10 text-center sq-fade-in">
        <p className="text-4xl mb-2">📝</p>
        <p className="font-semibold">No drafts yet</p>
        <p className="text-sm text-gray-500">Anything you type in Compose autosaves here.</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-4 sq-fade-in">
      {items.map((it) => (
        <div key={it.id} className="sq-card p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${it.kind === 'blog' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {it.kind === 'blog' ? 'BLOG' : 'POST'}
              </span>
              <p className="font-semibold mt-1.5 truncate">{it.title || it.content.split('\n')[0].slice(0, 70) || 'Untitled'}</p>
            </div>
            <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(it.updated_at)}</span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-3">{it.content}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {it.kind === 'post' && (Object.keys(it.platforms) as Platform[]).filter((p) => it.platforms[p]).map((p) => (
              <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full ${PLATFORM_META[p].color}`}>{PLATFORM_META[p].icon} {PLATFORM_META[p].label}</span>
            ))}
            {(it.image_urls?.length || 0) > 0 && <span className="text-[11px] text-gray-500">🖼 {it.image_urls!.length}</span>}
            {it.analysis?.engagement_score && <span className="text-[11px] text-purple-700">✨ {it.analysis.engagement_score}/10</span>}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 flex-wrap">
            <button onClick={() => onEdit(it)} className="text-sm px-3 py-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 font-medium">Edit</button>
            {scheduling === it.id ? (
              <>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 px-2 text-sm border border-gray-200 rounded-lg" />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8 px-2 text-sm border border-gray-200 rounded-lg" />
                <button onClick={async () => { if (!date) return alert('Pick a date'); await onSchedule(it, date, time); setScheduling(null) }} className="sq-btn-primary h-8 px-3 rounded-lg text-sm font-semibold">Confirm</button>
                <button onClick={() => setScheduling(null)} className="text-sm text-gray-500 px-2">Cancel</button>
              </>
            ) : (
              <button onClick={() => setScheduling(it.id)} className="sq-btn-primary text-sm px-3 py-1.5 rounded-lg font-medium">📅 Schedule</button>
            )}
            <span className="flex-1" />
            <button onClick={() => confirm('Delete this draft?') && onDelete(it)} className="text-sm px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
