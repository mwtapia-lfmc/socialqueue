'use client'

import { useState } from 'react'
import { authedFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { PLATFORM_META, type Platform } from '../lib/text'

export interface Connection { id: string; platform: string; handle: string; account_id: string | null; created_at: string; avatar?: string; displayName?: string }

interface Props { connections: Connection[]; onChange: () => void }

const HINT: Record<string, string> = {
  threads: 'To add a different Threads account, log into it on threads.com first (it must also be a Threads Tester on your Meta app), then connect.',
  twitter: 'To add a different X account, log into it on x.com first, then connect.',
  linkedin: 'To add a different LinkedIn account, log into it on linkedin.com first, then connect.',
  bluesky: 'Each Bluesky account needs its own app password.',
}

export default function Accounts({ connections, onChange }: Props) {
  const [adding, setAdding] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [thToken, setThToken] = useState('')

  const oauth = async (path: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return alert('Sign in first')
    window.location.href = `${path}?jwt=${encodeURIComponent(session.access_token)}`
  }

  const post = async (body: object, done: () => void) => {
    setBusy(true); setErr(null)
    const r = await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify(body) })
    const data = await r.json()
    setBusy(false)
    if (!r.ok) { setErr(data.error); return }
    done(); setAdding(null); onChange()
  }

  const disconnect = async (c: Connection) => {
    if (!confirm(`Disconnect @${c.handle} on ${PLATFORM_META[c.platform as Platform]?.label || c.platform}?`)) return
    await authedFetch('/api/connections', { method: 'DELETE', body: JSON.stringify({ id: c.id }) })
    onChange()
  }

  const Platform = ({ p, children }: { p: Platform; children: React.ReactNode }) => {
    const mine = connections.filter((c) => c.platform === p)
    const open = adding === p || mine.length === 0
    const meta = PLATFORM_META[p]
    return (
      <div className="sq-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${meta.color}`}>{meta.icon}</span>
          <h3 className="font-semibold">{meta.label}</h3>
          {mine.length > 0 && <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{mine.length} connected</span>}
        </div>

        {mine.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/70 border border-gray-100 p-2.5">
            {c.avatar ? <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold truncate">{c.displayName || c.handle}</p>
              <p className="text-[11px] text-gray-500 truncate">@{c.handle}</p>
            </div>
            <button onClick={() => disconnect(c)} className="text-xs text-red-600 hover:underline shrink-0">Remove</button>
          </div>
        ))}

        {open ? (
          <div className="space-y-2">
            {mine.length > 0 && <p className="text-[11px] text-gray-500">{HINT[p]}</p>}
            {children}
            {mine.length > 0 && <button onClick={() => { setAdding(null); setErr(null) }} className="text-xs text-gray-500 hover:underline">Cancel</button>}
          </div>
        ) : (
          <button onClick={() => { setAdding(p); setErr(null) }} className="w-full py-2 rounded-lg text-sm font-medium border-2 border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600">+ Add another account</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sq-fade-in">
      <p className="text-sm text-gray-600">Connect as many accounts as you like on each platform. When you compose, pick which account each platform posts from.</p>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Platform p="bluesky">
          <p className="text-xs text-gray-500">Bluesky → Settings → Privacy &amp; Security → App Passwords.</p>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourname.bsky.social" className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" />
          <input value={appPassword} onChange={(e) => setAppPassword(e.target.value)} type="password" placeholder="xxxx-xxxx-xxxx-xxxx" className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" />
          {err && adding !== 'threads' && <p className="text-xs text-red-600">{err}</p>}
          <button onClick={() => post({ platform: 'bluesky', handle, appPassword }, () => { setHandle(''); setAppPassword('') })} disabled={busy || !handle || !appPassword} className="sq-btn-primary w-full py-2 rounded-lg text-sm font-semibold">{busy ? <span className="sq-pulse">Verifying…</span> : 'Connect Bluesky'}</button>
          <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener" className="block text-xs text-sky-600 hover:underline">Open Bluesky app passwords ↗</a>
        </Platform>

        <Platform p="threads">
          <button onClick={() => oauth('/api/auth/threads')} className="sq-btn-primary w-full py-2 rounded-lg text-sm font-semibold">Connect Threads</button>
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">Or paste an access token</summary>
            <p className="mt-2">Meta app → Use cases → Threads → Settings → <strong>Generate Access Token</strong> next to the account.</p>
            <input value={thToken} onChange={(e) => setThToken(e.target.value)} type="password" placeholder="THAA…" className="mt-2 w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400" />
            {err && (adding === 'threads' || connections.every((c) => c.platform !== 'threads')) && <p className="text-xs text-red-600 mt-1">{err}</p>}
            <button onClick={() => post({ platform: 'threads', accessToken: thToken }, () => setThToken(''))} disabled={busy || !thToken} className="mt-2 w-full py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">{busy ? <span className="sq-pulse">Verifying…</span> : 'Connect with token'}</button>
          </details>
        </Platform>

        <Platform p="twitter">
          <p className="text-xs text-gray-500">Logs you into X and asks permission to post.</p>
          <button onClick={() => oauth('/api/auth/x')} className="w-full py-2 rounded-lg text-sm font-semibold bg-black text-white hover:bg-gray-800">Connect X</button>
        </Platform>

        <Platform p="linkedin">
          <p className="text-xs text-gray-500">Logs you into LinkedIn and asks permission to share posts to your profile.</p>
          <button onClick={() => oauth('/api/auth/linkedin')} className="w-full py-2 rounded-lg text-sm font-semibold bg-[#0a66c2] text-white hover:brightness-110">Connect LinkedIn</button>
        </Platform>
      </div>
    </div>
  )
}
