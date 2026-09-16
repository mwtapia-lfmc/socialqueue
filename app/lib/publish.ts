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

export async function publishItem(db: SupabaseClient, item: any) {
  const { data: conns } = await db.from('connections').select('*').eq('user_id', item.user_id)
  const text = markdownToSocial(item.content)
  const log: Record<string, Result> = {}

  for (const p of Object.keys(item.platforms || {}).filter((k) => item.platforms[k])) {
    const conn = conns?.find((c) => c.platform === p)
    if (!conn) { log[p] = { ok: false, error: 'Account not connected' }; continue }
    try {
      log[p] = p === 'bluesky'
        ? await publishToBluesky(conn, text, item.image_urls || [])
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
