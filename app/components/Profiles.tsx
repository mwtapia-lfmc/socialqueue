'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '../lib/api'
import { PLATFORM_META, timeAgo, type Platform } from '../lib/text'
import type { Profile, ProfilePost } from '../api/profiles/route'

interface Props { onRepurpose: (text: string, platform: Platform) => void; onConnect: () => void }

const n = (v?: number) => (v == null ? '' : v >= 10000 ? `${(v / 1000).toFixed(1)}k` : String(v))

export default function Profiles({ onRepurpose, onConnect }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    authedFetch('/api/profiles').then((r) => r.json()).then((d) => {
      const ps: Profile[] = d.profiles || []
      setProfiles(ps); setActive((a) => a ?? ps[0]?.platform ?? null)
    })
  }, [])

  if (!profiles) return <div className="sq-card p-10 text-center text-gray-400 sq-pulse">Loading your profiles…</div>
  if (profiles.length === 0) return (
    <div className="sq-card p-10 text-center sq-fade-in">
      <p className="text-4xl mb-2">👤</p><p className="font-semibold">No accounts connected</p>
      <button onClick={onConnect} className="mt-3 sq-btn-primary px-4 py-2 rounded-lg text-sm font-semibold">Connect one →</button>
    </div>
  )

  const cur = profiles.find((p) => p.platform === active) || profiles[0]
  const meta = PLATFORM_META[cur.platform as Platform]

  return (
    <div className="grid lg:grid-cols-4 gap-6 sq-fade-in">
      <div className="space-y-3">
        {profiles.map((p) => {
          const m = PLATFORM_META[p.platform as Platform]
          return (
            <button key={p.platform} onClick={() => setActive(p.platform)}
              className={`sq-card w-full text-left p-4 flex items-center gap-3 transition ${active === p.platform ? 'ring-2 ring-indigo-300' : ''}`}>
              {p.avatar ? <img src={p.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />}
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.displayName || p.handle}</p>
                <p className="text-xs text-gray-500 truncate">{m.icon} @{p.handle}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="lg:col-span-3 space-y-5">
        <div className="sq-card p-6 flex flex-wrap gap-5 items-start">
          {cur.avatar ? <img src={cur.avatar} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-white shadow" /> : <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{cur.displayName || cur.handle}</h2>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
            </div>
            <a href={cur.url} target="_blank" rel="noopener" className="text-sm text-gray-500 hover:underline">@{cur.handle} ↗</a>
            {cur.bio && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{cur.bio}</p>}
            <div className="flex gap-5 mt-3 text-sm">
              {cur.postCount != null && <span><strong>{n(cur.postCount)}</strong> <span className="text-gray-500">posts</span></span>}
              {cur.followers != null && <span><strong>{n(cur.followers)}</strong> <span className="text-gray-500">followers</span></span>}
              {cur.following != null && <span><strong>{n(cur.following)}</strong> <span className="text-gray-500">following</span></span>}
            </div>
            {cur.error && <p className="text-xs text-red-600 mt-2">Couldn't load: {cur.error}</p>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Published on {meta.label} · {cur.posts.length}</h3>
          {cur.posts.length === 0 ? <p className="text-sm text-gray-400">No posts found.</p> : (
            <div className="grid md:grid-cols-2 gap-3">
              {cur.posts.map((p: ProfilePost) => (
                <div key={p.id} className="sq-card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {cur.avatar ? <img src={cur.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-gray-200" />}
                    <span className="text-xs font-semibold">{cur.displayName || cur.handle}</span>
                    <span className="text-[11px] text-gray-400">· {timeAgo(p.createdAt)}</span>
                  </div>
                  {p.label && <span className="text-[11px] text-gray-500">{p.label}</span>}
                  {p.text && <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-6">{p.text}</p>}
                  {!p.text && !p.image && <p className="text-sm text-gray-400 italic">No text or media returned for this post</p>}
                  {p.image && <img src={p.image} alt="" className="w-full rounded-lg object-cover max-h-56" />}
                  <div className="flex items-center gap-4 text-[11px] text-gray-500 mt-auto pt-1">
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
          )}
        </div>
      </div>
    </div>
  )
}
