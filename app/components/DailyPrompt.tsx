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
    <div className="sq-card p-4 md:p-5 border-amber-200 bg-gradient-to-br from-amber-50/80 to-white">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-sm font-semibold text-amber-900">💡 Today's prompt</span>
        <button onClick={onPlanDays} title="Change which series runs on which day" className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800 hover:bg-amber-100">
          {weekday} · {series ? `${seriesEmoji(series)} ${series.name}` : 'Open day'}
        </button>
      </div>
      {!res && busy && <p className="text-sm text-amber-800/70 sq-pulse">Reading today's trends…</p>}
      {err && !res && <p className="text-sm text-red-600">{err} <button onClick={() => fetchOne(seen)} className="underline">Try again</button></p>}
      {!res && !busy && !err && !trends && <p className="text-sm text-gray-400">Waiting for trends…</p>}
      {res && (
        <>
          <p className="text-[16px] leading-relaxed text-gray-900">{res.prompt}</p>
          {res.trend && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              From {res.via === 'web' ? 'a web search' : 'trending now'}: {res.trend.url ? <a href={res.trend.url} target="_blank" rel="noopener" className="text-indigo-600 hover:underline">{res.trend.topic}</a> : res.trend.topic}{res.trend.source && res.via !== 'web' ? ` · ${res.trend.source}` : ''}{res.why ? ` · ${res.why}` : ''}
            </p>
          )}
          {!res.trend && <p className="text-[11px] text-gray-400 mt-1.5">Nothing trending fit your beat today, so this one's just for the series.</p>}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => onWrite(res.prompt, series?.id || null)} className="sq-btn-primary text-sm px-4 py-2 rounded-lg font-semibold whitespace-nowrap">Write this →</button>
            <button onClick={() => fetchOne(seen)} disabled={busy} className="text-sm px-3 py-2 rounded-lg text-amber-900 bg-white border border-amber-200 hover:bg-amber-100 whitespace-nowrap">{busy ? <span className="sq-pulse">Thinking…</span> : '🔄 Another'}</button>
          </div>
        </>
      )}
    </div>
  )
}
