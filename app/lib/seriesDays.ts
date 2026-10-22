import type { Series } from './structure'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// weekday index (0 = Sunday) → series id, or null for an open day
export type SeriesDays = Record<string, string | null>

export const INDUSTRY = ['media and media literacy', 'the creator economy', 'music and culture']

// Default: one series per weekday starting Monday, weekends open
export function defaultSeriesDays(series: Series[]): SeriesDays {
  const active = series.filter((s) => s.is_active !== false)
  const out: SeriesDays = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
  active.slice(0, 5).forEach((s, i) => { out[i + 1] = s.id })
  return out
}
