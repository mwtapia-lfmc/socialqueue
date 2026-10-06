import type { Platform } from './text'

export interface Rhythm { key: string; label: string; blurb: string; weekdays: boolean[]; times: string[]; platform?: Platform }

export const RHYTHMS: Rhythm[] = [
  { key: 'balanced', label: 'Balanced', blurb: 'Weekdays, three slots a day. Safe everywhere.', weekdays: [false, true, true, true, true, true, false], times: ['09:00', '12:30', '18:00'] },
  { key: 'threads', label: 'Threads daily', blurb: '2–3 a day incl. weekends; conversation over volume.', weekdays: [true, true, true, true, true, true, true], times: ['09:00', '13:00', '19:00'], platform: 'threads' },
  { key: 'bluesky', label: 'Bluesky', blurb: 'Chronological feed — recency wins. Spaced, not clustered.', weekdays: [true, true, true, true, true, true, true], times: ['10:00', '17:00'], platform: 'bluesky' },
  { key: 'x', label: 'X growth', blurb: 'Several a day at commute and evening peaks.', weekdays: [true, true, true, true, true, true, true], times: ['08:30', '12:00', '18:30', '21:00'], platform: 'twitter' },
  { key: 'linkedin', label: 'LinkedIn 3×/week', blurb: 'Tue–Thu mornings only. More than one a day hurts.', weekdays: [false, false, true, true, true, false, false], times: ['07:45'], platform: 'linkedin' },
]

// Platform rules used to warn while spreading
export const RULES: Record<Platform, { maxPerDay: number; minGapMin: number; note: string }> = {
  threads: { maxPerDay: 5, minGapMin: 90, note: 'Threads rewards replies; space posts so each gets its own conversation.' },
  bluesky: { maxPerDay: 4, minGapMin: 120, note: 'Bluesky is chronological — clustered posts bury each other.' },
  twitter: { maxPerDay: 10, minGapMin: 45, note: 'X is fine with volume, but avoid links (suppressed + 13× API cost).' },
  linkedin: { maxPerDay: 1, minGapMin: 18 * 60, note: 'LinkedIn cannibalizes a post if another lands within ~18 hours.' },
}

export interface Warning { platform: Platform; message: string }

export function checkCadence(entries: { platforms: Record<Platform, boolean>; date: string; time: string }[]): Warning[] {
  const out: Warning[] = []
  const byPlatform = new Map<Platform, number[]>()
  for (const e of entries) {
    const t = new Date(`${e.date}T${e.time}:00`).getTime()
    for (const p of Object.keys(e.platforms) as Platform[]) if (e.platforms[p]) byPlatform.set(p, [...(byPlatform.get(p) || []), t])
  }
  for (const [p, ts] of byPlatform) {
    const rule = RULES[p]
    ts.sort((a, b) => a - b)
    const perDay = new Map<string, number>()
    for (const t of ts) { const k = new Date(t).toDateString(); perDay.set(k, (perDay.get(k) || 0) + 1) }
    const over = [...perDay.entries()].filter(([, n]) => n > rule.maxPerDay)
    if (over.length) out.push({ platform: p, message: `${over.length} day${over.length > 1 ? 's' : ''} with more than ${rule.maxPerDay} post${rule.maxPerDay > 1 ? 's' : ''} (${over.map(([d, n]) => `${new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}: ${n}`).join(', ')}). ${rule.note}` })
    let tight = 0
    for (let i = 1; i < ts.length; i++) if ((ts[i] - ts[i - 1]) / 60000 < rule.minGapMin) tight++
    if (tight && !over.length) out.push({ platform: p, message: `${tight} pair${tight > 1 ? 's' : ''} of posts closer than ${rule.minGapMin >= 60 ? `${Math.round(rule.minGapMin / 60)}h` : `${rule.minGapMin}m`} apart. ${rule.note}` })
  }
  return out
}
