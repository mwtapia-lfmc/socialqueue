'use client'

import { WEEKDAYS, type SeriesDays } from '../lib/seriesDays'
import { seriesEmoji, type Series } from '../lib/structure'
import { seriesColor } from '../lib/seriesColor'

const ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function SeriesDaysEditor({ series, days, onChange }: { series: Series[]; days: SeriesDays; onChange: (d: SeriesDays) => void }) {
  const todayIdx = new Date().getDay()
  return (
    <div id="series-days" className="sq-card p-4 mb-4">
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-sm font-semibold">Series by day</h3>
        <span className="text-[11px] text-gray-400">Home's daily prompt follows this</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {ORDER.map((d) => {
          const sr = series.find((x) => x.id === days[d]) || null
          const c = seriesColor(sr)
          return (
          <label key={d} className={`rounded-xl border-2 px-2.5 py-2 text-xs ${d === todayIdx ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`} style={{ background: sr ? c.bg : 'rgba(255,255,255,0.7)', borderColor: sr ? c.border : '#e5e7eb' }}>
            <span className="flex items-center gap-1.5 font-semibold mb-1" style={{ color: sr ? c.text : '#374151' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: sr ? c.solid : '#d1d5db' }} />{WEEKDAYS[d].slice(0, 3)}{d === todayIdx ? ' · today' : ''}
            </span>
            <select value={days[d] || ''} onChange={(e) => onChange({ ...days, [d]: e.target.value || null })} className="w-full h-8 text-sm bg-white border border-gray-200 rounded-lg px-1.5">
              <option value="">Open</option>
              {series.map((s) => <option key={s.id} value={s.id}>{seriesEmoji(s)} {s.name}</option>)}
            </select>
          </label>
          )
        })}
      </div>
    </div>
  )
}
