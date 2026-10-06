import { AtpAgent, RichText } from '@atproto/api'
import type { SupabaseClient } from '@supabase/supabase-js'
import { markdownToSocial } from './text'

type Result = { ok: true; url?: string } | { ok: false; error: string }

async function publishToBluesky(conn: any, text: string, imageUrls: string[]): Promise<Result> {
  const agent = new AtpAgent({ service: 'https://bsky.social' })
  await agent.login({ identifier: conn.handle, password: conn.credentials.appPassword })

  const rt = new RichText({ text })
  await rt.detectFacets(agent)

  const images: { image: any; alt: string }[] = []
  for (const url of imageUrls.slice(0, 4)) {
    const res = await fetch(url)
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > 1_000_000) continue
    const up = await agent.uploadBlob(bytes, { encoding: res.headers.get('content-type') || 'image/jpeg' })
    images.push({ image: up.data.blob, alt: '' })
  }

  const r = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: images.length ? { $type: 'app.bsky.embed.images', images } : undefined,
    createdAt: new Date().toISOString(),
  })
  const rkey = r.uri.split('/').pop()
  return { ok: true, url: `https://bsky.app/profile/${agent.session?.handle || conn.handle}/post/${rkey}` }
}

async function threadsRefreshIfNeeded(db: SupabaseClient, conn: any): Promise<string> {
  const { accessToken, expiresAt } = conn.credentials
  const msLeft = new Date(expiresAt).getTime() - Date.now()
  if (msLeft > 7 * 86400_000) return accessToken
  const r = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${accessToken}`)
  const j = await r.json()
  if (!j.access_token) return accessToken
  const next = { accessToken: j.access_token, expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString() }
  await db.from('connections').update({ credentials: next }).eq('id', conn.id)
  return j.access_token
}

async function publishToThreads(db: SupabaseClient, conn: any, text: string, imageUrls: string[]): Promise<Result> {
  const token = await threadsRefreshIfNeeded(db, conn)
  const uid = conn.account_id
  const base = `https://graph.threads.net/v1.0/${uid}`
  const create = async (params: Record<string, string>) => {
    const r = await fetch(`${base}/threads`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: token }) })
    const j = await r.json()
    if (!j.id) throw new Error(j.error?.message || 'Threads container creation failed')
    return j.id as string
  }
  const waitReady = async (id: string) => {
    for (let i = 0; i < 10; i++) {
      const r = await fetch(`https://graph.threads.net/v1.0/${id}?fields=status,error_message&access_token=${token}`)
      const j = await r.json()
      if (j.status === 'FINISHED') return
      if (j.status === 'ERROR') throw new Error(j.error_message || 'Threads media processing failed')
      await new Promise((res) => setTimeout(res, 1500))
    }
  }

  let containerId: string
  if (imageUrls.length === 0) {
    containerId = await create({ media_type: 'TEXT', text })
  } else if (imageUrls.length === 1) {
    containerId = await create({ media_type: 'IMAGE', image_url: imageUrls[0], text })
  } else {
    const children: string[] = []
    for (const u of imageUrls.slice(0, 10)) {
      const id = await create({ media_type: 'IMAGE', image_url: u, is_carousel_item: 'true' })
      await waitReady(id)
      children.push(id)
    }
    containerId = await create({ media_type: 'CAROUSEL', children: children.join(','), text })
  }
  await waitReady(containerId)

  const pub = await fetch(`${base}/threads_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: containerId, access_token: token }) })
  const pj = await pub.json()
  if (!pj.id) throw new Error(pj.error?.message || 'Threads publish failed')

  const permRes = await fetch(`https://graph.threads.net/v1.0/${pj.id}?fields=permalink&access_token=${token}`)
  const perm = await permRes.json()
  return { ok: true, url: perm.permalink || `https://www.threads.net/@${conn.handle}` }
}

export async function publishItem(db: SupabaseClient, item: any) {
  const { data: conns } = await db.from('connections').select('*').eq('user_id', item.user_id)
  const baseText = markdownToSocial(item.content)
  const log: Record<string, Result> = {}

  for (const p of Object.keys(item.platforms || {}).filter((k) => item.platforms[k])) {
    const conn = conns?.find((c) => c.platform === p)
    if (!conn) { log[p] = { ok: false, error: 'Account not connected' }; continue }
    const text = item.overrides?.[p] ?? baseText
    try {
      log[p] = p === 'bluesky' ? await publishToBluesky(conn, text, item.image_urls || [])
        : p === 'threads' ? await publishToThreads(db, conn, text, item.image_urls || [])
        : { ok: false, error: 'Publishing to this platform is not available yet' }
    } catch (e: any) {
      log[p] = { ok: false, error: String(e?.message || e) }
    }
  }

  const anyOk = Object.values(log).some((r) => r.ok)
  const status = anyOk ? 'published' : 'failed'
  await db.from('items').update({
    status,
    published_at: anyOk ? new Date().toISOString() : null,
    publish_log: log,
    updated_at: new Date().toISOString(),
  }).eq('id', item.id)

  return { status, log }
}
