'use client'

import { useState } from 'react'
import { HEADLINE_BEST, HOOK_BEST, IMAGE_BEST, type SeriesRule, type SeriesRules } from '../lib/seriesRules'
import { EMOJI_CHOICES, seriesEmoji, type Series } from '../lib/structure'
import { seriesColor } from '../lib/seriesColor'

export default function SeriesRulesEditor({ series, rules, onSave, onRename, onEmoji, onLogo }: { series: Series[]; rules: SeriesRules; onSave: (id: string, r: SeriesRule) => Promise<void>; onRename: (id: string, patch: { name?: string; description?: string }) => Promise<void>; onEmoji: (id: string, emoji: string) => Promise<void>; onLogo: (id: string, file: File | null) => Promise<void> }) {
  const [emojiFor, setEmojiFor] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<SeriesRule>({})
  const [saving, setSaving] = useState(false)
  const [showBest, setShowBest] = useState(false)
  const start = (id: string) => { const sr = series.find((x) => x.id === id); setOpen(open === id ? null : id); setForm(rules[id] || {}); setTitle(sr?.name || ''); setSubject(sr?.description || sr?.name || '') }
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
          const c = seriesColor(s)
          return (
            <div key={s.id} className="rounded-xl border-2 overflow-hidden" style={{ background: c.bg, borderColor: open === s.id ? c.solid : c.border }}>
              <div role="button" tabIndex={0} onClick={() => start(s.id)} onKeyDown={(e) => e.key === 'Enter' && start(s.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer">
                <span className="relative shrink-0">
                  <span role="button" tabIndex={0} title="Change emoji" onClick={(e) => { e.stopPropagation(); setEmojiFor(emojiFor === s.id ? null : s.id) }} onKeyDown={(e) => e.key === 'Enter' && setEmojiFor(s.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-lg cursor-pointer hover:ring-2 hover:ring-white" style={{ background: c.solid + '26' }}>{seriesEmoji(s)}</span>
                  {emojiFor === s.id && (
                    <>
                      <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setEmojiFor(null) }} />
                      <span className="absolute left-0 top-full mt-1 z-50 grid grid-cols-8 gap-1 p-2 rounded-xl bg-white border border-gray-200 shadow-xl w-[272px]" onClick={(e) => e.stopPropagation()}>
                        {EMOJI_CHOICES.map((em) => <button key={em} type="button" onClick={() => { onEmoji(s.id, em); setEmojiFor(null) }} className="h-8 w-8 rounded-lg hover:bg-gray-100 text-lg">{em}</button>)}
                      </span>
                    </>
                  )}
                </span>
                <span className="flex-1 text-sm font-bold truncate" style={{ color: c.text }}>{s.name}</span>
                {r.titleFormat && <span className="text-[11px] text-gray-500 truncate max-w-[10rem]">{r.titleFormat}</span>}
                <span className="text-[11px] text-gray-400">{set.length ? `${set.length} rule${set.length > 1 ? 's' : ''}` : 'best practices only'}</span>
                <span className="text-gray-400 text-xs">{open === s.id ? '▾' : '▸'}</span>
              </div>
              {open === s.id && (
                <div className="px-3 pb-3 pt-1 space-y-3 bg-white/70">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block"><span className="text-xs font-semibold text-gray-700">Title</span>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Series name" className="mt-1 w-full h-9 px-3 text-sm font-semibold border border-gray-200 rounded-lg bg-white" /></label>
                    <label className="block"><span className="text-xs font-semibold text-gray-700">Subject</span>
                      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What this series is about" className="mt-1 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" /></label>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-700">Logo</span>
                    {s.logo_url ? <img src={s.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-gray-200 bg-white" /> : <span className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">none</span>}
                    <label className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-indigo-400 cursor-pointer font-medium">{s.logo_url ? 'Replace' : 'Upload'}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(s.id, f); e.target.value = '' }} /></label>
                    {s.logo_url && <button type="button" onClick={() => onLogo(s.id, null)} className="text-xs text-gray-500 hover:text-red-600">Remove</button>}
                    <span className="text-[11px] text-gray-400">Stamped in the corner of generated images. PNG with a clear background works best.</span>
                  </div>
                  {field('titleFormat', 'Post title format', 'REVIEW: ____', 1)}
                  <p className="-mt-2 text-[11px] text-gray-400">Posts in this series start their title with the part before ____.</p>
                  {field('headline', 'Headline rules for this series', 'e.g. Always name the film and the director. Lead with my verdict.')}
                  {field('hook', 'Hook rules for this series', 'e.g. Use my harshest line. One sentence.')}
                  {field('image', 'Image style', `e.g. 70s film poster, grainy, warm colors.  (Default: ${IMAGE_BEST.slice(0, 80)}…)`, 2)}
                  <div className="flex items-center gap-2">
                    <button disabled={saving} onClick={async () => {
                      setSaving(true)
                      const patch: { name?: string; description?: string } = {}
                      if (title.trim() && title.trim() !== s.name) patch.name = title.trim()
                      if (subject.trim() !== (s.description || '')) patch.description = subject.trim()
                      if (Object.keys(patch).length) await onRename(s.id, patch)
                      await onSave(s.id, form); setSaving(false); setOpen(null) }} className="sq-btn-primary text-sm px-4 py-1.5 rounded-lg font-semibold">{saving ? 'Saving…' : 'Save'}</button>
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
