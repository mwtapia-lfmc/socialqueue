import type { Item } from '../components/UnifiedComposer'

export interface Publication { id: string; name: string; platform: string; year_theme: string | null; logo_url?: string | null }
export interface Series { id: string; publication_id: string; key: string; name: string; description: string | null; sort_order: number; is_active: boolean; logo_url?: string | null; emoji?: string | null }
export interface Bucket { id: string; publication_id: string; key: string; name: string; description: string | null; sort_order: number; emoji?: string | null }
export interface StructureData { publication: Publication; series: Series[]; buckets: Bucket[] }

export type Stage = 'idea' | 'drafting' | 'scheduled' | 'published'
export type Format = 'note' | 'longform'

export const STAGES: Stage[] = ['idea', 'drafting', 'scheduled', 'published']
export const STAGE_STYLE: Record<Stage, string> = {
  idea: 'bg-gray-100 text-gray-700',
  drafting: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-blue-100 text-blue-800',
  published: 'bg-emerald-100 text-emerald-800',
}
export const CADENCE: Record<Format, number> = { note: 7, longform: 1 }
export const FORMAT_LABEL: Record<Format, string> = { note: 'Note', longform: 'Longform' }

// Publishing state comes from items.status; idea vs drafting is the extra stage column.
export function stageOf(it: Pick<Item, 'status' | 'stage'>): Stage {
  if (it.status === 'published') return 'published'
  if (it.status === 'scheduled' || it.status === 'failed') return 'scheduled'
  return it.stage === 'idea' ? 'idea' : 'drafting'
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Monday–Sunday week containing d
export function weekRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()); start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return ymd(x) })
  return { start: days[0], end: days[6], days }
}

// The date a post "belongs" to for cadence: planned → scheduled → published → created
export function itemDate(it: Item): string {
  if (it.planned_for) return it.planned_for
  if (it.schedule_date) return it.schedule_date
  if (it.published_at) return ymd(new Date(it.published_at))
  return it.created_at ? ymd(new Date(it.created_at)) : ymd(new Date())
}

export const SEED_TAGS = ['culture', 'music', 'grateful-dead', 'west-coast', 'east-coast-bias', 'quotable', 'creator-recommendation', 'lead-magnet']

export const SEED_SERIES = [
  { key: 'semiotics', name: 'Semiotics', description: 'Reading signs and meaning in everyday media' },
  { key: 'etymology', name: 'Etymology', description: 'Where words come from; short and quotable' },
  { key: 'media-politics', name: 'Media Politics', description: 'Who owns it, who it serves, who it leaves out; East Coast bias lives here' },
  { key: 'consuming-media', name: 'Consuming Media', description: 'Media diet, algorithms, attention, personal relationship with the feed' },
]

export const SEED_BUCKETS = [
  { key: 'inspirational', name: 'Inspirational', description: 'Quotes and similar' },
  { key: 'topical', name: 'Topical', description: 'Opinion on something happening in the industry now' },
  { key: 'educational', name: 'Educational', description: 'Teach the audience one thing' },
  { key: 'repurposed', name: 'Repurposed', description: 'Old content from other platforms' },
]

export const SEED_IDEAS: { title: string; series?: string; tags?: string[] }[] = [
  { title: "Who am I? Who are you? (We Didn't Start the Fire)", tags: ['lead-magnet'] },
  { title: 'Why you should hire me, and us' },
  { title: 'I toldja so', series: 'media-politics' },
  { title: 'My personal relationship with the algorithms', series: 'consuming-media' },
  { title: 'Semiotics 101', series: 'semiotics' },
  { title: 'Starting this with LSD, Vyvanse and Claude' },
  { title: 'Fuck the East Coast bias', series: 'media-politics', tags: ['east-coast-bias'] },
  { title: 'The Dead as a creator economy', series: 'consuming-media', tags: ['culture', 'music', 'grateful-dead'] },
]

export const STRUCTURE_SQL = `CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'substack',
  year_theme TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publication_id, key)
);
CREATE TABLE buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (publication_id, key)
);
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own publications" ON publications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own series" ON series FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own buckets" ON buckets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES publications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bucket_id UUID REFERENCES buckets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS hook TEXT,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS planned_for DATE,
  ADD COLUMN IF NOT EXISTS source_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';`

// ---- tags are the buckets: a registry built from bucket rows + seed tags + whatever items use ----
export interface TagInfo { key: string; name: string; emoji: string; count: number; rowId?: string }

export const slugTag = (s: string) => s.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const DEFAULT_SERIES_EMOJI: Record<string, string> = { semiotics: '🪧', etymology: '📜', 'media-politics': '🏛️', 'consuming-media': '📺' }
export const DEFAULT_TAG_EMOJI: Record<string, string> = {
  culture: '🎭', music: '🎵', 'grateful-dead': '💀', 'west-coast': '🌴', 'east-coast-bias': '🗽', quotable: '💬', 'creator-recommendation': '🤝', 'lead-magnet': '🧲',
  inspirational: '✨', topical: '📰', educational: '🎓', repurposed: '♻️',
}
export const EMOJI_CHOICES = ['🪧', '📜', '🏛️', '📺', '📚', '🎙️', '🎬', '📰', '🧠', '🔍', '💡', '🔥', '⚡', '🎯', '🌎', '🌴', '🗽', '🎵', '🎸', '💀', '🌹', '🎭', '🎨', '📻', '📱', '🤝', '🧲', '💬', '✨', '🎓', '♻️', '🏷️', '❤️', '😂', '🤔', '👀', '🚀', '🌊', '☀️', '🕶️']

export const seriesEmoji = (s: Pick<Series, 'key' | 'emoji'>) => s.emoji || DEFAULT_SERIES_EMOJI[s.key] || '📚'

// Effective tags for an item: its tags plus the key of a legacy bucket_id
export function itemTags(it: Pick<Item, 'tags' | 'bucket_id'>, buckets: Bucket[]): string[] {
  const set = new Set(it.tags || [])
  const legacy = buckets.find((b) => b.id === it.bucket_id)
  if (legacy) set.add(legacy.key)
  return [...set]
}

export function tagRegistry(buckets: Bucket[], items: Item[]): TagInfo[] {
  const keys = new Set<string>([...buckets.map((b) => b.key), ...SEED_TAGS])
  for (const it of items) for (const t of itemTags(it, buckets)) keys.add(t)
  return [...keys].map((key) => {
    const row = buckets.find((b) => b.key === key)
    return {
      key, rowId: row?.id, name: row?.name || key, emoji: row?.emoji || DEFAULT_TAG_EMOJI[key] || '🏷️',
      count: items.filter((i) => itemTags(i, buckets).includes(key)).length,
    }
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// ---- weeks of the year: Week 1 starts Jan 1, Week 52 ends Dec 31 (leftover day(s) fold into 52) ----
const DAY = 86400000
const mid = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const dayIndex = (d: Date) => Math.round((mid(d).getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / DAY)
export const weekOfYear = (d: Date) => Math.min(52, Math.floor(dayIndex(d) / 7) + 1)
export const blockStart = (d: Date) => { const y = d.getFullYear(); const x = new Date(y, 0, 1); x.setDate(1 + Math.floor(dayIndex(d) / 7) * 7); return x }
export function weekDates(year: number, n: number): string[] {
  const start = new Date(year, 0, 1); start.setDate(1 + (n - 1) * 7)
  const end = n >= 52 ? new Date(year, 11, 31) : (() => { const e = new Date(start); e.setDate(start.getDate() + 6); return e })()
  const out: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(ymd(d))
  return out
}
export const shortDate = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
