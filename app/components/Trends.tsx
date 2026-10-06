'use client'

import { useEffect, useState } from 'react'
import { timeAgo } from '../lib/text'
import type { TrendSource, Trend } from '../api/trends/route'
import type { Profile } from '../api/profiles/route'

interface Props { sources: TrendSource[] | null; note: string; loading: boolean; onRefresh: () => void; profiles: Profile[] | null; onWrite: (text: string) => void }

const n = (v?: number) => (v == null ? '' : v >= 1_000_000 ? `${(v / 1e6).toFixed(1)}M` : v >= 10_000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))
const ORDER_KEY = 'sq:trendOrder'

export default function Trends({ sources, note, loading, onRefresh, profiles, onWrite }: Props) {
  const [order, setOrder] = useState<string[]>([])
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [angles, setAngles] = useState<Record<string, string[] | 'loading'>>({})
  const [openNews, setOpenNews] = useState<string | null>(null)

  useEffect(() => { try { const o = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); if (Array.isArray(o)) setOrder(o) } catch {} }, [])
  const ordered = sources ? [...sources].sort((a, b) => { const ia = order.indexOf(a.key), ib = order.indexOf(b.key); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) }) : []
  const persist = (keys: string[]) => { setOrder(keys); try { localStorage.setItem(ORDER_KEY, JSON.stringify(keys)) } catch {} }
  const dropOn = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return
    const keys = ordered.map((s) => s.key).filter((k) => k !== dragKey)
    keys.splice(keys.indexOf(targetKey), 0, dragKey)
    persist(keys); setDragKey(null); setOver(null)
  }
  const move = (key: string, dir: -1 | 1) => { const keys = ordered.map((s) => s.key); const i = keys.indexOf(key); const j = i + dir; if (j < 0 || j >= keys.length) return; [keys[i], keys[j]] = [keys[j], keys[i]]; persist(keys) }

  const voiceSamples = (profiles || []).flatMap((p) => p.posts.map((x) => x.text).filter(Boolean)).slice(0, 6)
  const getAngles = async (t: Trend) => {
    setAngles((a) => ({ ...a, [t.topic]: 'loading' }))
    const r = await fetch('/api/trend-angles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: t.topic, detail: t.summary, voiceSamples }) })
    const d = await r.json(); setAngles((a) => ({ ...a, [t.topic]: d.angles || [] }))
  }

  if (!sources) return <div className="sq-card p-10 text-center text-gray-400 sq-pulse">Checking what's trending…</div>

  return (
    <div className="space-y-5 sq-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-gray-600 max-w-3xl">{note}</p>
        <span className="flex-1" />
        <span className="text-[11px] text-gray-400 hidden md:inline">Drag a row's handle to reorder</span>
        <button onClick={onRefresh} disabled={loading} className={`sq-tool h-8 px-3 rounded-full text-xs ${loading ? 'sq-pulse' : ''}`}>↻ Refresh</button>
      </div>

      {ordered.map((src) => (
        <section key={src.key} onDragOver={(e) => { if (dragKey) { e.preventDefault(); setOver(src.key) } }} onDragLeave={() => setOver((o) => (o === src.key ? null : o))} onDrop={(e) => { e.preventDefault(); dropOn(src.key) }}
          className={`rounded-2xl p-4 transition ${src.key === 'bluesky' ? 'sq-tint-bluesky' : src.key === 'twitter' ? 'sq-tint-twitter' : 'sq-neutral'} ${over === src.key && dragKey !== src.key ? 'ring-2 ring-indigo-400' : ''} ${dragKey === src.key ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <span draggable onDragStart={(e) => { setDragKey(src.key); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDragKey(null); setOver(null) }} title="Drag to reorder" className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 select-none text-lg leading-none px-1">⋮⋮</span>
            <span className="text-2xl">{src.icon}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold leading-tight">{src.label} <span className="text-xs font-normal text-gray-400">· updated {timeAgo(src.fetchedAt)}</span></h2>
              <p className="text-xs text-gray-500">{src.blurb}</p>
            </div>
            <div className="flex md:hidden gap-1"><button onClick={() => move(src.key, -1)} className="sq-tool h-7 w-7 rounded-full text-sm">↑</button><button onClick={() => move(src.key, 1)} className="sq-tool h-7 w-7 rounded-full text-sm">↓</button></div>
          </div>

          {src.needs ? <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-4">{src.needs}</p>
          : src.error ? <p className="text-sm text-red-700 bg-red-50 rounded-xl p-4">Couldn't load: {src.error}</p>
          : src.trends.length === 0 ? <p className="text-sm text-gray-400 px-1">Nothing returned.</p> : (
            <div className="flex gap-3 overflow-x-auto sq-scroll pb-2 -mx-1 px-1 snap-x">
              {src.trends.map((t, i) => {
                const a = angles[t.topic]; const nk = `${src.key}:${i}`
                return (
                  <article key={nk} className="sq-card p-4 w-[320px] shrink-0 snap-start flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl font-black text-gray-200 leading-none w-7 shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[15px] leading-snug text-gray-900">{t.url ? <a href={t.url} target="_blank" rel="noopener" className="hover:text-indigo-700">{t.topic}</a> : t.topic}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px]">
                          {t.count != null && <span className="font-semibold text-gray-800 bg-gray-100 rounded-full px-2 py-0.5">{n(t.count)} {t.countLabel}</span>}
                          {t.secondary && !t.secondary.includes('searches') && <span className="text-gray-500">{t.secondary}</span>}
                          {t.startedAt && <span className="text-gray-500">🕒 {timeAgo(t.startedAt)}</span>}
                          {t.category && <span className="text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5 capitalize">{t.category}</span>}
                        </div>
                      </div>
                      {t.image && <img src={t.image} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                    </div>
                    {t.summary && <p className="text-[13px] text-gray-700 leading-snug">{t.summary}</p>}
                    {t.actors && t.actors.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="flex -space-x-1.5">{t.actors.map((ac) => ac.avatar ? <img key={ac.handle} src={ac.avatar} alt="" title={`@${ac.handle}`} className="h-5 w-5 rounded-full ring-2 ring-white object-cover" /> : null)}</span>
                        <span className="truncate">driven by @{t.actors[0].handle}{t.actors.length > 1 ? ` +${t.actors.length - 1}` : ''}</span>
                      </div>
                    )}
                    {t.news && t.news.length > 1 && (
                      <div>
                        <button onClick={() => setOpenNews(openNews === nk ? null : nk)} className="text-[11px] text-indigo-600 hover:underline">{openNews === nk ? 'Hide' : `${t.news.length} headlines`} ▾</button>
                        {openNews === nk && <ul className="mt-1 space-y-1">{t.news.map((x, j) => <li key={j} className="text-[12px] leading-snug"><a href={x.url} target="_blank" rel="noopener" className="text-gray-800 hover:text-indigo-700">{x.title}</a>{x.source && <span className="text-gray-400"> — {x.source}</span>}</li>)}</ul>}
                      </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-1">
                      <button onClick={() => onWrite(`${t.topic}\n\n`)} className="text-[11px] px-2.5 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700">Write about this</button>
                      <button onClick={() => getAngles(t)} disabled={a === 'loading'} className="text-[11px] px-2.5 py-1.5 rounded-md bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-50">{a === 'loading' ? <span className="sq-pulse">Thinking…</span> : '✨ AI angles'}</button>
                    </div>
                    {Array.isArray(a) && a.length > 0 && (
                      <div className="space-y-1.5 sq-fade-in">{a.map((line, j) => <button key={j} onClick={() => onWrite(line)} className="block w-full text-left text-[12px] text-gray-800 bg-purple-50/70 hover:bg-purple-100 rounded-lg px-2.5 py-2 leading-snug">{line}</button>)}</div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
