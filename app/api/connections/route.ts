import { AtpAgent } from '@atproto/api'
import { userClient } from '../../lib/supabaseServer'

export async function GET(request: Request) {
  const db = userClient(request)
  const { data, error } = await db.from('connections').select('id, platform, handle, account_id, created_at')
  if (error) return Response.json({ error: error.message }, { status: 401 })
  return Response.json({ connections: data })
}

export async function POST(request: Request) {
  const db = userClient(request)
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { platform, handle, appPassword } = await request.json()
  if (platform !== 'bluesky') return Response.json({ error: 'Only Bluesky can be connected right now' }, { status: 400 })
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
