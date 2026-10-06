'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '../lib/api'
import type { TrendSource, Trend } from '../api/trends/route'
import type { Profile } from '../api/profiles/route'

interface Props { profiles: Profile[] | null; onWrite: (text: string) => void }

export default function Trends({ profiles, onWrite }: Props) {
  const [sources, setSources] = useState<TrendSource[] | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [angles, setAngles] = useState<Record<string, string[] | 'loading'>>({})

  const load = async () => {
    setLoading(true)
    const r = await authedFetch('/api/trends')
    if (r.ok) { const d = await r.json(); setSources(d.sources); setNote(d.note) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const voiceSamples = (profiles || []).flatMap((p) => p.posts.map((x) => x.text).filter(Boolean)).slice(0, 6)

  const getAngles = async (t: Trend) => {
    setAngles((a) => ({ ...a, [t.topic]: 'loading' }))
    const r = await fetch('/api/trend-angles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: t.topic, detail: t.detail, voiceSamples }) })
    const d = await r.json()
    setAngles((a) => ({ ...a, [t.topic]: d.angles || [] }))
  }

  if (!sources) return <div className="sq-card p-10 text-center text-gray-400 sq-pulse">Checking what's trending…</div>

  return (
    <div className="space-y-4 sq-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-gray-600">{note}</p>
        <span className="flex-1" />
        <button onClick={load} disabled={loading} className={`sq-tool h-8 px-3 rounded-full text-xs ${loading ? 'sq-pulse' : ''}`}>↻ Refresh</button>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {sources.map((src) => (
          <section key={src.key} className={`rounded-2xl p-3 flex flex-col min-w-0 ${src.key === 'bluesky' ? 'sq-tint-bluesky' : src.key === 'twitter' ? 'sq-tint-twitter' : 'sq-neutral'}`}>
            <div className="px-1 pb-2">
              <h2 className="font-bold flex items-center gap-2"><span>{src.icon}</span>{src.label}</h2>
              <p className="text-[11px] text-gray-500">{src.blurb}</p>
            </div>
            {src.needs ? <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{src.needs}</p>
            : src.error ? <p className="text-xs text-red-700 bg-red-50 rounded-lg p-3">Couldn't load: {src.error}</p>
            : src.trends.length === 0 ? <p className="text-xs text-gray-400 px-1">Nothing returned.</p> : (
              <ol className="sq-scroll overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: '62vh' }}>
                {src.trends.map((t, i) => {
                  const a = angles[t.topic]
                  return (
                    <li key={i} className="sq-card p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] font-bold text-gray-300 w-5 shrink-0 pt-0.5">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{t.url ? <a href={t.url} target="_blank" rel="noopener" className="hover:text-indigo-700">{t.topic}</a> : t.topic}</p>
                          {t.detail && <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{t.detail}</p>}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => onWrite(`${t.topic}\n\n`)} className="text-[11px] px-2 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-700">Write about this</button>
                            <button onClick={() => getAngles(t)} disabled={a === 'loading'} className="text-[11px] px-2 py-1 rounded-md bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-50">{a === 'loading' ? <span className="sq-pulse">Thinking…</span> : '✨ AI angles'}</button>
                          </div>
                          {Array.isArray(a) && a.length > 0 && (
                            <div className="mt-2 space-y-1.5 sq-fade-in">
                              {a.map((line, j) => (
                                <button key={j} onClick={() => onWrite(line)} className="block w-full text-left text-[12px] text-gray-800 bg-purple-50/70 hover:bg-purple-100 rounded-lg px-2.5 py-2 leading-snug">{line}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
