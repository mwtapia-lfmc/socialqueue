// A stable color per series, picked from its key so it never changes between visits
const PALETTE = [
  { name: 'indigo', bg: '#eef2ff', border: '#c7d2fe', solid: '#6366f1', text: '#3730a3' },
  { name: 'emerald', bg: '#ecfdf5', border: '#a7f3d0', solid: '#10b981', text: '#065f46' },
  { name: 'amber', bg: '#fffbeb', border: '#fde68a', solid: '#f59e0b', text: '#92400e' },
  { name: 'rose', bg: '#fff1f2', border: '#fecdd3', solid: '#f43f5e', text: '#9f1239' },
  { name: 'sky', bg: '#f0f9ff', border: '#bae6fd', solid: '#0ea5e9', text: '#075985' },
  { name: 'violet', bg: '#f5f3ff', border: '#ddd6fe', solid: '#8b5cf6', text: '#5b21b6' },
  { name: 'teal', bg: '#f0fdfa', border: '#99f6e4', solid: '#14b8a6', text: '#115e59' },
  { name: 'orange', bg: '#fff7ed', border: '#fed7aa', solid: '#f97316', text: '#9a3412' },
]
export type SeriesColor = (typeof PALETTE)[number]

export function seriesColor(s: { key?: string; id?: string; sort_order?: number } | null | undefined): SeriesColor {
  if (!s) return { name: 'gray', bg: '#f9fafb', border: '#e5e7eb', solid: '#9ca3af', text: '#374151' }
  if (typeof s.sort_order === 'number' && s.sort_order >= 0) return PALETTE[s.sort_order % PALETTE.length]
  const str = s.key || s.id || ''
  let h = 0; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
