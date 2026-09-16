'use client'

import { useState } from 'react'
import { authedFetch } from '../lib/api'

export interface Connection { id: string; platform: string; handle: string; account_id: string | null; created_at: string }

interface Props { connections: Connection[]; onChange: () => void }

export default function Accounts({ connections, onChange }: Props) {
  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const bluesky = connections.find((c) => c.platform === 'bluesky')

  const connect = async () => {
    setBusy(true); setErr(null)
    const r = await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ platform: 'bluesky', handle, appPassword }) })
    const data = await r.json()
    setBusy(false)
    if (!r.ok) { setErr(data.error); return }
    setHandle(''); setAppPassword('')
    onChange()
  }
  const disconnect = async (platform: string) => {
    if (!confirm(`Disconnect ${platform}?`)) return
    await authedFetch('/api/connections', { method: 'DELETE', body: JSON.stringify({ platform }) })
    onChange()
  }

  return (
    <div className="grid md:grid-cols-3 gap-4 sq-fade-in">
      <div className="sq-card p-5 space-y-3">
        <div className="flex items-center gap-2"><span className="text-2xl">🦋</span><h3 className="font-semibold">Bluesky</h3>
          {bluesky && <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Connected</span>}</div>
        {bluesky ? (
          <>
            <p className="text-sm text-gray-700">@{bluesky.handle}</p>
            <p className="text-xs text-gray-500">Scheduled posts publish here automatically.</p>
            <button onClick={() => disconnect('bluesky')} className="text-sm text-red-600 hover:underline">Disconnect</button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500">Create an app password at Bluesky → Settings → Privacy &amp; Security → App Passwords, then paste it here. Your main password is never used.</p>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourname.bsky.social" className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" />
            <input value={appPassword} onChange={(e) => setAppPassword(e.target.value)} type="password" placeholder="xxxx-xxxx-xxxx-xxxx" className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400" />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button onClick={connect} disabled={busy || !handle || !appPassword} className="sq-btn-primary w-full py-2 rounded-lg text-sm font-semibold">{busy ? <span className="sq-pulse">Verifying…</span> : 'Connect Bluesky'}</button>
            <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener" className="block text-xs text-sky-600 hover:underline">Open Bluesky app passwords ↗</a>
          </>
        )}
      </div>

      <div className="sq-card p-5 space-y-2 opacity-90">
        <div className="flex items-center gap-2"><span className="text-2xl">𝕏</span><h3 className="font-semibold">X / Twitter</h3><span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Next up</span></div>
        <p className="text-xs text-gray-500">Needs an X developer app (free tier allows posting). Once you have a Client ID and Secret from developer.x.com, connecting is a one-click OAuth login here.</p>
      </div>

      <div className="sq-card p-5 space-y-2 opacity-90">
        <div className="flex items-center gap-2"><span className="text-2xl">🧵</span><h3 className="font-semibold">Threads</h3><span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending Meta</span></div>
        <p className="text-xs text-gray-500">Waiting on Meta to approve the Threads API app. Check developers.facebook.com — once approved, this becomes a one-click login.</p>
      </div>
    </div>
  )
}
