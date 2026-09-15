'use client'

import { useState } from 'react'
import { PLATFORM_META, formatTime, type Platform } from '../lib/text'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  onSelect: (item: Item) => void
}

export default function Calendar({ items, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const today = new Date()
  const y = cursor.getFullYear(), m = cursor.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstDay = new Date(y, m, 1).getDay()
  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`

  const byDay = new Map<number, Item[]>()
  for (const it of items) {
    if (!it.schedule_date?.startsWith(monthKey)) continue
    const day = Number(it.schedule_date.slice(8, 10))
    byDay.set(day, [...(byDay.get(day) || []), it])
  }

  return (
    <div className="sq-card p-5 md:p-6 sq-fade-in">
      <div className="flex justify-between items-center mb-5">
        <button onClick={() => setCursor(new Date(y, m - 1, 1))} className="sq-tool h-9 w-9 rounded-full text-lg">‹</button>
        <h3 className="text-lg font-bold">{cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => setCursor(new Date(y, m + 1, 1))} className="sq-tool h-9 w-9 rounded-full text-lg">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day
          const dayItems = (byDay.get(day) || []).sort((a, b) => (a.schedule_time || '').localeCompare(b.schedule_time || ''))
          return (
            <div key={day} className={`min-h-24 rounded-xl p-1.5 border transition ${isToday ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-100 bg-white/70 hover:bg-white'}`}>
              <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-indigo-700' : 'text-gray-600'}`}>{day}</div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((it) => (
                  <button key={it.id} onClick={() => onSelect(it)} title={it.title || it.content}
                    className={`w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-md truncate transition hover:scale-[1.02] ${it.kind === 'blog' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    <span className="font-medium">{formatTime(it.schedule_time)}</span>{' '}
                    {it.kind === 'blog' ? '📝' : (Object.keys(it.platforms) as Platform[]).filter((p) => it.platforms[p]).map((p) => PLATFORM_META[p].icon).join('')}
                    {' '}{it.title || it.content.slice(0, 30)}
                  </button>
                ))}
                {dayItems.length > 3 && <div className="text-[10px] text-gray-500 px-1">+{dayItems.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
