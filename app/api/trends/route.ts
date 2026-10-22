import { userClient } from '../../lib/supabaseServer'

export interface Trend {
  topic: string; summary?: string; url?: string
  count?: number; countLabel?: string; secondary?: string
  startedAt?: string; category?: string; image?: string
  actors?: { handle: string; avatar?: string }[]
  news?: { title: string; source?: string; url?: string }[]
}
export type Region = 'la' | 'us' | 'world'
export interface TrendSource { region?: Region; key: string; label: string; icon: string; blurb: string; trends: Trend[]; fetchedAt: string; error?: string; needs?: string }

const cache = new Map<string, { at: number; data: TrendSource }>()
const TTL = 15 * 60_000
const UA = { 'User-Agent': 'SocialQueue/1.0 (+https://socialqueue-kappa.vercel.app)' }
const decode = (s = '') => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

async function cached(key: string, fn: () => Promise<TrendSource>) {
  const c = cache.get(key); if (c && Date.now() - c.at < TTL) return c.data
  const data = await fn(); if (!data.error) cache.set(key, { at: Date.now(), data }); return data
}
const base = (key: string, label: string, icon: string, blurb: string): TrendSource => ({ key, label, icon, blurb, trends: [], fetchedAt: new Date().toISOString() })

async function bluesky() {
  const src = base('bluesky', 'Bluesky', '🦋', 'Live trending conversations on Bluesky — post counts since each topic started')
  try {
    const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends?limit=15', { headers: UA }).then((r) => r.json())
    src.trends = (j.trends || []).map((t: any) => ({
      topic: t.displayName || t.topic, summary: t.description, url: t.link ? `https://bsky.app${t.link}` : undefined,
      count: t.postCount, countLabel: 'posts', startedAt: t.startedAt, category: t.category, secondary: t.status && t.status !== 'trending' ? t.status : undefined,
      actors: (t.actors || []).slice(0, 4).map((a: any) => ({ handle: a.handle, avatar: a.avatar })),
    }))
  } catch (e: any) { src.error = e.message }
  return src
}

async function googleGeo(geo: string, limit: number) {
  const xml = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, { headers: UA }).then((r) => r.text())
  const out: Trend[] = []
    const g = (b: string, tag: string) => decode((b.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`)) || [])[1]?.trim() || '')
    out.push(...[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map((m) => {
      const b = m[1]
      const news = [...b.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)].slice(0, 3).map((n) => ({ title: g(n[1], 'ht:news_item_title'), source: g(n[1], 'ht:news_item_source'), url: g(n[1], 'ht:news_item_url') }))
      const traffic = g(b, 'ht:approx_traffic')
      const topic = g(b, 'title')
      return { topic, summary: news[0]?.title, news, url: `https://www.google.com/search?q=${encodeURIComponent(topic)}`, count: Number(traffic.replace(/[^\d]/g, '')) || undefined, countLabel: 'searches', secondary: traffic ? `${traffic} searches` : undefined, startedAt: g(b, 'pubDate') ? new Date(g(b, 'pubDate')).toISOString() : undefined, image: g(b, 'ht:picture') }
    }).filter((t) => t.topic))
  return out
}

async function google(region: Region) {
  const meta = {
    la: { key: 'google-la', label: 'Google Trends · California', blurb: "Search spikes in California today. Google doesn't split out LA alone, so this is the closest read." },
    us: { key: 'google-us', label: 'Google Trends · USA', blurb: 'Search spikes across the US today, with the headlines behind them' },
    world: { key: 'google-world', label: 'Google Trends · World', blurb: 'Top searches in the UK, Canada, Australia, India, Germany and Brazil today' },
  }[region]
  const src = base(meta.key, meta.label, '🔎', meta.blurb); src.region = region
  try {
    if (region === 'world') {
      const GEOS: [string, string][] = [['GB', '🇬🇧'], ['CA', '🇨🇦'], ['AU', '🇦🇺'], ['IN', '🇮🇳'], ['DE', '🇩🇪'], ['BR', '🇧🇷']]
      const lists = await Promise.all(GEOS.map(async ([geo, flag]) => (await googleGeo(geo, 3).catch(() => [])).map((t) => ({ ...t, secondary: `${flag} ${t.secondary || ''}`.trim() }))))
      src.trends = lists.flat()
    } else src.trends = await googleGeo(region === 'la' ? 'US-CA' : 'US', 15)
  } catch (e: any) { src.error = e.message }
  return src
}

async function hackernews() {
  const src = base('hn', 'Hacker News', '🟧', 'Tech, startups, and builders — the front page right now')
  try {
    const j = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=15', { headers: UA }).then((r) => r.json())
    src.trends = (j.hits || []).map((h: any) => {
      let domain = ''; try { domain = h.url ? new URL(h.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com' } catch {}
      return { topic: h.title, summary: domain ? `From ${domain}. ${h.num_comments} comments on HN.` : undefined, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, count: h.points, countLabel: 'points', secondary: `${h.num_comments} comments`, startedAt: h.created_at, news: [{ title: 'Discussion on Hacker News', source: `${h.num_comments} comments`, url: `https://news.ycombinator.com/item?id=${h.objectID}` }] }
    })
  } catch (e: any) { src.error = e.message }
  return src
}

let redditToken: { value: string; exp: number } | null = null
async function redditAuth() {
  const id = process.env.REDDIT_CLIENT_ID, secret = process.env.REDDIT_CLIENT_SECRET
  if (!id || !secret) return null
  if (redditToken && redditToken.exp > Date.now() + 60_000) return redditToken.value
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST', headers: { ...UA, Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error(`Reddit login failed (${r.status}). Check REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET.`)
  redditToken = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }
  return redditToken.value
}

async function reddit(region: Region) {
  const meta = {
    la: { key: 'reddit-la', label: 'Reddit · Los Angeles', blurb: 'Hot right now on r/LosAngeles', path: '/r/LosAngeles/hot?limit=20' },
    us: { key: 'reddit-us', label: 'Reddit · USA', blurb: 'What Americans are upvoting and arguing about (r/popular)', path: '/r/popular?geo_filter=US&limit=20' },
    world: { key: 'reddit-world', label: 'Reddit · World', blurb: 'What the whole planet is upvoting (r/popular, global)', path: '/r/popular?geo_filter=GLOBAL&limit=20' },
  }[region]
  const src = base(meta.key, meta.label, '👽', meta.blurb); src.region = region
  try {
    const token = await redditAuth()
    if (!token) { src.needs = 'Reddit blocks anonymous requests from our server. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Vercel to turn this on.'; return src }
    const r = await fetch('https://oauth.reddit.com' + meta.path, { headers: { ...UA, Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`Reddit said ${r.status}`)
    const j = await r.json()
    src.trends = (j.data?.children || []).filter((c: any) => !c.data?.stickied).slice(0, 15).map((c: any) => {
      const d = c.data
      return { topic: decode(d.title), summary: `Posted in r/${d.subreddit} by u/${d.author}.`, url: 'https://www.reddit.com' + d.permalink, count: d.score, countLabel: 'upvotes', secondary: `${d.num_comments} comments · r/${d.subreddit}`, category: d.subreddit, startedAt: new Date(d.created_utc * 1000).toISOString() }
    })
    if (!src.trends.length) throw new Error('No Reddit posts came back')
  } catch (e: any) { src.error = e.message }
  return src
}

async function xTrends(token?: string) {
  const src = base('twitter', 'X', '𝕏', 'Trending on X in the US')
  if (!token) { src.needs = 'Connect X in Accounts to see its trends.'; return src }
  try {
    const r = await fetch('https://api.x.com/2/trends/by_woeid/23424977?max_trends=15', { headers: { Authorization: `Bearer ${token}` } })
    const j = await r.json()
    if (!r.ok) { src.needs = /credit|402|payment|depleted/i.test(JSON.stringify(j)) ? 'X charges 1¢ per trends request — add credits in the X developer console to turn this on.' : (j.detail || j.title || 'X rejected the request'); return src }
    src.trends = (j.data || []).map((t: any) => ({ topic: t.trend_name, url: `https://x.com/search?q=${encodeURIComponent(t.trend_name)}`, count: t.tweet_count ? Number(t.tweet_count) : undefined, countLabel: 'posts' }))
  } catch (e: any) { src.error = e.message }
  return src
}

export async function GET(request: Request) {
  const db = userClient(request)
  const { data: conns } = await db.from('connections').select('platform, credentials')
  const xTok = conns?.find((c) => c.platform === 'twitter')?.credentials?.accessToken
  const sources = await Promise.all([cached('bluesky', bluesky), ...(['la', 'us', 'world'] as Region[]).flatMap((rg) => [cached(`google-${rg}`, () => google(rg)), cached(`reddit-${rg}`, () => reddit(rg))]), cached('hn', hackernews), xTok ? cached('x', () => xTrends(xTok)) : xTrends(undefined)])
  const REGION: Record<string, Region> = { bluesky: 'world', hn: 'world', twitter: 'us', x: 'us' }
  for (const sc of sources) sc.region ??= REGION[sc.key] ?? 'world'
  return Response.json({ sources, fetchedAt: new Date().toISOString(), note: 'Meta (Threads, Instagram, Facebook) and LinkedIn publish no trending data. Bluesky and Google are the closest read on what people are talking about right now.' })
}
