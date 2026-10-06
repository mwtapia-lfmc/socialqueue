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

async function xRefreshIfNeeded(db: SupabaseClient, conn: any): Promise<string> {
  const { accessToken, refreshToken, expiresAt } = conn.credentials
  if (!refreshToken || new Date(expiresAt).getTime() - Date.now() > 5 * 60_000) return accessToken
  const clientId = (process.env.X_CLIENT_ID || process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID || '').trim()!, secret = (process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET || '').trim() || ''
  const r = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(secret ? { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` } : {}) },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
  })
  const j = await r.json()
  if (!j.access_token) return accessToken
  const next = { ...conn.credentials, accessToken: j.access_token, refreshToken: j.refresh_token || refreshToken, expiresAt: new Date(Date.now() + (j.expires_in || 7200) * 1000).toISOString() }
  await db.from('connections').update({ credentials: next }).eq('id', conn.id)
  return j.access_token
}

async function publishToX(db: SupabaseClient, conn: any, text: string, imageUrls: string[]): Promise<Result> {
  const token = await xRefreshIfNeeded(db, conn)
  const mediaIds: string[] = []
  for (const u of imageUrls.slice(0, 4)) {
    try {
      const img = await fetch(u); const blob = await img.blob()
      const form = new FormData()
      form.append('media', blob, 'image.jpg'); form.append('media_category', 'tweet_image')
      const up = await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const uj = await up.json()
      const id = uj.data?.id || uj.media_id_string
      if (id) mediaIds.push(id)
    } catch (e) { console.warn('X media upload failed, posting without it:', e) }
  }
  const body: any = { text }
  if (mediaIds.length) body.media = { media_ids: mediaIds }
  const r = await fetch('https://api.x.com/2/tweets', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json()
  if (!j.data?.id) throw new Error(j.detail || j.title || j.errors?.[0]?.message || 'X rejected the post')
  return { ok: true, url: `https://x.com/${conn.handle}/status/${j.data.id}` }
}

const LI_VERSION = process.env.LINKEDIN_API_VERSION || '202509'
const liHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, 'LinkedIn-Version': LI_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' })

async function publishToLinkedIn(conn: any, text: string, imageUrls: string[]): Promise<Result> {
  const token = conn.credentials.accessToken
  if (new Date(conn.credentials.expiresAt).getTime() < Date.now()) throw new Error('LinkedIn token expired — reconnect in Accounts')
  const author = `urn:li:person:${conn.account_id}`
  const imageUrns: string[] = []
  for (const u of imageUrls.slice(0, 9)) {
    const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', { method: 'POST', headers: liHeaders(token), body: JSON.stringify({ initializeUploadRequest: { owner: author } }) }).then((r) => r.json())
    const uploadUrl = init.value?.uploadUrl, urn = init.value?.image
    if (!uploadUrl || !urn) continue
    const bytes = await (await fetch(u)).arrayBuffer()
    await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: bytes })
    imageUrns.push(urn)
  }
  const body: any = { author, commentary: text, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }
  if (imageUrns.length === 1) body.content = { media: { id: imageUrns[0] } }
  else if (imageUrns.length > 1) body.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } }
  const r = await fetch('https://api.linkedin.com/rest/posts', { method: 'POST', headers: liHeaders(token), body: JSON.stringify(body) })
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `LinkedIn rejected the post (${r.status})`) }
  const urn = r.headers.get('x-restli-id') || ''
  return { ok: true, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : 'https://www.linkedin.com/in/me/recent-activity/all/' }
}

export async function publishItem(db: SupabaseClient, item: any, opts: { stagger?: boolean } = {}) {
  const { data: conns } = await db.from('connections').select('*').eq('user_id', item.user_id)
  const baseText = markdownToSocial(item.content)
  const log: Record<string, Result> = { ...(item.publish_log || {}) }
  const targets = Object.keys(item.platforms || {}).filter((k) => item.platforms[k] && !log[k]?.ok)
  // Scheduled runs publish one platform per tick so cross-posts land a minute apart instead of simultaneously
  const batch = opts.stagger ? targets.slice(0, 1) : targets

  for (const p of batch) {
    const conn = conns?.find((c) => c.platform === p)
    if (!conn) { log[p] = { ok: false, error: 'Account not connected' }; continue }
    const text = item.overrides?.[p] ?? baseText
    try {
      log[p] = p === 'bluesky' ? await publishToBluesky(conn, text, item.image_urls || [])
        : p === 'threads' ? await publishToThreads(db, conn, text, item.image_urls || [])
        : p === 'twitter' ? await publishToX(db, conn, text, item.image_urls || [])
        : p === 'linkedin' ? await publishToLinkedIn(conn, text, item.image_urls || [])
        : { ok: false, error: 'Publishing to this platform is not available yet' }
    } catch (e: any) {
      log[p] = { ok: false, error: String(e?.message || e) }
    }
  }

  const remaining = Object.keys(item.platforms || {}).filter((k) => item.platforms[k] && !log[k]?.ok && !log[k])
  const anyOk = Object.values(log).some((r) => r.ok)
  const status = remaining.length && opts.stagger ? 'scheduled' : anyOk ? 'published' : 'failed'
  await db.from('items').update({
    status,
    published_at: anyOk && !remaining.length ? new Date().toISOString() : item.published_at ?? null,
    publish_log: log,
    updated_at: new Date().toISOString(),
  }).eq('id', item.id)

  return { status, log, remaining }
}
