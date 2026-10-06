import { userClient } from '../../lib/supabaseServer'

export interface Trend {
  topic: string; summary?: string; url?: string
  count?: number; countLabel?: string; secondary?: string
  startedAt?: string; category?: string; image?: string
  actors?: { handle: string; avatar?: string }[]
  news?: { title: string; source?: string; url?: string }[]
}
export interface TrendSource { key: string; label: string; icon: string; blurb: string; trends: Trend[]; fetchedAt: string; error?: string; needs?: string }

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

async function google() {
  const src = base('google', 'Google Trends', '🔎', 'Search spikes across the US today — approximate searches and the headlines behind them')
  try {
    const xml = await fetch('https://trends.google.com/trending/rss?geo=US', { headers: UA }).then((r) => r.text())
    const g = (b: string, tag: string) => decode((b.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`)) || [])[1]?.trim() || '')
    src.trends = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map((m) => {
      const b = m[1]
      const news = [...b.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)].slice(0, 3).map((n) => ({ title: g(n[1], 'ht:news_item_title'), source: g(n[1], 'ht:news_item_source'), url: g(n[1], 'ht:news_item_url') }))
      const traffic = g(b, 'ht:approx_traffic')
      return { topic: g(b, 'title'), summary: news[0]?.title, news, url: news[0]?.url, count: Number(traffic.replace(/[^\d]/g, '')) || undefined, countLabel: 'searches', secondary: traffic ? `${traffic} searches` : undefined, startedAt: g(b, 'pubDate') ? new Date(g(b, 'pubDate')).toISOString() : undefined, image: g(b, 'ht:picture') }
    }).filter((t) => t.topic)
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
  const sources = await Promise.all([cached('bluesky', bluesky), cached('google', google), cached('hn', hackernews), xTok ? cached('x', () => xTrends(xTok)) : xTrends(undefined)])
  return Response.json({ sources, fetchedAt: new Date().toISOString(), note: 'Meta (Threads, Instagram, Facebook) and LinkedIn publish no trending data. Bluesky and Google are the closest read on what people are talking about right now.' })
}
