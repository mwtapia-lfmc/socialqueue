'use client'

import { useState } from 'react'
import { PLATFORM_META, formatTime, parseYmd, timeAgo, type Platform } from '../lib/text'
import type { Item } from './UnifiedComposer'
import type { Connection } from './Accounts'
import type { TrendSource } from '../api/trends/route'

interface Props {
  user: any
  items: Item[]
  connections: Connection[]
  trends: TrendSource[] | null
  onGo: (view: 'compose' | 'batch' | 'drafts' | 'calendar' | 'queue' | 'profiles' | 'trends' | 'accounts') => void
  onEdit: (item: Item) => void
  onQuickPost: (text: string) => void
}

const platformsOf = (it: Item) => (Object.keys(it.platforms) as Platform[]).filter((p) => it.platforms[p])
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Dashboard({ user, items, connections, trends, onGo, onEdit, onQuickPost }: Props) {
  const [quick, setQuick] = useState('')
  const today = new Date()
  const todayKey = ymd(today)
  const drafts = items.filter((i) => i.status === 'draft')
  const scheduled = items.filter((i) => i.status === 'scheduled').sort((a, b) => `${a.schedule_date}${a.schedule_time}`.localeCompare(`${b.schedule_date}${b.schedule_time}`))
  const upNext = scheduled.filter((i) => (i.schedule_date || '') >= todayKey).slice(0, 5)
  const failed = items.filter((i) => i.status === 'failed')
  const published = items.filter((i) => i.status === 'published').sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const publishedThisWeek = published.filter((i) => (i.published_at || '') >= weekAgo).length
  const hour = today.getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = (user?.user_metadata?.full_name || user?.email || '').split(/[ @]/)[0]

  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d })

  return (
    <div className="space-y-5 sq-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{greet}{firstName ? `, ${firstName}` : ''}.</h2>
          <p className="text-sm text-gray-500">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          {connections.map((c) => (
            <button key={c.platform} onClick={() => onGo('profiles')} title={`@${c.handle}`} className="relative">
              {c.avatar ? <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover border-2 border-white shadow" /> : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />}
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full text-[9px] flex items-center justify-center ring-2 ring-white ${PLATFORM_META[c.platform as Platform]?.color}`}>{PLATFORM_META[c.platform as Platform]?.icon}</span>
            </button>
          ))}
          <button onClick={() => onGo('accounts')} className="h-9 w-9 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 text-lg leading-none" title="Connect an account">+</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Drafts', value: drafts.length, go: 'drafts' as const, tint: 'from-gray-50 to-white' },
          { label: 'Scheduled', value: scheduled.length, go: 'queue' as const, tint: 'from-blue-50 to-white' },
          { label: 'Published this week', value: publishedThisWeek, go: 'queue' as const, tint: 'from-emerald-50 to-white' },
          { label: failed.length ? 'Needs attention' : 'Connected', value: failed.length || connections.length, go: failed.length ? 'queue' as const : 'accounts' as const, tint: failed.length ? 'from-red-50 to-white' : 'from-purple-50 to-white' },
        ].map((s) => (
          <button key={s.label} onClick={() => onGo(s.go)} className={`sq-card p-4 text-left bg-gradient-to-br ${s.tint}`}>
            <p className="text-3xl font-extrabold tracking-tight">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {trends && trends.some((s) => s.trends.length) && (
        <div className="sq-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">📈 Trending now</h3>
            <button onClick={() => onGo('trends')} className="text-xs text-indigo-600 hover:underline">All trends →</button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {trends.filter((s) => s.trends.length).slice(0, 3).map((s) => (
              <div key={s.key} className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{s.icon} {s.label}</p>
                <ul className="space-y-1">
                  {s.trends.slice(0, 4).map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px]">
                      <span className="text-gray-300 font-bold w-3 shrink-0">{i + 1}</span>
                      <button onClick={() => onQuickPost(`${t.topic}\n\n`)} title="Write about this" className="truncate text-left text-gray-800 hover:text-indigo-700 flex-1">{t.topic}</button>
                      {t.count != null && <span className="text-[10px] text-gray-400 shrink-0">{t.count >= 1000 ? `${(t.count / 1000).toFixed(t.count >= 10000 ? 0 : 1)}k` : t.count}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="sq-card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Quick post</h3>
            <textarea value={quick} onChange={(e) => setQuick(e.target.value)} rows={3} placeholder="What's happening? Opens in the full composer with previews…"
              className="w-full p-3 text-[15px] border border-gray-200 rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">{quick.length} chars</span>
              <span className="flex-1" />
              <button onClick={() => onGo('batch')} className="text-sm px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100">⚡ Batch</button>
              <button onClick={() => onGo('compose')} className="text-sm px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Full composer</button>
              <button onClick={() => quick.trim() && onQuickPost(quick)} disabled={!quick.trim()} className="sq-btn-primary text-sm px-4 py-2 rounded-lg font-semibold">Continue →</button>
            </div>
          </div>

          <div className="sq-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Up next</h3>
              <button onClick={() => onGo('calendar')} className="text-xs text-indigo-600 hover:underline">Calendar →</button>
            </div>
            {upNext.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing scheduled. {drafts.length ? `You have ${drafts.length} draft${drafts.length > 1 ? 's' : ''} ready to schedule.` : ''}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {upNext.map((it) => {
                  const d = parseYmd(it.schedule_date!)
                  const isToday = it.schedule_date === todayKey
                  return (
                    <li key={it.id}>
                      <button onClick={() => onEdit(it)} className="w-full text-left flex gap-3 items-center py-2.5 hover:bg-indigo-50/60 rounded-lg px-2 -mx-2">
                        <div className={`shrink-0 w-12 text-center rounded-lg py-1 ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                          <div className="text-[9px] uppercase font-semibold">{isToday ? 'Today' : d.toLocaleString('default', { weekday: 'short' })}</div>
                          <div className="text-sm font-bold leading-none">{d.getDate()}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 truncate">{it.title || it.content.split('\n')[0]}</p>
                          <p className="text-[11px] text-gray-500">{formatTime(it.schedule_time)} · {it.kind === 'blog' ? '📝 Blog' : platformsOf(it).map((p) => PLATFORM_META[p].icon).join(' ')}</p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="sq-card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">This week</h3>
            <div className="grid grid-cols-7 gap-1">
              {week.map((d) => {
                const key = ymd(d)
                const count = scheduled.filter((i) => i.schedule_date === key).length
                const isToday = key === todayKey
                return (
                  <button key={key} onClick={() => onGo('calendar')} className={`rounded-lg py-2 text-center ${isToday ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-indigo-50'}`}>
                    <div className="text-[9px] uppercase opacity-70">{d.toLocaleString('default', { weekday: 'narrow' })}</div>
                    <div className="text-sm font-bold">{d.getDate()}</div>
                    <div className={`mx-auto mt-1 h-1.5 w-1.5 rounded-full ${count ? (isToday ? 'bg-white' : 'bg-indigo-500') : 'bg-transparent'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sq-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Recently published</h3>
              <button onClick={() => onGo('profiles')} className="text-xs text-indigo-600 hover:underline">Profiles →</button>
            </div>
            {published.length === 0 ? <p className="text-sm text-gray-400">Nothing yet.</p> : (
              <ul className="space-y-2.5">
                {published.slice(0, 5).map((it) => (
                  <li key={it.id} className="flex gap-2 items-start">
                    <span className="text-xs mt-0.5">{platformsOf(it).map((p) => PLATFORM_META[p].icon).join('')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-gray-800 line-clamp-2">{it.title || it.content}</p>
                      <div className="flex gap-2 text-[11px] text-gray-400">
                        <span>{it.published_at ? timeAgo(it.published_at) : ''}</span>
                        {Object.entries(it.publish_log || {}).filter(([, r]: any) => r.ok && r.url).map(([p, r]: any) => (
                          <a key={p} href={r.url} target="_blank" rel="noopener" className="text-sky-600 hover:underline">{PLATFORM_META[p as Platform]?.label} ↗</a>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {drafts.length > 0 && (
            <div className="sq-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Recent drafts</h3>
                <button onClick={() => onGo('drafts')} className="text-xs text-indigo-600 hover:underline">All drafts →</button>
              </div>
              <ul className="space-y-2">
                {drafts.slice(0, 4).map((it) => (
                  <li key={it.id}>
                    <button onClick={() => onEdit(it)} className="w-full text-left text-[13px] text-gray-800 truncate hover:text-indigo-700">
                      {it.title || it.content.split('\n')[0] || 'Untitled'} <span className="text-[11px] text-gray-400">· {timeAgo(it.updated_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
