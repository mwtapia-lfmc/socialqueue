export type Region = 'la' | 'us' | 'world'
export interface Headline { title: string; url: string; source: string; at: string; region: Region }

const UA = { 'User-Agent': 'SocialQueue/1.0 (+https://socialqueue-kappa.vercel.app)' }
const FEEDS: { region: Region; source: string; url: string }[] = [
  { region: 'la', source: 'LA Times', url: 'https://www.latimes.com/california/rss2.0.xml' },
  { region: 'la', source: 'LAist', url: 'https://laist.com/index.rss' },
  { region: 'us', source: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { region: 'us', source: 'Google News', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en' },
  { region: 'world', source: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { region: 'world', source: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
]

const decode = (s = '') => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim()
const tag = (b: string, t: string) => decode(b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] || '')

let cache: { at: number; all: Headline[] } | null = null
const TTL = 3 * 60_000

export async function loadHeadlines(): Promise<Headline[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.all
  const lists = await Promise.all(FEEDS.map(async (f) => {
    try {
      const xml = await fetch(f.url, { headers: UA, signal: AbortSignal.timeout(8000) }).then((r) => r.text())
      return [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)].slice(0, 15).map((m): Headline | null => {
        const b = m[1]
        let title = tag(b, 'title'); let source = f.source
        if (f.source === 'Google News') { const i = title.lastIndexOf(' - '); if (i > 0) { source = title.slice(i + 3); title = title.slice(0, i) } }
        const d = new Date(tag(b, 'pubDate'))
        const url = tag(b, 'link') || b.match(/<link[^>]*>([^<]+)/)?.[1] || ''
        return title && url && !isNaN(+d) ? { title, url, source, at: d.toISOString(), region: f.region } : null
      }).filter(Boolean) as Headline[]
    } catch { return [] }
  }))
  const seen = new Set<string>()
  const all = lists.flat().sort((a, b) => +new Date(b.at) - +new Date(a.at)).filter((h) => {
    const k = h.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 50)
    if (seen.has(k)) return false; seen.add(k); return true
  })
  cache = { at: Date.now(), all }
  return all
}

