'use client'

import { useState } from 'react'
import { HEADLINE_BEST, HOOK_BEST, IMAGE_BEST, type SeriesRule, type SeriesRules } from '../lib/seriesRules'
import { seriesEmoji, type Series } from '../lib/structure'

export default function SeriesRulesEditor({ series, rules, onSave }: { series: Series[]; rules: SeriesRules; onSave: (id: string, r: SeriesRule) => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<SeriesRule>({})
  const [saving, setSaving] = useState(false)
  const [showBest, setShowBest] = useState(false)
  const start = (id: string) => { setOpen(open === id ? null : id); setForm(rules[id] || {}) }
  const field = (k: keyof SeriesRule, label: string, help: string, rows = 3) => (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      {rows === 1
        ? <input value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={help} className="mt-1 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
        : <textarea value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={rows} placeholder={help} className="mt-1 w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white" />}
    </label>
  )
  return (
    <div className="sq-card p-4 mb-4">
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold">Series rules</h3>
        <span className="text-[11px] text-gray-400">Title format, headline, hook and image style for each series. The AI buttons follow these.</span>
        <button onClick={() => setShowBest((v) => !v)} className="text-[11px] text-indigo-600 hover:underline ml-auto">{showBest ? 'Hide' : 'Show'} best practices</button>
      </div>
      {showBest && (
        <div className="grid md:grid-cols-2 gap-3 mb-3 text-xs text-gray-600">
          <div className="rounded-lg bg-gray-50 p-3"><p className="font-semibold text-gray-800 mb-1">Headlines</p><pre className="whitespace-pre-wrap font-sans">{HEADLINE_BEST}</pre></div>
          <div className="rounded-lg bg-gray-50 p-3"><p className="font-semibold text-gray-800 mb-1">Hooks</p><pre className="whitespace-pre-wrap font-sans">{HOOK_BEST}</pre></div>
          <p className="md:col-span-2 text-[11px] text-gray-400">These apply to every series automatically. Anything you write below is added on top for that series.</p>
        </div>
      )}
      <div className="space-y-2">
        {series.map((s) => {
          const r = rules[s.id] || {}
          const set = [r.titleFormat && 'title', r.headline && 'headline', r.hook && 'hook', r.image && 'image'].filter(Boolean)
          return (
            <div key={s.id} className="rounded-xl border border-gray-100 bg-white/60">
              <button onClick={() => start(s.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                <span>{seriesEmoji(s)}</span>
                <span className="flex-1 text-sm font-semibold truncate">{s.name}</span>
                {r.titleFormat && <span className="text-[11px] text-gray-500 truncate max-w-[10rem]">{r.titleFormat}</span>}
                <span className="text-[11px] text-gray-400">{set.length ? `${set.length} rule${set.length > 1 ? 's' : ''}` : 'best practices only'}</span>
                <span className="text-gray-400 text-xs">{open === s.id ? '▾' : '▸'}</span>
              </button>
              {open === s.id && (
                <div className="px-3 pb-3 space-y-3">
                  {field('titleFormat', 'Title format', 'e.g. REVIEW: ____  (the part before ____ is filled in automatically)', 1)}
                  {field('headline', 'Headline rules for this series', 'e.g. Always name the film and the director. Lead with my verdict.')}
                  {field('hook', 'Hook rules for this series', 'e.g. Use my harshest line. One sentence.')}
                  {field('image', 'Image style', `e.g. 70s film poster, grainy, warm colors.  (Default: ${IMAGE_BEST.slice(0, 80)}…)`, 2)}
                  <div className="flex items-center gap-2">
                    <button disabled={saving} onClick={async () => { setSaving(true); await onSave(s.id, form); setSaving(false); setOpen(null) }} className="sq-btn-primary text-sm px-4 py-1.5 rounded-lg font-semibold">{saving ? 'Saving…' : 'Save rules'}</button>
                    <button onClick={() => setOpen(null)} className="text-sm text-gray-500 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
