import { loadHeadlines } from '../../lib/breaking'
export type { Region, Headline } from '../../lib/breaking'

export async function GET(request: Request) {
  const regions = (new URL(request.url).searchParams.get('regions') || 'la,us,world').split(',')
  const cutoff = Date.now() - 36 * 3600_000
  const all = await loadHeadlines()
  return Response.json({ items: all.filter((h) => regions.includes(h.region) && +new Date(h.at) > cutoff).slice(0, 40), fetchedAt: new Date().toISOString() })
}
