import { userClient } from '../../lib/supabaseServer'

export interface Trend { topic: string; detail?: string; url?: string; heat?: number }
export interface TrendSource { key: string; label: string; icon: string; blurb: string; trends: Trend[]; error?: string; needs?: string }

const cache = new Map<string, { at: number; data: TrendSource }>()
const TTL = 15 * 60_000
const UA = 'SocialQueue/1.0 (+https://socialqueue-kappa.vercel.app)'

async function cached(key: string, fn: () => Promise<TrendSource>): Promise<TrendSource> {
  const c = cache.get(key)
  if (c && Date.now() - c.at < TTL) return c.data
  const data = await fn()
  if (!data.error) cache.set(key, { at: Date.now(), data })
  return data
}

const base = (key: string, label: string, icon: string, blurb: string): TrendSource => ({ key, label, icon, blurb, trends: [] })

async function bluesky(): Promise<TrendSource> {
  const src = base('bluesky', 'Bluesky', '🦋', 'Live trending topics on Bluesky right now')
  try {
    const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=15', { headers: { 'User-Agent': UA } }).then((r) => r.json())
    src.trends = (j.topics || []).map((t: any) => ({ topic: t.displayName || t.topic, detail: t.description, url: t.link ? `https://bsky.app${t.link}` : undefined }))
  } catch (e: any) { src.error = e.message }
  return src
}

async function google(): Promise<TrendSource> {
  const src = base('google', 'Google Trends', '🔎', 'What the US is searching for today')
  try {
    const xml = await fetch('https://trends.google.com/trending/rss?geo=US', { headers: { 'User-Agent': UA } }).then((r) => r.text())
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15)
    src.trends = items.map((m) => {
      const b = m[1]
      const g = (tag: string) => (b.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`)) || [])[1]?.trim()
      const traffic = g('ht:approx_traffic') || ''
      return { topic: g('title') || '', detail: g('ht:news_item_title') || traffic, url: g('ht:news_item_url') || g('link'), heat: Number(traffic.replace(/[^\d]/g, '')) || undefined }
    }).filter((t) => t.topic)
  } catch (e: any) { src.error = e.message }
  return src
}

async function hackernews(): Promise<TrendSource> {
  const src = base('hn', 'Hacker News', '🟧', 'Tech & startup conversation, front page now')
  try {
    const j = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=12', { headers: { 'User-Agent': UA } }).then((r) => r.json())
    src.trends = (j.hits || []).map((h: any) => ({ topic: h.title, detail: `${h.points} points · ${h.num_comments} comments`, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, heat: h.points }))
  } catch (e: any) { src.error = e.message }
  return src
}

async function xTrends(token?: string): Promise<TrendSource> {
  const src = base('twitter', 'X', '𝕏', 'Trending on X (US)')
  if (!token) { src.needs = 'Connect X in Accounts'; return src }
  try {
    const r = await fetch('https://api.x.com/2/trends/by_woeid/23424977?max_trends=15', { headers: { Authorization: `Bearer ${token}` } })
    const j = await r.json()
    if (!r.ok) { src.needs = /credit|402|payment/i.test(JSON.stringify(j)) ? 'X charges $0.01 per trends request — add credits in the X developer console' : (j.detail || j.title || 'X rejected the request'); return src }
    src.trends = (j.data || []).map((t: any) => ({ topic: t.trend_name, detail: t.tweet_count ? `${Number(t.tweet_count).toLocaleString()} posts` : undefined, url: `https://x.com/search?q=${encodeURIComponent(t.trend_name)}`, heat: t.tweet_count }))
  } catch (e: any) { src.error = e.message }
  return src
}

export async function GET(request: Request) {
  const db = userClient(request)
  const { data: conns } = await db.from('connections').select('platform, credentials')
  const xTok = conns?.find((c) => c.platform === 'twitter')?.credentials?.accessToken
  const sources = await Promise.all([
    cached('bluesky', bluesky),
    cached('google', google),
    cached('hn', hackernews),
    xTok ? cached('x', () => xTrends(xTok)) : xTrends(undefined),
  ])
  return Response.json({ sources, fetchedAt: new Date().toISOString(), note: 'Threads and LinkedIn do not expose trending data. Bluesky + Google are the best proxies for what people are talking about.' })
}
