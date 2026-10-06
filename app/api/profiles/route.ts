import { userClient } from '../../lib/supabaseServer'

export interface ProfilePost { id: string; text: string; url: string; createdAt: string; image?: string; label?: string; likes?: number; replies?: number; reposts?: number }
export interface Profile {
  platform: string; handle: string; displayName?: string; avatar?: string; bio?: string; url: string
  followers?: number; following?: number; postCount?: number; posts: ProfilePost[]; error?: string
}

async function bluesky(conn: any): Promise<Profile> {
  const base = 'https://public.api.bsky.app/xrpc'
  const actor = encodeURIComponent(conn.handle)
  const [pr, fr] = await Promise.all([
    fetch(`${base}/app.bsky.actor.getProfile?actor=${actor}`).then((r) => r.json()),
    fetch(`${base}/app.bsky.feed.getAuthorFeed?actor=${actor}&limit=25&filter=posts_no_replies`).then((r) => r.json()),
  ])
  const posts: ProfilePost[] = (fr.feed || [])
    .filter((f: any) => !f.reason)
    .map((f: any) => {
      const p = f.post
      const rkey = p.uri.split('/').pop()
      const img = p.embed?.images?.[0]?.thumb || p.embed?.media?.images?.[0]?.thumb || p.embed?.external?.thumb
      return { id: p.uri, text: p.record?.text || '', url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`, createdAt: p.record?.createdAt || p.indexedAt, image: img, likes: p.likeCount, replies: p.replyCount, reposts: p.repostCount }
    })
  return { platform: 'bluesky', handle: pr.handle || conn.handle, displayName: pr.displayName, avatar: pr.avatar, bio: pr.description, url: `https://bsky.app/profile/${pr.handle || conn.handle}`, followers: pr.followersCount, following: pr.followsCount, postCount: pr.postsCount, posts }
}

async function threads(conn: any): Promise<Profile> {
  const tok = encodeURIComponent(conn.credentials.accessToken)
  const [me, th] = await Promise.all([
    fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url,threads_biography&access_token=${tok}`).then((r) => r.json()),
    fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,permalink,timestamp,media_type,media_url,thumbnail_url,is_quote_post,children{media_url,thumbnail_url,media_type}&limit=40&access_token=${tok}`).then((r) => r.json()),
  ])
  if (me.error) throw new Error(me.error.message)
  const posts: ProfilePost[] = (th.data || [])
    .filter((t: any) => t.media_type !== 'REPOST_FACADE')
    .map((t: any) => {
      const child = t.children?.data?.[0]
      const image = t.media_type === 'VIDEO' ? t.thumbnail_url
        : t.media_type === 'CAROUSEL_ALBUM' ? (child?.media_type === 'VIDEO' ? child?.thumbnail_url : child?.media_url)
        : t.media_url || t.thumbnail_url
      const label = t.is_quote_post ? '↩ Quote post' : t.media_type === 'VIDEO' ? '▶ Video' : t.media_type === 'CAROUSEL_ALBUM' ? '🖼 Carousel' : !t.text && image ? '🖼 Image post' : ''
      return { id: t.id, text: t.text || '', url: t.permalink, createdAt: t.timestamp, image, label }
    })
    .slice(0, 25)
  return { platform: 'threads', handle: me.username, displayName: me.name || me.username, avatar: me.threads_profile_picture_url, bio: me.threads_biography, url: `https://www.threads.net/@${me.username}`, posts }
}

async function twitter(conn: any): Promise<Profile> {
  const tok = conn.credentials.accessToken
  const h = { Authorization: `Bearer ${tok}` }
  const me = (await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,name,username,description,public_metrics', { headers: h }).then((r) => r.json())).data
  if (!me) throw new Error('X session expired — reconnect in Accounts')
  let posts: ProfilePost[] = []
  try {
    const tw = await fetch(`https://api.x.com/2/users/${me.id}/tweets?max_results=25&exclude=retweets,replies&tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=preview_image_url,url`, { headers: h }).then((r) => r.json())
    const media = new Map((tw.includes?.media || []).map((m: any) => [m.media_key, m.url || m.preview_image_url]))
    posts = (tw.data || []).map((t: any) => ({ id: t.id, text: t.text, url: `https://x.com/${me.username}/status/${t.id}`, createdAt: t.created_at, image: media.get(t.attachments?.media_keys?.[0]) as string | undefined, likes: t.public_metrics?.like_count, replies: t.public_metrics?.reply_count, reposts: t.public_metrics?.retweet_count }))
  } catch {}
  return { platform: 'twitter', handle: me.username, displayName: me.name, avatar: me.profile_image_url?.replace('_normal', '_400x400'), bio: me.description, url: `https://x.com/${me.username}`, followers: me.public_metrics?.followers_count, following: me.public_metrics?.following_count, postCount: me.public_metrics?.tweet_count, posts }
}

async function linkedin(conn: any): Promise<Profile> {
  const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${conn.credentials.accessToken}` } }).then((r) => r.json())
  if (!me.sub) throw new Error('LinkedIn session expired — reconnect in Accounts')
  // LinkedIn does not expose a member's own post history without a restricted permission
  return { platform: 'linkedin', handle: conn.handle, displayName: me.name, avatar: me.picture, url: 'https://www.linkedin.com/in/me/', posts: [] }
}

export async function GET(request: Request) {
  const db = userClient(request)
  const { data, error } = await db.from('connections').select('*')
  if (error) return Response.json({ error: error.message }, { status: 401 })
  const fresh = new URL(request.url).searchParams.get('fresh') === '1'
  const TTL = 10 * 60_000
  const profiles = await Promise.all((data || []).map(async (c) => {
    const cached = c.credentials?.profileCache
    if (!fresh && cached?.at && Date.now() - new Date(cached.at).getTime() < TTL) return cached.data as Profile
    try {
      const prof = c.platform === 'bluesky' ? await bluesky(c) : c.platform === 'threads' ? await threads(c) : c.platform === 'twitter' ? await twitter(c) : c.platform === 'linkedin' ? await linkedin(c) : null
      if (prof) await db.from('connections').update({ credentials: { ...c.credentials, avatar: prof.avatar || c.credentials?.avatar, displayName: prof.displayName || c.credentials?.displayName, profileAt: new Date().toISOString(), profileCache: { at: new Date().toISOString(), data: prof } } }).eq('id', c.id)
      return prof
    } catch (e: any) {
      if (cached?.data) return { ...cached.data, error: undefined } as Profile
      return { platform: c.platform, handle: c.handle, url: '', posts: [], error: String(e?.message || e) } as Profile
    }
  }))
  return Response.json({ profiles: profiles.filter(Boolean) })
}
