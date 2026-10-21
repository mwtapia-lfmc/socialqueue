import Anthropic from '@anthropic-ai/sdk'
import { requireUser, signInFirst } from '../../lib/requireUser'

export const maxDuration = 60

const cache = new Map<string, { at: number; data: any }>()
const TTL = 60 * 60_000

export async function POST(request: Request) {
  if (!(await requireUser(request))) return signInFirst()
  const { focus = '', places = ['USA'], refresh = false } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 500 })
  const key = `${places.join(',')}|${String(focus).trim().toLowerCase()}`
  const hit = cache.get(key)
  if (!refresh && hit && Date.now() - hit.at < TTL) return Response.json({ ...hit.data, cached: true })
  try {
    const client = new Anthropic({ apiKey })
    const today = new Date().toISOString().slice(0, 10)
    const prompt = `Today is ${today}. Use web search to find what is trending on social media right now, across Facebook, Instagram, Threads, LinkedIn, TikTok, YouTube, X and Reddit. Focus on: ${places.join(', ')}.${focus ? ` Especially anything about: ${focus}.` : ''}
Only report things you found in search results from the last few days. Say which platform each is trending on, and why people care in one plain sentence. Don't invent anything. If you can't find solid evidence a topic is trending on a platform, put the news source's platform as "News".

Return ONLY JSON, no other text: {"items":[{"topic":"...","platform":"LinkedIn","why":"...","url":"https://..."}]}  with 8 to 10 items, most significant first.`
    const msg = await (client.messages as any).create({
      model: 'claude-sonnet-5', max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (msg.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Claude could not find clear results. Try again or narrow the focus.')
    const data = { items: (JSON.parse(m[0]).items || []).slice(0, 12), at: new Date().toISOString() }
    cache.set(key, { at: Date.now(), data })
    return Response.json(data)
  } catch (e: any) {
    const msg = String(e.message || e)
    return Response.json({ error: /web_search|tool/i.test(msg) ? 'Web search is not enabled on your Anthropic account yet. Enable it at console.anthropic.com (Settings → Privacy / Tools), then try again. (' + msg.slice(0, 120) + ')' : msg }, { status: 500 })
  }
}
