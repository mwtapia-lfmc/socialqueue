'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '../lib/api'
import { PLATFORM_META, timeAgo, type Platform } from '../lib/text'
import type { Profile, ProfilePost } from '../api/profiles/route'

interface Props { onRepurpose: (text: string, platform: Platform) => void; onConnect: () => void }

const n = (v?: number) => (v == null ? '' : v >= 10000 ? `${(v / 1000).toFixed(1)}k` : String(v))

export default function Profiles({ onRepurpose, onConnect }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)

  useEffect(() => {
    authedFetch('/api/profiles').then((r) => r.json()).then((d) => {
      const ps: Profile[] = d.profiles || []
      setProfiles(ps)
    })
  }, [])

  if (!profiles) return <div className="sq-card p-10 text-center text-gray-400 sq-pulse">Loading your profiles…</div>
  if (profiles.length === 0) return (
    <div className="sq-card p-10 text-center sq-fade-in">
      <p className="text-4xl mb-2">👤</p><p className="font-semibold">No accounts connected</p>
      <button onClick={onConnect} className="mt-3 sq-btn-primary px-4 py-2 rounded-lg text-sm font-semibold">Connect one →</button>
    </div>
  )

  const cols = profiles.length
  return (
    <div className={`grid gap-5 sq-fade-in ${cols >= 3 ? 'lg:grid-cols-3' : cols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-2xl'}`}>
      {profiles.map((cur) => {
        const meta = PLATFORM_META[cur.platform as Platform]
        return (
          <div key={cur.platform} className="space-y-4 min-w-0">
            <div className="sq-card p-5">
              <div className="flex items-start gap-3">
                {cur.avatar ? <img src={cur.avatar} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-white shadow shrink-0" /> : <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold leading-tight truncate">{cur.displayName || cur.handle}</h2>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
                  </div>
                  <a href={cur.url} target="_blank" rel="noopener" className="text-sm text-gray-500 hover:underline">@{cur.handle} ↗</a>
                </div>
              </div>
              {cur.bio && <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap line-clamp-4">{cur.bio}</p>}
              {(cur.postCount != null || cur.followers != null) && (
                <div className="flex gap-4 mt-3 text-sm">
                  {cur.postCount != null && <span><strong>{n(cur.postCount)}</strong> <span className="text-gray-500">posts</span></span>}
                  {cur.followers != null && <span><strong>{n(cur.followers)}</strong> <span className="text-gray-500">followers</span></span>}
                  {cur.following != null && <span><strong>{n(cur.following)}</strong> <span className="text-gray-500">following</span></span>}
                </div>
              )}
              {cur.error && <p className="text-xs text-red-600 mt-2">Couldn't load: {cur.error}</p>}
            </div>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Published · {cur.posts.length}</h3>
            {cur.posts.length === 0 ? <p className="text-sm text-gray-400 px-1">No posts found.</p> : (
              <div className="space-y-3">
                {cur.posts.map((p: ProfilePost) => (
                  <div key={p.id} className="sq-card p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {cur.avatar ? <img src={cur.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-gray-200" />}
                      <span className="text-xs font-semibold truncate">{cur.displayName || cur.handle}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">· {timeAgo(p.createdAt)}</span>
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
        )
      })}
    </div>
  )
}
