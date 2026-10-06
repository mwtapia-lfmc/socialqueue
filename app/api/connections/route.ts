import { AtpAgent } from '@atproto/api'
import { userClient } from '../../lib/supabaseServer'

async function fetchProfile(conn: any): Promise<{ avatar?: string; displayName?: string } | null> {
  try {
    if (conn.platform === 'bluesky') {
      const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(conn.handle)}`)
      const j = await r.json()
      return { avatar: j.avatar, displayName: j.displayName }
    }
    if (conn.platform === 'threads') {
      const r = await fetch(`https://graph.threads.net/v1.0/me?fields=username,name,threads_profile_picture_url&access_token=${encodeURIComponent(conn.credentials.accessToken)}`)
      const j = await r.json()
      return { avatar: j.threads_profile_picture_url, displayName: j.name || j.username }
    }
  } catch {}
  return null
}

export async function GET(request: Request) {
  const db = userClient(request)
  const { data, error } = await db.from('connections').select('id, platform, handle, account_id, credentials, created_at')
  if (error) return Response.json({ error: error.message }, { status: 401 })

  const out = []
  for (const c of data || []) {
    let { avatar, displayName, profileAt } = c.credentials || {}
    const stale = !profileAt || Date.now() - new Date(profileAt).getTime() > 86400_000
    if (stale) {
      const p = await fetchProfile(c)
      if (p) {
        avatar = p.avatar; displayName = p.displayName
        await db.from('connections').update({ credentials: { ...c.credentials, avatar, displayName, profileAt: new Date().toISOString() } }).eq('id', c.id)
      }
    }
    out.push({ id: c.id, platform: c.platform, handle: c.handle, account_id: c.account_id, created_at: c.created_at, avatar, displayName })
  }
  return Response.json({ connections: out })
}

export async function POST(request: Request) {
  const db = userClient(request)
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { platform, handle, appPassword, accessToken } = await request.json()

  if (platform === 'threads') {
    if (!accessToken) return Response.json({ error: 'Access token required' }, { status: 400 })
    const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken.trim())}`)
    const me = await meRes.json()
    if (!me.id) return Response.json({ error: 'Threads rejected the token: ' + (me.error?.message || 'check that you copied the whole thing') }, { status: 400 })
    const expiresAt = new Date(Date.now() + 60 * 86400_000).toISOString()
    const { error } = await db.from('connections').upsert(
      { user_id: user.id, platform, handle: me.username, account_id: me.id, credentials: { accessToken: accessToken.trim(), expiresAt } },
      { onConflict: 'user_id,platform' }
    )
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, handle: me.username })
  }

  if (platform !== 'bluesky') return Response.json({ error: 'This platform cannot be connected yet' }, { status: 400 })
  if (!handle || !appPassword) return Response.json({ error: 'Handle and app password required' }, { status: 400 })

  const agent = new AtpAgent({ service: 'https://bsky.social' })
  try {
    await agent.login({ identifier: handle.replace(/^@/, ''), password: appPassword })
  } catch (e: any) {
    return Response.json({ error: 'Bluesky rejected the login: ' + (e?.message || 'check handle and app password') }, { status: 400 })
  }

  const { error } = await db.from('connections').upsert(
    { user_id: user.id, platform, handle: agent.session!.handle, account_id: agent.session!.did, credentials: { appPassword } },
    { onConflict: 'user_id,platform' }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, handle: agent.session!.handle })
}

export async function DELETE(request: Request) {
  const db = userClient(request)
  const { platform } = await request.json()
  const { error } = await db.from('connections').delete().eq('platform', platform)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
