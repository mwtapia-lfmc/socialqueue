'use client'

import { useState } from 'react'
import { PLATFORM_META, formatTime, parseYmd, type Platform } from '../lib/text'
import type { Item } from './UnifiedComposer'

interface Props {
  items: Item[]
  onEdit: (item: Item) => void
  onUnschedule: (item: Item) => Promise<void>
  onDelete: (item: Item) => Promise<void>
  onPublishNow: (item: Item) => Promise<void>
}

const platformsOf = (it: Item) => (Object.keys(it.platforms) as Platform[]).filter((p) => it.platforms[p])

export default function ScheduledPosts({ items, onEdit, onUnschedule, onDelete, onPublishNow }: Props) {
  const [publishing, setPublishing] = useState<string | null>(null)
  const byTime = (a: Item, b: Item) => `${a.schedule_date}${a.schedule_time}`.localeCompare(`${b.schedule_date}${b.schedule_time}`)
  const scheduled = items.filter((i) => i.status === 'scheduled').sort(byTime)
  const failed = items.filter((i) => i.status === 'failed').sort(byTime)
  const published = items.filter((i) => i.status === 'published').sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))

  const publish = async (it: Item) => { setPublishing(it.id); await onPublishNow(it); setPublishing(null) }

  const Card = ({ it, tone }: { it: Item; tone: 'blue' | 'red' | 'green' }) => {
    const d = it.schedule_date ? parseYmd(it.schedule_date) : null
    const badge = tone === 'red' ? 'bg-red-100 text-red-800' : tone === 'green' ? 'bg-emerald-100 text-emerald-800' : it.kind === 'blog' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
    return (
      <div className="sq-card p-4 md:p-5 flex gap-4 items-start">
        <div className={`shrink-0 w-16 text-center rounded-xl py-2 ${badge}`}>
          <div className="text-[10px] uppercase font-semibold">{d?.toLocaleString('default', { month: 'short' })}</div>
          <div className="text-2xl font-bold leading-none">{d?.getDate()}</div>
          <div className="text-[10px] mt-1">{formatTime(it.schedule_time)}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {it.kind === 'blog'
              ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-600 text-white">📝 Blog</span>
              : platformsOf(it).map((p) => {
                const r = it.publish_log?.[p]
                return <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full ${PLATFORM_META[p].color}`} title={r && !r.ok ? r.error : ''}>
                  {PLATFORM_META[p].icon} {PLATFORM_META[p].label}{r ? (r.ok ? ' ✓' : ' ✗') : ''}
                </span>
              })}
            {(it.image_urls?.length || 0) > 0 && <span className="text-[11px] text-gray-500">🖼 {it.image_urls!.length}</span>}
          </div>
          {it.title && <p className="font-semibold truncate">{it.title}</p>}
          <p className="text-sm text-gray-600 line-clamp-2">{it.content}</p>
          {tone === 'red' && it.publish_log && (
            <p className="text-xs text-red-600 mt-1">{Object.entries(it.publish_log).filter(([, r]: any) => !r.ok).map(([p, r]: any) => `${p}: ${r.error}`).join(' · ')}</p>
          )}
          {tone === 'green' && it.publish_log && (
            <div className="flex gap-2 mt-1">{Object.entries(it.publish_log).filter(([, r]: any) => r.ok && r.url).map(([p, r]: any) => (
              <a key={p} href={r.url} target="_blank" rel="noopener" className="text-xs text-sky-600 hover:underline">View on {PLATFORM_META[p as Platform]?.label || p} ↗</a>
            ))}</div>
          )}
          <div className="flex gap-1 mt-2 flex-wrap">
            {tone !== 'green' && <button onClick={() => onEdit(it)} className="text-xs px-2.5 py-1 rounded-lg text-indigo-700 hover:bg-indigo-50 font-medium">Edit</button>}
            {tone !== 'green' && it.kind === 'post' && (
              <button onClick={() => publish(it)} disabled={publishing === it.id} className="text-xs px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
                {publishing === it.id ? <span className="sq-pulse">Publishing…</span> : tone === 'red' ? 'Retry now' : 'Publish now'}
              </button>
            )}
            {tone !== 'green' && <button onClick={() => onUnschedule(it)} className="text-xs px-2.5 py-1 rounded-lg text-gray-600 hover:bg-gray-100">Back to drafts</button>}
            <button onClick={() => confirm('Delete this item?') && onDelete(it)} className="text-xs px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50">Delete</button>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="sq-card p-10 text-center sq-fade-in">
        <p className="text-4xl mb-2">📅</p>
        <p className="font-semibold">Nothing scheduled</p>
        <p className="text-sm text-gray-500">Schedule a draft and it shows up here and on the calendar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 sq-fade-in">
      {failed.length > 0 && <section className="space-y-3"><h3 className="text-sm font-semibold text-red-700">Needs attention</h3>{failed.map((it) => <Card key={it.id} it={it} tone="red" />)}</section>}
      <section className="space-y-3"><h3 className="text-sm font-semibold text-gray-700">Scheduled · publishes automatically</h3>
        {scheduled.length ? scheduled.map((it) => <Card key={it.id} it={it} tone="blue" />) : <p className="text-sm text-gray-400">Nothing waiting.</p>}</section>
      {published.length > 0 && <section className="space-y-3"><h3 className="text-sm font-semibold text-emerald-700">Published</h3>{published.map((it) => <Card key={it.id} it={it} tone="green" />)}</section>}
    </div>
  )
}
