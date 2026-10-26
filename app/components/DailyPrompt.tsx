'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '../lib/api'
import { INDUSTRY, WEEKDAYS } from '../lib/seriesDays'
import { seriesEmoji, type Series } from '../lib/structure'
import type { TrendSource } from '../api/trends/route'

type Result = { prompt: string; why?: string; trend: { topic: string; url?: string; source?: string } | null; via: 'feeds' | 'web' | 'none' }
interface Props {
  series: Series | null
  trends: TrendSource[] | null
  onWrite: (prompt: string, seriesId: string | null) => void
  onPlanDays: () => void
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

export default function DailyPrompt({ series, trends, onWrite, onPlanDays }: Props) {
  const key = `sq:daily:${today()}:${series?.id || 'open'}`
  const [res, setRes] = useState<Result | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const weekday = WEEKDAYS[new Date().getDay()]

  const fetchOne = async (previous: string[]) => {
    setBusy(true); setErr(null)
    try {
      const flat = (trends || []).flatMap((s) => s.trends.slice(0, 6).map((t) => ({ topic: t.topic, url: t.url, source: s.label })))
      const r = await authedFetch('/api/daily-prompt', { method: 'POST', body: JSON.stringify({ weekday, series: series ? { name: series.name, description: series.description } : null, industry: INDUSTRY, trends: flat, previous }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      const nextSeen = [...previous, d.prompt]
      setRes(d); setSeen(nextSeen)
      try { localStorage.setItem(key, JSON.stringify({ res: d, seen: nextSeen })) } catch {}
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c?.res) { setRes(c.res); setSeen(c.seen || []); return } } catch {}
    if (trends) fetchOne([])
  }, [key, !!trends]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl p-5 md:p-7 text-white shadow-xl shadow-indigo-500/30 ring-1 ring-white/20" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 60%, #db2777 130%)' }}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-sm font-bold uppercase tracking-wider text-white/90">💡 Today's prompt</span>
        <button onClick={onPlanDays} title="Change which series runs on which day" className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/20 text-white hover:bg-white/30">
          {weekday} · {series ? `${seriesEmoji(series)} ${series.name}` : 'Open day'}
        </button>
      </div>
      {!res && busy && <p className="text-sm text-white/80 sq-pulse">Reading today's trends…</p>}
      {err && !res && <p className="text-sm text-white">{err} <button onClick={() => fetchOne(seen)} className="underline">Try again</button></p>}
      {!res && !busy && !err && !trends && <p className="text-sm text-white/70">Waiting for trends…</p>}
      {res && (
        <>
          <p className="text-xl md:text-2xl font-semibold leading-snug">{res.prompt}</p>
          {res.trend && (
            <p className="text-[12px] text-white/80 mt-2.5">
              From {res.via === 'web' ? 'a web search' : 'trending now'}: {res.trend.url ? <a href={res.trend.url} target="_blank" rel="noopener" className="text-white underline decoration-white/50 hover:decoration-white">{res.trend.topic}</a> : res.trend.topic}{res.trend.source && res.via !== 'web' ? ` · ${res.trend.source}` : ''}{res.why ? ` · ${res.why}` : ''}
            </p>
          )}
          {!res.trend && <p className="text-[12px] text-white/70 mt-2.5">Nothing trending fit your beat today, so this one's just for the series.</p>}
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => onWrite(res.prompt, series?.id || null)} className="text-sm px-5 py-2.5 rounded-xl font-bold bg-white text-indigo-700 hover:bg-indigo-50 shadow whitespace-nowrap">Write this →</button>
            <button onClick={() => fetchOne(seen)} disabled={busy} className="text-sm px-3 py-2.5 rounded-xl text-white bg-white/15 hover:bg-white/25 whitespace-nowrap">{busy ? <span className="sq-pulse">Thinking…</span> : '🔄 Another'}</button>
          </div>
        </>
      )}
    </div>
  )
}
