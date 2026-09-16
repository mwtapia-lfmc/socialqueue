'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authedFetch } from '../lib/api'
import { PLATFORM_LIMITS, PLATFORM_META, countChars, markdownToHtml, markdownToSocial, type Platform } from '../lib/text'
import { RATIOS, PLATFORM_RATIO } from '../lib/images'
import ImageStudio from './ImageStudio'

export interface Item {
  id: string
  kind: 'post' | 'blog'
  title: string | null
  content: string
  tone: string | null
  platforms: Record<Platform, boolean>
  hashtags: string[] | null
  image_urls: string[] | null
  analysis: any
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  published_at?: string | null
  publish_log?: Record<string, { ok: boolean; url?: string; error?: string }> | null
  schedule_date: string | null
  schedule_time: string | null
  created_at: string
  updated_at: string
}

interface Props {
  userId: string
  item: Item | null
  onSaved: (item: Item) => void
  onScheduled: () => void
}

const TONES = ['casual', 'professional', 'funny', 'inspirational', 'urgent']
const EMOJIS = ['🔥', '✨', '🚀', '💡', '🎯', '👀', '🙌', '💯', '📣', '🧠', '❤️', '😂', '🤔', '✅', '👇', '🎉']
const PLATFORMS = Object.keys(PLATFORM_META) as Platform[]

const empty = (): Omit<Item, 'id' | 'created_at' | 'updated_at'> => ({
  kind: 'post',
  title: '',
  content: '',
  tone: 'casual',
  platforms: { threads: true, twitter: false, bluesky: false },
  hashtags: [],
  image_urls: [],
  analysis: null,
  status: 'draft',
  schedule_date: null,
  schedule_time: null,
})

export default function UnifiedComposer({ userId, item, onSaved, onScheduled }: Props) {
  const [id, setId] = useState<string | null>(item?.id ?? null)
  const [draft, setDraft] = useState(() => (item ? { ...empty(), ...item } : empty()))
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showEvernote, setShowEvernote] = useState(false)
  const [notes, setNotes] = useState<any[] | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduling, setScheduling] = useState(false)
  const [posting, setPosting] = useState(false)
  const [previewTab, setPreviewTab] = useState<Platform | 'blog'>('threads')
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipNextSave = useRef(true)

  useEffect(() => {
    if (item) {
      setId(item.id)
      setDraft({ ...empty(), ...item })
      skipNextSave.current = true
      setSaveState('idle')
    }
  }, [item])

  const update = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaveState('dirty')
  }

  const persist = useCallback(
    async (extra: Partial<Item> = {}) => {
      const payload = {
        user_id: userId,
        kind: draft.kind,
        title: draft.title || null,
        content: draft.content,
        tone: draft.tone,
        platforms: draft.platforms,
        hashtags: draft.hashtags,
        image_urls: draft.image_urls,
        analysis: draft.analysis,
        updated_at: new Date().toISOString(),
        ...extra,
      }
      setSaveState('saving')
      const q = id
        ? supabase.from('items').update(payload).eq('id', id).select().single()
        : supabase.from('items').insert(payload).select().single()
      const { data, error } = await q
      if (error) {
        console.error('Save failed:', error)
        setSaveState('error')
        return null
      }
      setId(data.id)
      setSaveState('saved')
      setSavedAt(new Date())
      onSaved(data as Item)
      return data as Item
    },
    [draft, id, userId, onSaved]
  )

  useEffect(() => {
    if (skipNextSave.current) { skipNextSave.current = false; return }
    if (saveState !== 'dirty') return
    const meaningful = draft.content.trim() || (draft.title || '').trim() || (draft.image_urls || []).length
    if (!meaningful) return
    const t = setTimeout(() => persist(), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saveState])

  const wrap = (before: string, after = before) => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const sel = value.slice(s, e) || 'text'
    const next = value.slice(0, s) + before + sel + after + value.slice(e)
    update({ content: next })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length) })
  }
  const prefixLines = (prefix: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const block = value.slice(lineStart, e)
    const prefixed = block.split('\n').map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l)).join('\n')
    update({ content: value.slice(0, lineStart) + prefixed + value.slice(e) })
    requestAnimationFrame(() => ta.focus())
  }
  const insert = (text: string) => {
    const ta = textareaRef.current
    if (!ta) { update({ content: draft.content + text }); return }
    const { selectionStart: s, selectionEnd: e, value } = ta
    update({ content: value.slice(0, s) + text + value.slice(e) })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + text.length, s + text.length) })
  }
  const addLink = () => {
    const url = window.prompt('Link URL')
    if (url) wrap('[', `](${url})`)
  }

  const analyze = async () => {
    if (!draft.content.trim()) return
    setAnalyzing(true)
    try {
      const r = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.title, content: draft.content, contentType: draft.kind }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const merged = Array.from(new Set([...(draft.hashtags || []), ...(data.suggestedHashtags || [])]))
      update({ analysis: data, hashtags: merged })
    } catch (e) {
      alert('Analysis failed: ' + (e as Error).message)
    }
    setAnalyzing(false)
  }

  const loadNotes = async () => {
    setShowEvernote(true)
    if (notes) return
    const r = await fetch(`/api/harvest-evernote?userId=${userId}`)
    const data = await r.json()
    setNotes(data.notes || [])
  }

  const schedule = async () => {
    if (!scheduleDate || !scheduleTime) { alert('Pick a date and time'); return }
    setScheduling(true)
    const saved = await persist({ status: 'scheduled', schedule_date: scheduleDate, schedule_time: scheduleTime })
    setScheduling(false)
    if (!saved) return
    setShowSchedule(false)
    reset()
    onScheduled()
  }

  const postNow = async () => {
    if (!confirm('Publish this to the selected platforms right now?')) return
    setPosting(true)
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const saved = await persist({ status: 'scheduled', schedule_date: date, schedule_time: time })
    if (!saved) { setPosting(false); return }
    const r = await authedFetch('/api/publish', { method: 'POST', body: JSON.stringify({ id: saved.id }) })
    const data = await r.json()
    setPosting(false)
    if (!r.ok) { alert(data.error || 'Publish failed'); onScheduled(); return }
    const failures = Object.entries(data.log || {}).filter(([, v]: any) => !v.ok)
    if (failures.length) alert('Some platforms failed:\n' + failures.map(([p, v]: any) => `${p}: ${v.error}`).join('\n'))
    reset()
    onScheduled()
  }

  const reset = () => {
    skipNextSave.current = true
    setId(null)
    setDraft(empty())
    setSaveState('idle')
    setSavedAt(null)
  }

  const selectedPlatforms = PLATFORMS.filter((p) => draft.platforms[p])
  const socialText = markdownToSocial(draft.content)
  const socialLen = countChars(socialText)
  const activePreview: Platform | 'blog' =
    draft.kind === 'blog' ? 'blog' : selectedPlatforms.includes(previewTab as Platform) ? previewTab : selectedPlatforms[0] || 'threads'
  const previewRatio = RATIOS[PLATFORM_RATIO[activePreview]]
  const firstImage = draft.image_urls?.[0]

  const saveLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' && savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : saveState === 'error' ? 'Save failed — run the items table SQL?'
    : saveState === 'dirty' ? 'Unsaved changes'
    : id ? 'Draft' : 'New draft'

  return (
    <div className="grid lg:grid-cols-5 gap-6 sq-fade-in">
      <div className="lg:col-span-3 space-y-5">
        <div className="sq-card p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
              {(['post', 'blog'] as const).map((k) => (
                <button key={k} type="button" onClick={() => update({ kind: k })}
                  className={`sq-tab px-4 py-1.5 rounded-full text-sm font-medium ${draft.kind === k ? 'sq-tab-active' : 'text-gray-600 hover:text-gray-900'}`}>
                  {k === 'post' ? '💬 Post' : '📝 Blog'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1.5 ${saveState === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                <span className={`h-2 w-2 rounded-full ${saveState === 'saving' ? 'bg-amber-400 sq-pulse' : saveState === 'saved' ? 'bg-emerald-500' : saveState === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
                {saveLabel}
              </span>
              {(id || draft.content) && (
                <button type="button" onClick={reset} className="text-indigo-600 hover:underline">+ New</button>
              )}
            </div>
          </div>

          {draft.kind === 'blog' && (
            <input
              value={draft.title || ''}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Blog title"
              className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 border-gray-200 focus:border-indigo-500 focus:outline-none pb-2 placeholder:text-gray-300"
            />
          )}

          <div>
            <div className="flex flex-wrap items-center gap-1 mb-2 relative">
              {[
                { label: 'B', title: 'Bold', act: () => wrap('**'), cls: 'font-bold' },
                { label: 'I', title: 'Italic', act: () => wrap('_'), cls: 'italic' },
                { label: 'H', title: 'Heading', act: () => prefixLines('## '), cls: 'font-semibold' },
                { label: '•', title: 'Bullet list', act: () => prefixLines('- ') },
                { label: '❝', title: 'Quote', act: () => prefixLines('> ') },
                { label: '🔗', title: 'Link', act: addLink },
              ].map((b) => (
                <button key={b.title} type="button" title={b.title} onClick={b.act}
                  className={`sq-tool h-8 min-w-8 px-2 rounded-lg text-sm text-gray-700 ${b.cls || ''}`}>
                  {b.label}
                </button>
              ))}
              <button type="button" title="Emoji" onClick={() => setShowEmoji((v) => !v)} className="sq-tool h-8 px-2 rounded-lg text-sm">😊</button>
              {showEmoji && (
                <div className="absolute top-9 left-0 z-10 sq-card p-2 grid grid-cols-8 gap-1 sq-fade-in">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => { insert(e); setShowEmoji(false) }} className="sq-tool h-8 w-8 rounded-lg text-lg">{e}</button>
                  ))}
                </div>
              )}
              <span className="mx-1 h-5 w-px bg-gray-200" />
              <select value={draft.tone || 'casual'} onChange={(e) => update({ tone: e.target.value })}
                className="h-8 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)} tone</option>)}
              </select>
              <span className="flex-1" />
              <button type="button" onClick={loadNotes} className="sq-tool h-8 px-3 rounded-lg text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-medium">
                🐘 Evernote
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={draft.content}
              onChange={(e) => update({ content: e.target.value })}
              placeholder={draft.kind === 'blog' ? 'Write your post. **bold**, _italic_, ## headings, - lists…' : "What's happening? **bold** and _italic_ become styled text on social."}
              rows={draft.kind === 'blog' ? 14 : 7}
              className="w-full p-4 text-[15px] leading-relaxed border border-gray-200 rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="text-gray-400">{countChars(draft.content)} chars</span>
              {draft.kind === 'post' && selectedPlatforms.map((p) => {
                const limit = PLATFORM_LIMITS[p]
                const pct = socialLen / limit
                const cls = pct > 1 ? 'text-red-600 font-semibold' : pct > 0.9 ? 'text-amber-600' : 'text-gray-500'
                return <span key={p} className={cls}>{PLATFORM_META[p].icon} {socialLen}/{limit}</span>
              })}
            </div>
          </div>

          {showEvernote && (
            <div className="sq-fade-in rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-emerald-900">Import from Evernote</span>
                <button type="button" onClick={() => setShowEvernote(false)} className="text-emerald-700 text-sm">Close</button>
              </div>
              {!notes ? <p className="text-sm text-emerald-700 sq-pulse">Loading notes…</p> : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {notes.map((n) => (
                    <div key={n.id} className="bg-white rounded-lg p-3 flex gap-3 items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{n.content}</p>
                      </div>
                      <button type="button" onClick={() => { update({ title: n.title, content: n.content }); setShowEvernote(false) }}
                        className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shrink-0">Use</button>
                    </div>
                  ))}
                  <p className="text-[11px] text-emerald-700/80">Sample notes until Evernote credentials are added.</p>
                </div>
              )}
            </div>
          )}

          {draft.kind === 'post' && (
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => update({ platforms: { ...draft.platforms, [p]: !draft.platforms[p] } })}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${draft.platforms[p] ? PLATFORM_META[p].color + ' border-transparent shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
                </button>
              ))}
            </div>
          )}

          {(draft.hashtags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.hashtags!.map((h) => (
                <button key={h} type="button" onClick={() => insert(` #${h}`)} title="Insert" className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100">#{h}</button>
              ))}
            </div>
          )}
        </div>

        <div className="sq-card p-5 md:p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">🎨 Images</h3>
          <ImageStudio userId={userId} kind={draft.kind} platforms={draft.platforms} images={draft.image_urls || []} onChange={(image_urls) => update({ image_urls })} />
        </div>

        <div className="sq-card p-4 flex flex-wrap gap-3 items-center">
          <button type="button" onClick={analyze} disabled={analyzing || !draft.content.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-50">
            {analyzing ? <span className="sq-pulse">Analyzing…</span> : '✨ Analyze'}
          </button>
          <button type="button" onClick={() => persist()} disabled={saveState === 'saving'}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200">
            Save draft
          </button>
          <span className="flex-1" />
          {draft.kind === 'post' && !showSchedule && (
            <button type="button" onClick={postNow} disabled={posting || !draft.content.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
              {posting ? <span className="sq-pulse">Posting…</span> : '🚀 Post now'}
            </button>
          )}
          {!showSchedule ? (
            <button type="button" onClick={() => setShowSchedule(true)} disabled={!draft.content.trim()} className="sq-btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">
              📅 Schedule →
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 sq-fade-in">
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="h-10 px-2 text-sm border border-gray-200 rounded-lg" />
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="h-10 px-2 text-sm border border-gray-200 rounded-lg" />
              <button type="button" onClick={schedule} disabled={scheduling} className="sq-btn-primary h-10 px-4 rounded-lg text-sm font-semibold">
                {scheduling ? 'Scheduling…' : 'Confirm'}
              </button>
              <button type="button" onClick={() => setShowSchedule(false)} className="h-10 px-3 text-sm text-gray-500">Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-5">
        <div className="sq-card p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Preview</h3>
            {draft.kind === 'post' && selectedPlatforms.length > 1 && (
              <div className="flex gap-1">
                {selectedPlatforms.map((p) => (
                  <button key={p} type="button" onClick={() => setPreviewTab(p)}
                    className={`h-7 w-7 rounded-full text-sm ${activePreview === p ? PLATFORM_META[p].color : 'bg-gray-100'}`} title={PLATFORM_META[p].label}>
                    {PLATFORM_META[p].icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
              <div>
                <p className="text-sm font-semibold leading-tight">You</p>
                <p className="text-[11px] text-gray-400">{activePreview === 'blog' ? 'Blog draft' : `@you · ${PLATFORM_META[activePreview as Platform].label}`}</p>
              </div>
            </div>
            {activePreview === 'blog' ? (
              <>
                {draft.title && <h1 className="text-xl font-bold mb-2">{draft.title}</h1>}
                {firstImage && <img src={firstImage} alt="" className="w-full rounded-xl mb-3 object-cover" style={{ aspectRatio: `${previewRatio.w} / ${previewRatio.h}` }} />}
                <div className="sq-preview text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: markdownToHtml(draft.content) || '<p class="text-gray-300">Your blog will render here…</p>' }} />
              </>
            ) : (
              <>
                <p className="text-[15px] whitespace-pre-wrap break-words text-gray-900 min-h-6">{socialText || <span className="text-gray-300">Your post will appear here…</span>}</p>
                {firstImage && <img src={firstImage} alt="" className="w-full rounded-xl mt-3 object-cover" style={{ aspectRatio: `${previewRatio.w} / ${previewRatio.h}` }} />}
                <div className="flex gap-6 mt-3 text-gray-400 text-sm"><span>♡</span><span>💬</span><span>↻</span><span>↗</span></div>
              </>
            )}
          </div>

          {draft.analysis && (
            <div className="mt-4 space-y-3 sq-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-purple-50 p-3">
                  <p className="text-[11px] text-purple-700">Engagement</p>
                  <p className="text-2xl font-bold text-purple-700">{draft.analysis.engagement_score}<span className="text-sm font-normal">/10</span></p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-[11px] text-blue-700">Best time</p>
                  <p className="text-sm font-semibold text-blue-800 leading-snug">{draft.analysis.best_publish_time}</p>
                </div>
              </div>
              {draft.analysis.suggestions && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{draft.analysis.suggestions}</p>}
              {draft.analysis.headline_variations?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Headline ideas · click to use</p>
                  {draft.analysis.headline_variations.map((h: string) => (
                    <button key={h} type="button" onClick={() => update(draft.kind === 'blog' ? { title: h } : { content: h + '\n\n' + draft.content })}
                      className="block w-full text-left text-xs text-gray-800 hover:bg-indigo-50 rounded px-2 py-1">→ {h}</button>
                  ))}
                </div>
              )}
              {draft.analysis.trending_topics?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draft.analysis.trending_topics.map((t: string) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{t}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
