'use client'

import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLATFORM_LIMITS, PLATFORM_META, countChars, markdownToSocial, formatTime, parseYmd, type Platform } from '../lib/text'
import type { Connection } from './Accounts'

interface Props { userId: string; connections: Connection[]; onDone: (scheduled: number) => void }

type Draft = { id: string; text: string; platforms: Record<Platform, boolean> }
const PLATFORMS = Object.keys(PLATFORM_META) as Platform[]
const uid = () => Math.random().toString(36).slice(2, 9)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function BatchComposer({ userId, connections, onDone }: Props) {
  const connected = Object.fromEntries(PLATFORMS.map((p) => [p, connections.some((c) => c.platform === p)])) as Record<Platform, boolean>
  const defaultPlatforms = PLATFORMS.some((p) => connected[p]) ? connected : { ...connected, threads: true }

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [raw, setRaw] = useState('')
  const [splitting, setSplitting] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d) })
  const [days, setDays] = useState(7)
  const [weekdays, setWeekdays] = useState<boolean[]>([false, true, true, true, true, true, false])
  const [times, setTimes] = useState<string[]>(['09:00', '12:30', '18:00'])
  const [overrides, setOverrides] = useState<Record<string, { date: string; time: string }>>({})
  const [saving, setSaving] = useState<null | 'schedule' | 'drafts'>(null)

  const minLimit = Math.min(...PLATFORMS.filter((p) => defaultPlatforms[p]).map((p) => PLATFORM_LIMITS[p]), 500)

  const splitManual = () => raw.split(/\n\s*\n|^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean)
  const toDrafts = (texts: string[]) => texts.map((text) => ({ id: uid(), text, platforms: { ...defaultPlatforms } }))

  const splitAI = async () => {
    setSplitting(true)
    try {
      const r = await fetch('/api/batch-split', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw, limit: minLimit }) })
      const d = await r.json()
      setDrafts(toDrafts(d.posts || splitManual())); setStep(2)
    } catch { setDrafts(toDrafts(splitManual())); setStep(2) }
    setSplitting(false)
  }

  // --- distribution ---
  const slots = useMemo(() => {
    const out: { date: string; time: string }[] = []
    const start = parseYmd(startDate)
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      if (!weekdays[d.getDay()]) continue
      for (const t of [...times].sort()) out.push({ date: ymd(d), time: t })
    }
    return out
  }, [startDate, days, weekdays, times])

  const assignments = useMemo(() => {
    const n = drafts.length
    if (!n || !slots.length) return [] as { date: string; time: string }[]
    if (n >= slots.length) return drafts.map((_, i) => slots[i % slots.length])
    // spread evenly across available slots
    return drafts.map((_, i) => slots[Math.round((i * (slots.length - 1)) / Math.max(1, n - 1))])
  }, [drafts, slots])

  const when = (d: Draft, i: number) => overrides[d.id] || assignments[i]

  const commit = async (status: 'scheduled' | 'draft') => {
    if (!drafts.length) return
    setSaving(status === 'scheduled' ? 'schedule' : 'drafts')
    const rows = drafts.map((d, i) => {
      const w = when(d, i)
      return {
        user_id: userId, kind: 'post', content: d.text, tone: 'casual', platforms: d.platforms, hashtags: [], image_urls: [], analysis: null,
        status, schedule_date: status === 'scheduled' ? w?.date ?? null : null, schedule_time: status === 'scheduled' ? w?.time ?? null : null,
      }
    })
    const { error } = await supabase.from('items').insert(rows)
    setSaving(null)
    if (error) { alert('Could not save: ' + error.message); return }
    setRaw(''); setDrafts([]); setOverrides({}); setStep(1)
    onDone(status === 'scheduled' ? rows.length : 0)
  }

  const StepPill = ({ n, label }: { n: 1 | 2 | 3; label: string }) => (
    <button onClick={() => n < step && setStep(n)} className={`flex items-center gap-2 text-sm ${step === n ? 'text-indigo-700 font-semibold' : n < step ? 'text-gray-600 hover:text-indigo-600' : 'text-gray-400'}`}>
      <span className={`h-6 w-6 rounded-full text-xs flex items-center justify-center ${step === n ? 'sq-tab-active' : n < step ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}>{n < step ? '✓' : n}</span>{label}
    </button>
  )

  return (
    <div className="space-y-5 sq-fade-in">
      <div className="flex items-center gap-5 flex-wrap"><StepPill n={1} label="Dump" /><span className="text-gray-300">→</span><StepPill n={2} label="Review" /><span className="text-gray-300">→</span><StepPill n={3} label="Spread & schedule" /></div>

      {step === 1 && (
        <div className="sq-card p-5 md:p-6 space-y-4">
          <div>
            <h3 className="font-semibold">Rattle off your thoughts</h3>
            <p className="text-sm text-gray-500">One idea per paragraph, or just stream it and let AI split it.</p>
          </div>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={14} placeholder={"The thing about coffee is…\n\nSomeone should make a…\n\nHot take: meetings are…"}
            className="w-full p-4 text-[15px] leading-relaxed border border-gray-200 rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-gray-400">{countChars(raw)} chars · {splitManual().length} paragraph{splitManual().length === 1 ? '' : 's'}</span>
            <span className="flex-1" />
            <button onClick={() => { setDrafts(toDrafts(splitManual())); setStep(2) }} disabled={!raw.trim()} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50">Use my paragraphs →</button>
            <button onClick={splitAI} disabled={!raw.trim() || splitting} className="sq-btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">{splitting ? <span className="sq-pulse">Splitting…</span> : '✨ Split with AI →'}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-gray-600"><strong>{drafts.length}</strong> post{drafts.length === 1 ? '' : 's'} · click text to edit</p>
            <span className="flex-1" />
            <button onClick={() => setDrafts([...drafts, { id: uid(), text: '', platforms: { ...defaultPlatforms } }])} className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">+ Add post</button>
            <button onClick={() => setStep(3)} disabled={!drafts.some((d) => d.text.trim())} className="sq-btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">Spread over time →</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {drafts.map((d, i) => {
              const social = markdownToSocial(d.text); const len = countChars(social)
              return (
                <div key={d.id} className="sq-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-400">#{i + 1}</span>
                    <span className="flex-1" />
                    {PLATFORMS.map((p) => (
                      <button key={p} onClick={() => setDrafts(drafts.map((x) => x.id === d.id ? { ...x, platforms: { ...x.platforms, [p]: !x.platforms[p] } } : x))}
                        title={connected[p] ? PLATFORM_META[p].label : `${PLATFORM_META[p].label} (not connected)`}
                        className={`h-6 min-w-6 px-1 rounded-full text-[10px] ${d.platforms[p] ? PLATFORM_META[p].color : 'bg-gray-100 text-gray-400'} ${connected[p] ? '' : 'opacity-50'}`}>{PLATFORM_META[p].icon}</button>
                    ))}
                    <button onClick={() => setDrafts(drafts.filter((x) => x.id !== d.id))} className="text-gray-400 hover:text-red-600 text-sm ml-1" aria-label="Remove">×</button>
                  </div>
                  <textarea value={d.text} onChange={(e) => setDrafts(drafts.map((x) => x.id === d.id ? { ...x, text: e.target.value } : x))} rows={Math.min(8, Math.max(2, d.text.split('\n').length + 1))}
                    className="w-full p-2 text-[14px] leading-relaxed border border-transparent hover:border-gray-200 focus:border-indigo-300 rounded-lg bg-transparent focus:bg-white focus:outline-none resize-y" />
                  <div className="flex gap-3 text-[11px]">
                    {PLATFORMS.filter((p) => d.platforms[p]).map((p) => <span key={p} className={len > PLATFORM_LIMITS[p] ? 'text-red-600 font-semibold' : 'text-gray-400'}>{PLATFORM_META[p].icon} {len}/{PLATFORM_LIMITS[p]}</span>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="sq-card p-5 space-y-4 lg:sticky lg:top-24 self-start">
            <h3 className="font-semibold">Spread</h3>
            <label className="block text-sm"><span className="text-gray-600">Start</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full h-10 px-2 border border-gray-200 rounded-lg" /></label>
            <label className="block text-sm"><span className="text-gray-600">Over</span>
              <div className="flex gap-2 mt-1">{[3, 7, 14, 30].map((n) => <button key={n} onClick={() => setDays(n)} className={`flex-1 h-9 rounded-lg text-sm ${days === n ? 'sq-tab-active' : 'bg-gray-100'}`}>{n}d</button>)}</div>
              <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="mt-2 w-full h-9 px-2 border border-gray-200 rounded-lg text-sm" />
            </label>
            <div className="text-sm"><span className="text-gray-600">Days</span>
              <div className="flex gap-1 mt-1">{DOW.map((d, i) => <button key={d} onClick={() => setWeekdays(weekdays.map((w, j) => j === i ? !w : w))} className={`flex-1 h-9 rounded-lg text-xs ${weekdays[i] ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{d}</button>)}</div>
            </div>
            <div className="text-sm"><span className="text-gray-600">Times each day</span>
              <div className="space-y-1.5 mt-1">
                {times.map((t, i) => <div key={i} className="flex gap-2"><input type="time" value={t} onChange={(e) => setTimes(times.map((x, j) => j === i ? e.target.value : x))} className="flex-1 h-9 px-2 border border-gray-200 rounded-lg" />{times.length > 1 && <button onClick={() => setTimes(times.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600 px-2">×</button>}</div>)}
                <button onClick={() => setTimes([...times, '15:00'])} className="text-xs text-indigo-600 hover:underline">+ add a time</button>
              </div>
            </div>
            <p className="text-xs text-gray-500">{slots.length} slot{slots.length === 1 ? '' : 's'} for {drafts.length} post{drafts.length === 1 ? '' : 's'}{drafts.length > slots.length ? ' — some slots get more than one' : ''}</p>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => commit('scheduled')} disabled={saving !== null || !slots.length} className="sq-btn-primary py-2.5 rounded-xl text-sm font-semibold">{saving === 'schedule' ? <span className="sq-pulse">Scheduling…</span> : `📅 Schedule all ${drafts.length}`}</button>
              <button onClick={() => commit('draft')} disabled={saving !== null} className="py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200">{saving === 'drafts' ? 'Saving…' : 'Save all as drafts instead'}</button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            {drafts.map((d, i) => {
              const w = when(d, i); const dt = w ? parseYmd(w.date) : null
              return (
                <div key={d.id} className="sq-card p-3 flex gap-3 items-start">
                  <div className="shrink-0 w-14 text-center rounded-lg py-1.5 bg-indigo-50 text-indigo-800">
                    <div className="text-[9px] uppercase font-semibold">{dt?.toLocaleString('default', { weekday: 'short' })}</div>
                    <div className="text-lg font-bold leading-none">{dt?.getDate()}</div>
                    <div className="text-[10px] mt-0.5">{formatTime(w?.time)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 line-clamp-3">{d.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {PLATFORMS.filter((p) => d.platforms[p]).map((p) => <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded-full ${PLATFORM_META[p].color}`}>{PLATFORM_META[p].icon}</span>)}
                      <span className="flex-1" />
                      <input type="date" value={w?.date || ''} onChange={(e) => setOverrides({ ...overrides, [d.id]: { date: e.target.value, time: w?.time || '09:00' } })} className="h-7 px-1.5 text-[11px] border border-gray-200 rounded-md" />
                      <input type="time" value={w?.time || ''} onChange={(e) => setOverrides({ ...overrides, [d.id]: { date: w?.date || startDate, time: e.target.value } })} className="h-7 px-1.5 text-[11px] border border-gray-200 rounded-md" />
                      {overrides[d.id] && <button onClick={() => { const o = { ...overrides }; delete o[d.id]; setOverrides(o) }} className="text-[11px] text-gray-400 hover:text-indigo-600">auto</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
