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
  onWrite: (prompt: string, seriesId: string | null, text?: string) => void
  onPlanDays: () => void
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

export default function DailyPrompt({ series, trends, onWrite, onPlanDays }: Props) {
  const key = `sq:daily:${today()}:${series?.id || 'open'}`
  const [res, setRes] = useState<Result | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [text, setText] = useState('')
  useEffect(() => { try { setText(localStorage.getItem('sq:daily-draft') || '') } catch {} }, [])
  const setDraft = (t: string) => { setText(t); try { t ? localStorage.setItem('sq:daily-draft', t) : localStorage.removeItem('sq:daily-draft') } catch {} }
  const write = () => { if (!res) return; onWrite(res.prompt, series?.id || null, text); setDraft('') }
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
    <div className="rounded-2xl p-5 md:p-7 text-gray-900 shadow-xl shadow-indigo-500/20 ring-1 ring-white/60" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.5) 0%, rgba(124,58,237,0.5) 60%, rgba(219,39,119,0.5) 130%)' }}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-sm font-bold uppercase tracking-wider text-gray-900/80">💡 Today's prompt</span>
        <button onClick={onPlanDays} title="Change which series runs on which day" className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/60 text-gray-800 hover:bg-white/90">
          {weekday} · {series ? `${seriesEmoji(series)} ${series.name}` : 'Open day'}
        </button>
      </div>
      {!res && busy && <p className="text-sm text-gray-700 sq-pulse">Reading today's trends…</p>}
      {err && !res && <p className="text-sm text-red-700">{err} <button onClick={() => fetchOne(seen)} className="underline">Try again</button></p>}
      {!res && !busy && !err && !trends && <p className="text-sm text-gray-600">Waiting for trends…</p>}
      {res && (
        <>
          <p className="text-xl md:text-2xl font-semibold leading-snug text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25), 0 2px 10px rgba(0,0,0,0.15)' }}>{res.prompt}</p>
          {res.trend && (
            <p className="text-[12px] text-gray-700 mt-2.5">
              From {res.via === 'web' ? 'a web search' : 'trending now'}: {res.trend.url ? <a href={res.trend.url} target="_blank" rel="noopener" className="text-indigo-800 underline hover:text-indigo-900">{res.trend.topic}</a> : res.trend.topic}{res.trend.source && res.via !== 'web' ? ` · ${res.trend.source}` : ''}{res.why ? ` · ${res.why}` : ''}
            </p>
          )}
          {!res.trend && <p className="text-[12px] text-gray-600 mt-2.5">Nothing trending fit your beat today, so this one's just for the series.</p>}
          <textarea value={text} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Start typing here…"
            className="mt-4 w-full p-3 text-[15px] rounded-xl bg-white/80 border border-white/70 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white resize-none" />
          <div className="flex items-center gap-2 mt-2.5">
            <button onClick={write} className="sq-btn-primary text-sm px-5 py-2.5 rounded-xl font-bold shadow whitespace-nowrap">{text.trim() ? 'Continue in composer →' : 'Write this →'}</button>
            <button onClick={() => fetchOne(seen)} disabled={busy} className="text-sm px-3 py-2.5 rounded-xl text-gray-800 bg-white/60 hover:bg-white/90 whitespace-nowrap">{busy ? <span className="sq-pulse">Thinking…</span> : '🔄 Another'}</button>
          </div>
        </>
      )}
    </div>
  )
}
