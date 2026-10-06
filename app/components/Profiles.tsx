'use client'

import { useEffect, useRef, useState } from 'react'
import { authedFetch } from '../lib/api'
import { PLATFORM_META, timeAgo, type Platform } from '../lib/text'
import type { Profile, ProfilePost } from '../api/profiles/route'

interface Props { onRepurpose: (text: string, platform: Platform) => void; onConnect: () => void }

const n = (v?: number) => (v == null ? '' : v >= 10000 ? `${(v / 1000).toFixed(1)}k` : String(v))
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number); const dt = new Date(y, m - 1, d); const now = new Date()
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - dt.getTime()) / 86400_000)
  if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday'
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(dt.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export default function Profiles({ onRepurpose, onConnect }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const jumpTo = (key: string) => {
    setFlash(key)
    for (const [platform, col] of Object.entries(colRefs.current)) {
      if (!col) continue
      const target = col.querySelector<HTMLElement>(`[data-day="${key}"]`)
      if (target) col.scrollTo({ top: target.offsetTop - col.offsetTop - 8, behavior: 'smooth' })
    }
    setTimeout(() => setFlash(null), 1800)
  }

  useEffect(() => {
    authedFetch('/api/profiles').then((r) => r.json()).then((d) => setProfiles(d.profiles || []))
  }, [])

  if (!profiles) return <div className="sq-card p-10 text-center text-gray-400 sq-pulse">Loading your profiles…</div>
  if (profiles.length === 0) return (
    <div className="sq-card p-10 text-center sq-fade-in">
      <p className="text-4xl mb-2">👤</p><p className="font-semibold">No accounts connected</p>
      <button onClick={onConnect} className="mt-3 sq-btn-primary px-4 py-2 rounded-lg text-sm font-semibold">Connect one →</button>
    </div>
  )

  const days = new Map<string, Partial<Record<Platform, number>>>()
  for (const pr of profiles) for (const p of pr.posts) {
    const k = dayKey(p.createdAt); const m = days.get(k) || {}
    m[pr.platform as Platform] = (m[pr.platform as Platform] || 0) + 1; days.set(k, m)
  }
  const dayList = Array.from(days.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="grid gap-5 sq-fade-in lg:[grid-template-columns:var(--cols)]" style={{ ["--cols" as any]: `repeat(${profiles.length}, minmax(0, 1fr)) 170px` }}>
      {profiles.map((cur) => {
        const meta = PLATFORM_META[cur.platform as Platform]
        return (
          <section key={cur.platform} className={`rounded-2xl p-3 sq-tint-${cur.platform} flex flex-col min-w-0`}>
            <div className="sq-card p-4 mb-3">
              <div className="flex items-start gap-3">
                {cur.avatar ? <img src={cur.avatar} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow shrink-0" /> : <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold leading-tight truncate">{cur.displayName || cur.handle}</h2>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
                  </div>
                  <a href={cur.url} target="_blank" rel="noopener" className="text-xs text-gray-500 hover:underline">@{cur.handle} ↗</a>
                </div>
              </div>
              {cur.bio && <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap line-clamp-2">{cur.bio}</p>}
              <div className="flex gap-3 mt-2 text-xs">
                {cur.postCount != null && <span><strong>{n(cur.postCount)}</strong> <span className="text-gray-500">posts</span></span>}
                {cur.followers != null && <span><strong>{n(cur.followers)}</strong> <span className="text-gray-500">followers</span></span>}
                {cur.following != null && <span><strong>{n(cur.following)}</strong> <span className="text-gray-500">following</span></span>}
              </div>
              {cur.error && <p className="text-xs text-red-600 mt-2">Couldn't load: {cur.error}</p>}
            </div>

            <div ref={(el) => { colRefs.current[cur.platform] = el }} className="sq-scroll overflow-y-auto pr-1 space-y-2 relative" style={{ maxHeight: '60vh' }}>
              {cur.posts.length === 0 && <p className="text-xs text-gray-400 px-1">No posts found.</p>}
              {cur.posts.map((p: ProfilePost) => (
                <div key={p.id} data-day={dayKey(p.createdAt)} className={`sq-card p-3 flex flex-col gap-1.5 transition ${flash && flash === dayKey(p.createdAt) ? 'ring-2 ring-indigo-400' : ''}`}>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    {p.label && <span className="text-gray-500">{p.label}</span>}
                    <span className="ml-auto">{timeAgo(p.createdAt)}</span>
                  </div>
                  {p.text && <p className="text-[13px] text-gray-800 whitespace-pre-wrap line-clamp-4">{p.text}</p>}
                  {!p.text && !p.image && <p className="text-xs text-gray-400 italic">No text or media returned</p>}
                  {p.image && <img src={p.image} alt="" className="w-full rounded-lg object-cover max-h-36" />}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 pt-0.5">
                    {p.likes != null && <span>♡ {n(p.likes)}</span>}
                    {p.replies != null && <span>💬 {n(p.replies)}</span>}
                    {p.reposts != null && <span>↻ {n(p.reposts)}</span>}
                    <span className="flex-1" />
                    {p.text && <button onClick={() => onRepurpose(p.text, cur.platform as Platform)} className="text-indigo-600 hover:underline">Repurpose</button>}
                    <a href={p.url} target="_blank" rel="noopener" className="hover:underline">Open ↗</a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <section className="rounded-2xl p-3 sq-neutral flex flex-col min-w-0">
        <div className="px-1 pb-3">
          <h2 className="font-bold text-sm">Timeline</h2>
          <p className="text-[11px] text-gray-500">Click a day to jump</p>
        </div>
        <div className="sq-scroll overflow-y-auto pr-1 relative" style={{ maxHeight: '60vh' }}>
          <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gradient-to-b from-indigo-300 via-purple-200 to-transparent" />
          <ol className="space-y-1">
            {dayList.map(([key, counts]) => (
              <li key={key} className="relative pl-6">
                <span className={`absolute left-[5px] top-2.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${flash === key ? 'bg-indigo-600 scale-125' : 'bg-indigo-400'} transition`} />
                <button onClick={() => jumpTo(key)} className={`w-full text-left rounded-lg px-2 py-1.5 transition ${flash === key ? 'bg-indigo-100' : 'hover:bg-indigo-50'}`}>
                  <div className="text-xs font-semibold text-gray-800 leading-tight">{dayLabel(key)}</div>
                  <div className="flex gap-1 mt-1">
                    {(Object.entries(counts) as [Platform, number][]).map(([pl, c]) => (
                      <span key={pl} className={`text-[9px] px-1.5 py-0.5 rounded-full ${PLATFORM_META[pl].color}`} title={`${c} on ${PLATFORM_META[pl].label}`}>{PLATFORM_META[pl].icon}{c > 1 ? ` ${c}` : ''}</span>
                    ))}
                  </div>
                </button>
              </li>
            ))}
            {dayList.length === 0 && <li className="text-xs text-gray-400 pl-6">Nothing published yet.</li>}
          </ol>
        </div>
      </section>
    </div>
  )
}
