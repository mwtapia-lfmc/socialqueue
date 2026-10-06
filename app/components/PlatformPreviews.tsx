'use client'

import { useEffect, useRef, useState } from 'react'
import { PLATFORM_LIMITS, PLATFORM_META, countChars, type Platform } from '../lib/text'
import { RATIOS, PLATFORM_RATIO } from '../lib/images'

export interface Identity { handle: string; avatar?: string; displayName?: string }

interface Props {
  accounts: Partial<Record<Platform, Identity>>
  selected: Record<Platform, boolean>
  onToggle: (platform: Platform) => void
  baseText: string
  overrides: Record<string, string>
  image?: string
  onOverride: (platform: Platform, text: string | null) => void
}

const SKIN: Record<Platform, { name: string; handle: string; bg: string; text: string; sub: string; actions: string[] }> = {
  threads: { name: 'you', handle: '1m', bg: 'bg-white', text: 'text-gray-900', sub: 'text-gray-400', actions: ['♡', '○', '↻', '➤'] },
  twitter: { name: 'You', handle: '@you · 1m', bg: 'bg-white', text: 'text-gray-900', sub: 'text-gray-500', actions: ['💬', '↻', '♡', '📊', '↗'] },
  bluesky: { name: 'You', handle: '@you.bsky.social · 1m', bg: 'bg-white', text: 'text-gray-900', sub: 'text-gray-500', actions: ['💬', '↻', '♡', '⋯'] },
  linkedin: { name: 'You', handle: 'Your headline · 1m', bg: 'bg-white', text: 'text-gray-900', sub: 'text-gray-500', actions: ['👍 Like', '💬 Comment', '↻ Repost', '➤ Send'] },
}

const ALL = Object.keys(PLATFORM_META) as Platform[]

export default function PlatformPreviews({ accounts, selected, onToggle, baseText, overrides, image, onOverride }: Props) {
  const [editing, setEditing] = useState<Platform | null>(null)
  const [buffer, setBuffer] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.setSelectionRange(buffer.length, buffer.length) } }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (p: Platform) => { setBuffer(overrides[p] ?? baseText); setEditing(p) }
  const commit = () => {
    if (!editing) return
    onOverride(editing, buffer === baseText ? null : buffer)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      {ALL.map((p) => {
        const on = !!selected[p]
        const acct = accounts[p]
        const skin = SKIN[p]
        const meta = PLATFORM_META[p]
        const custom = p in overrides
        const text = custom ? overrides[p] : baseText
        const len = countChars(text)
        const limit = PLATFORM_LIMITS[p]
        const r = RATIOS[PLATFORM_RATIO[p]]
        const isEditing = editing === p
        const lenCls = len > limit ? 'text-red-600 font-semibold' : len > limit * 0.9 ? 'text-amber-600' : 'text-gray-400'
        return (
          <div key={p} className={`rounded-2xl border transition ${isEditing ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'} ${skin.bg} overflow-hidden sq-fade-in ${on ? '' : 'opacity-55 grayscale-[0.4]'}`}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
              <button type="button" onClick={() => onToggle(p)} title={on ? 'Click to skip this platform' : 'Click to post here'}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border transition ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-gray-300'}`} />{on ? 'Posting' : 'Off'}
              </button>
              {custom && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">Customized</span>}
              <span className="flex-1" />
              <span className={`text-[11px] ${lenCls}`}>{len}/{limit}</span>
              {custom && !isEditing && <button type="button" onClick={() => onOverride(p, null)} className="text-[11px] text-gray-500 hover:text-red-600">Reset</button>}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {acct?.avatar
                  ? <img src={acct.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0 border border-gray-100" />
                  : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shrink-0" />}
                <div className="leading-tight min-w-0">
                  <p className={`text-sm font-semibold truncate ${skin.text}`}>{acct?.displayName || acct?.handle || skin.name}</p>
                  <p className={`text-[11px] truncate ${skin.sub}`}>{acct ? `@${acct.handle} · now` : skin.handle}</p>
                </div>
                {!acct && <span className="ml-auto text-[10px] text-gray-400 shrink-0">not connected</span>}
              </div>
              {isEditing ? (
                <>
                  <textarea ref={ref} value={buffer} onChange={(e) => setBuffer(e.target.value)} rows={Math.min(12, Math.max(3, buffer.split('\n').length + 1))}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit() }}
                    className={`w-full text-[15px] leading-relaxed ${skin.text} bg-indigo-50/40 rounded-lg p-2 border border-indigo-200 focus:outline-none resize-y`} />
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-gray-400">Edits here apply to {meta.label} only</span>
                    <span className="flex-1" />
                    <button type="button" onClick={() => setEditing(null)} className="text-xs px-2.5 py-1 rounded-lg text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={commit} className="sq-btn-primary text-xs px-3 py-1 rounded-lg font-semibold">Done</button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={() => begin(p)} title={`Click to edit the ${meta.label} version`}
                  className={`w-full text-left text-[15px] leading-relaxed whitespace-pre-wrap break-words ${skin.text} min-h-6 rounded-lg -m-1 p-1 hover:bg-indigo-50/60 cursor-text`}>
                  {text || <span className="text-gray-300">Your post will appear here…</span>}
                </button>
              )}
              {image && <img src={image} alt="" className="w-full rounded-xl mt-3 object-cover border border-gray-100 max-h-80" />}
              <div className={`flex gap-6 mt-3 text-sm ${skin.sub}`}>{skin.actions.map((a, i) => <span key={i}>{a}</span>)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
