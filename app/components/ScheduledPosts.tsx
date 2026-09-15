'use client'

import { PLATFORM_META, formatTime, parseYmd, type Platform } from '../lib/text'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  onEdit: (item: Item) => void
  onUnschedule: (item: Item) => Promise<void>
  onDelete: (item: Item) => Promise<void>
}

export default function ScheduledPosts({ items, onEdit, onUnschedule, onDelete }: Props) {
  const sorted = [...items].sort((a, b) =>
    `${a.schedule_date}${a.schedule_time}`.localeCompare(`${b.schedule_date}${b.schedule_time}`)
  )

  if (sorted.length === 0) {
    return (
      <div className="sq-card p-10 text-center sq-fade-in">
        <p className="text-4xl mb-2">📅</p>
        <p className="font-semibold">Nothing scheduled</p>
        <p className="text-sm text-gray-500">Schedule a draft and it shows up here and on the calendar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sq-fade-in">
      {sorted.map((it) => {
        const d = it.schedule_date ? parseYmd(it.schedule_date) : null
        return (
          <div key={it.id} className="sq-card p-4 md:p-5 flex gap-4 items-start">
            <div className={`shrink-0 w-16 text-center rounded-xl py-2 ${it.kind === 'blog' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
              <div className="text-[10px] uppercase font-semibold">{d?.toLocaleString('default', { month: 'short' })}</div>
              <div className="text-2xl font-bold leading-none">{d?.getDate()}</div>
              <div className="text-[10px] mt-1">{formatTime(it.schedule_time)}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {it.kind === 'blog'
                  ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-600 text-white">📝 Blog</span>
                  : (Object.keys(it.platforms) as Platform[]).filter((p) => it.platforms[p]).map((p) => (
                    <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full ${PLATFORM_META[p].color}`}>{PLATFORM_META[p].icon} {PLATFORM_META[p].label}</span>
                  ))}
                {(it.image_urls?.length || 0) > 0 && <span className="text-[11px] text-gray-500">🖼 {it.image_urls!.length}</span>}
              </div>
              {it.title && <p className="font-semibold truncate">{it.title}</p>}
              <p className="text-sm text-gray-600 line-clamp-2">{it.content}</p>
              <div className="flex gap-1 mt-2">
                <button onClick={() => onEdit(it)} className="text-xs px-2.5 py-1 rounded-lg text-indigo-700 hover:bg-indigo-50 font-medium">Edit</button>
                <button onClick={() => onUnschedule(it)} className="text-xs px-2.5 py-1 rounded-lg text-gray-600 hover:bg-gray-100">Back to drafts</button>
                <button onClick={() => confirm('Delete this scheduled item?') && onDelete(it)} className="text-xs px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
