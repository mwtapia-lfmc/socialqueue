'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authedFetch } from '../lib/api'
import type { TrendSource } from '../api/trends/route'
import { pickNotes, type Note } from '../lib/notes'
import { PLATFORM_LIMITS, PLATFORM_META, countChars, markdownToHtml, markdownToSocial, type Platform } from '../lib/text'
import { RATIOS, PLATFORM_RATIO } from '../lib/images'
import ImageStudio from './ImageStudio'
import PlatformPreviews, { type Identity } from './PlatformPreviews'
import SubstackPreview from './SubstackPreview'
import SubstackNotePreview from './SubstackNotePreview'
import LinkedInArticlePreview from './LinkedInArticlePreview'
import { seriesEmoji, slugTag, type StructureData, type TagInfo } from '../lib/structure'
import type { Connection } from './Accounts'

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
  overrides?: Record<string, string> | null
  accounts?: Record<string, string> | null
  // Substack content structure (null/absent for ordinary social posts)
  publication_id?: string | null
  series_id?: string | null
  bucket_id?: string | null
  format?: 'note' | 'longform' | null
  hook?: string | null
  stage?: 'idea' | 'drafting' | null
  planned_for?: string | null
  planned_time?: string | null
  source_item_id?: string | null
  tags?: string[] | null
  prompt_hint?: string | null
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
  accounts?: Partial<Record<Platform, Identity>>
  connections?: Connection[]
  structure?: StructureData | null
  tagOptions?: TagInfo[]
  trends?: TrendSource[] | null
  myNotes?: Note[]
  onNewSeries?: (name: string) => Promise<{ id: string } | null>
  item: Item | null
  onSaved: (item: Item) => void
  onScheduled: () => void
}

const TONES = ['casual', 'professional', 'funny', 'inspirational', 'urgent']
const EMOJIS = ['🔥', '✨', '🚀', '💡', '🎯', '👀', '🙌', '💯', '📣', '🧠', '❤️', '😂', '🤔', '✅', '👇', '🎉']
const PLATFORMS = Object.keys(PLATFORM_META) as Platform[]
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const empty = (connected: Partial<Record<Platform, unknown>> = {}): Omit<Item, 'id' | 'created_at' | 'updated_at'> => ({
  kind: 'post',
  title: '',
  content: '',
  tone: 'casual',
  // default to every connected account; fall back to Threads if nothing is connected yet
  platforms: Object.fromEntries(PLATFORMS.map((p) => [p, PLATFORMS.some((q) => connected[q]) ? !!connected[p] : p === 'threads'])) as Record<Platform, boolean>,
  hashtags: [],
  image_urls: [],
  analysis: null,
  overrides: {},
  accounts: {},
  status: 'draft',
  schedule_date: null,
  schedule_time: null,
})

export default function UnifiedComposer({ userId, accounts = {}, connections = [], structure = null, tagOptions = [], trends = null, myNotes = [], onNewSeries, item, onSaved, onScheduled }: Props) {
  const [id, setId] = useState<string | null>(item?.id || null)
  const [draft, setDraft] = useState(() => (item ? { ...empty(accounts), ...item } : empty(accounts)))
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [toneOffer, setToneOffer] = useState<string | null>(null)
  const [undoText, setUndoText] = useState<string | null>(null)
  const [showEvernote, setShowEvernote] = useState(false)
  const [notes, setNotes] = useState<any[] | null>(null)
  const [showSchedule, setShowSchedule] = useState(!!item?.schedule_date)
  const [scheduleDate, setScheduleDate] = useState(item?.schedule_date || '')
  const [scheduleTime, setScheduleTime] = useState(item?.schedule_time?.slice(0, 5) || '09:00')
  const [scheduling, setScheduling] = useState(false)
  const [posting, setPosting] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipNextSave = useRef(true)

  useEffect(() => {
    if (item) {
      setId(item.id || null)
      setDraft({ ...empty(accounts), ...item })
      if (item.prompt_hint) { setShowPrompt(true); setPromptText(item.prompt_hint) }
      skipNextSave.current = true
      setSaveState('idle')
    }
  }, [item])

  const update = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaveState('dirty')
  }

  type ComposeType = 'post' | 'longform'
  const typeOf = (d: { kind: string; format?: string | null; publication_id?: string | null }): ComposeType =>
    d.kind === 'blog' ? 'longform' : 'post'
  const type = typeOf(draft)
  const isLong = type === 'longform'
  const [newTag, setNewTag] = useState('')
  type Grade = { grade: string; score: number; summary: string; strengths: string[]; notes: { area: string; note: string }[] }
  const [titles, setTitles] = useState<{ title: string; style: string }[] | null>(null)
  const [titling, setTitling] = useState(false)
  const [titleSeen, setTitleSeen] = useState<string[]>([])
  const suggestTitles = async () => {
    setTitling(true)
    try {
      const ser = structure?.series.find((x) => x.id === draft.series_id)
      const r = await authedFetch('/api/suggest-titles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draft.title, hook: draft.hook, content: draft.content, series: ser?.name, tags: draft.tags || [], previous: titleSeen.slice(-12) }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setTitles(d.titles); setTitleSeen((x) => [...x, ...d.titles.map((t: any) => t.title)])
    } catch (e) { alert('Title ideas failed: ' + (e as Error).message) }
    setTitling(false)
  }
  const [hooks, setHooks] = useState<{ line: string; why: string }[] | null>(null)
  const [hooking, setHooking] = useState(false)
  const findHooks = async () => {
    setHooking(true)
    try {
      const r = await authedFetch('/api/suggest-hook', { method: 'POST', body: JSON.stringify({ title: draft.title, content: draft.content }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setHooks(d.hooks)
    } catch (e) { alert('Hook finder failed: ' + (e as Error).message) }
    setHooking(false)
  }
  const [grade, setGrade] = useState<Grade | null>(null)
  const [grading, setGrading] = useState(false)
  const gradeIt = async () => {
    setGrading(true)
    try {
      const r = await authedFetch('/api/grade-essay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draft.title, text: draft.content, kind: isLong ? 'longform' : 'post' }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setGrade(d)
    } catch (e) { alert('Grading failed: ' + (e as Error).message) }
    setGrading(false)
  }
  const [showPrompt, setShowPrompt] = useState(!!item?.prompt_hint)
  const [promptText, setPromptText] = useState(item?.prompt_hint || '')
  const [promptBusy, setPromptBusy] = useState(false)
  const [promptTrend, setPromptTrend] = useState('')
  const [promptSeries, setPromptSeries] = useState('')
  const [promptAngle, setPromptAngle] = useState('')
  const [useNotes, setUseNotes] = useState(true)
  const [promptSeen, setPromptSeen] = useState<string[]>([])
  const trendList = (trends || []).flatMap((s) => s.trends.slice(0, 8).map((t) => ({ key: `${s.key}:${t.topic}`, label: `${s.icon} ${t.topic}`, topic: t.topic, summary: t.summary })))
  const getPrompt = async () => {
    setPromptBusy(true)
    try {
      const sid = promptSeries || draft.series_id || ''
      const ser = structure?.series.find((x) => x.id === sid)
      const tr = trendList.find((t) => t.key === promptTrend)
      const r = await authedFetch('/api/writing-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        format: isLong ? 'longform' : 'note',
        series: ser ? { name: ser.name, description: ser.description } : null,
        tags: draft.tags || [],
        trend: tr ? { topic: tr.topic, summary: tr.summary } : null,
        angle: promptAngle.trim() || null,
        previous: promptSeen.slice(-5),
        notes: useNotes ? pickNotes(myNotes, [ser?.name, ser?.description, tr?.topic, promptAngle, ...(draft.tags || []), draft.title, draft.content.slice(0, 300)].filter(Boolean).join(' '), 6) : [],
      }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setPromptText(d.prompt); setPromptSeen((x) => [...x, d.prompt])
    } catch (e) { alert('Prompt failed: ' + (e as Error).message) }
    setPromptBusy(false)
  }
  const [copiedSub, setCopiedSub] = useState(false)
  const [copiedLi, setCopiedLi] = useState(false)

  const setType = (t: ComposeType) => {
    if (t === 'post') {
      const anyOn = PLATFORMS.some((q) => draft.platforms[q])
      update({ kind: 'post', format: 'note', platforms: anyOn ? draft.platforms : empty(accounts).platforms })
    } else update({ kind: 'blog', format: 'longform' })
  }
  const addTag = (raw: string) => {
    const k = slugTag(raw); if (!k || (draft.tags || []).includes(k)) { setNewTag(''); return }
    update({ tags: [...(draft.tags || []), k] }); setNewTag('')
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
        overrides: draft.overrides || {},
        accounts: draft.accounts || {},
        // Everything composed is filed under the publication: short-form as a Note/Post, long-form as Longform
        ...(structure ? {
          publication_id: draft.publication_id ?? structure.publication.id, series_id: draft.series_id ?? null, bucket_id: draft.bucket_id ?? null,
          format: typeOf(draft) === 'longform' ? 'longform' : 'note', hook: draft.hook || null, stage: draft.stage ?? 'drafting',
          planned_for: draft.planned_for || null, planned_time: draft.planned_for ? (draft.planned_time || null) : null, source_item_id: draft.source_item_id ?? null, tags: draft.tags ?? [],
        } : {}),
        updated_at: new Date().toISOString(),
        ...extra,
      }
      setSaveState('saving')
      const q = id
        ? supabase.from('items').update(payload).eq('id', id).select().single()
        : supabase.from('items').insert(payload).select().single()
      let { data, error } = await q
      if (!error) setSaveError(null)
      const OPTIONAL = ['overrides', 'accounts', 'planned_time', 'publication_id', 'series_id', 'bucket_id', 'format', 'hook', 'stage', 'planned_for', 'source_item_id', 'tags']
      if (error && new RegExp(OPTIONAL.join('|')).test(error.message)) {
        const slim: Record<string, unknown> = { ...payload }
        for (const k of OPTIONAL) delete slim[k]
        setSaveError('per-platform edits / account choice not stored until the DB is updated')
        ;({ data, error } = await (id
          ? supabase.from('items').update(slim).eq('id', id).select().single()
          : supabase.from('items').insert(slim).select().single()))
      }
      if (error) {
        console.error('Save failed:', error)
        setSaveError(error.message)
        setSaveState('error')
        return null
      }
      setId(data.id)
      setSaveState('saved')
      setSavedAt(new Date())
      onSaved(data as Item)
      return data as Item
    },
    [draft, id, userId, onSaved, structure]
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

  const rewriteInTone = async (tone: string) => {
    if (!draft.content.trim()) return
    setRewriting(true)
    try {
      const limit = draft.kind === 'post' ? Math.min(...selectedPlatforms.map((p) => PLATFORM_LIMITS[p]), 500) : undefined
      const r = await authedFetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: draft.content, tone, kind: draft.kind, limit }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setUndoText(draft.content)
      update({ content: d.text, tone })
      setToneOffer(null)
    } catch (e) { alert('Rewrite failed: ' + (e as Error).message) }
    setRewriting(false)
  }

  const analyze = async () => {
    if (!draft.content.trim()) return
    setAnalyzing(true)
    try {
      const r = await authedFetch('/api/analyze-content', {
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
    const r = await authedFetch(`/api/harvest-evernote?userId=${userId}`)
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
    setDraft(empty(accounts))
    setSaveState('idle')
    setSavedAt(null)
  }

  const selectedPlatforms = PLATFORMS.filter((p) => draft.platforms[p])
  const connsFor = (p: Platform) => connections.filter((c) => c.platform === p)
  const chosenConn = (p: Platform) => connsFor(p).find((c) => c.id === draft.accounts?.[p]) || connsFor(p)[0]
  const identities = Object.fromEntries(PLATFORMS.flatMap((p) => { const c = chosenConn(p); return c ? [[p, { handle: c.handle, avatar: c.avatar, displayName: c.displayName }]] : [] })) as Partial<Record<Platform, Identity>>
  const socialText = markdownToSocial(draft.content)
  const effectiveText = (p: Platform) => draft.overrides?.[p] ?? socialText
  const previewRatio = RATIOS[PLATFORM_RATIO[draft.kind === 'blog' ? 'blog' : selectedPlatforms[0] || 'threads']]
  const firstImage = draft.image_urls?.[0]

  const saveLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState === 'saved' && savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${saveError ? ' · ' + saveError : ''}`
    : saveState === 'error' ? `Save failed${saveError ? ': ' + saveError : ''}`
    : saveState === 'dirty' ? 'Unsaved changes'
    : id ? 'Draft' : 'New draft'

  return (
    <div className="grid lg:grid-cols-5 gap-6 sq-fade-in">
      <div className="lg:col-span-3">
        <div className="sq-card p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
              {(['post', 'longform'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`sq-tab px-4 py-1.5 rounded-full text-sm font-medium ${type === t ? 'sq-tab-active' : 'text-gray-600 hover:text-gray-900'}`}>
                  {t === 'post' ? '💬 Post / Note' : '📰 Longform'}
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
            <div>
              <div className="flex items-end gap-3">
                <input
                  value={draft.title || ''}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Blog title"
                  className="flex-1 min-w-0 text-2xl font-bold bg-transparent border-0 border-b-2 border-gray-200 focus:border-indigo-500 focus:outline-none pb-2 placeholder:text-gray-300"
                />
                <button type="button" onClick={suggestTitles} disabled={titling} className="shrink-0 mb-1.5 h-8 px-3 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 hover:bg-amber-100">{titling ? <span className="sq-pulse">Thinking…</span> : '✨ Title ideas'}</button>
              </div>
              {titles && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 space-y-1.5 sq-fade-in">
                  {titles.map((t, i) => (
                    <button key={i} type="button" onClick={() => { update({ title: t.title }); setTitles(null) }} className="w-full text-left flex items-baseline gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-100 hover:border-amber-400">
                      <span className="flex-1 text-[15px] font-medium">{t.title}</span>
                      <span className="text-[10px] uppercase text-amber-700 shrink-0">{t.style}</span>
                    </button>
                  ))}
                  <div className="flex items-center gap-3 text-xs pt-0.5">
                    <button type="button" onClick={suggestTitles} disabled={titling} className="text-amber-800 hover:underline">{titling ? 'Thinking…' : '🔄 More'}</button>
                    <button type="button" onClick={() => setTitles(null)} className="text-gray-500 hover:underline">Close</button>
                    <span className="text-gray-400">Click one to use it.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            {isLong && (
              <div className="mb-2">
                <div className="flex gap-2">
                  <input value={draft.hook || ''} onChange={(e) => update({ hook: e.target.value })} placeholder="Hook (optional): your single most quotable line. It becomes the Substack Note for this piece." title="Optional. Your best one-liner from this piece. Used as the Note when you share or repurpose it."
                className="flex-1 min-w-0 text-[15px] italic bg-orange-50/60 border border-orange-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <button type="button" onClick={findHooks} disabled={hooking || !draft.content.trim()} title="Pull the most quotable lines from what you've written" className="shrink-0 px-3 rounded-lg text-sm font-medium bg-orange-100 text-orange-900 hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap">{hooking ? <span className="sq-pulse">Reading…</span> : '✨ Find my hook'}</button>
                </div>
                {hooks && (
                  <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50/60 p-2.5 space-y-1.5 sq-fade-in">
                    {hooks.map((h, i) => (
                      <button key={i} type="button" onClick={() => { update({ hook: h.line }); setHooks(null) }} className="w-full text-left px-3 py-2 rounded-lg bg-white border border-orange-100 hover:border-orange-400">
                        <span className="block text-[15px] italic">“{h.line}”</span>
                        {h.why && <span className="block text-[11px] text-orange-800/80 mt-0.5">{h.why}</span>}
                      </button>
                    ))}
                    <div className="flex items-center gap-3 text-xs">
                      <button type="button" onClick={findHooks} disabled={hooking} className="text-orange-900 hover:underline">{hooking ? 'Reading…' : '🔄 Try again'}</button>
                      <button type="button" onClick={() => setHooks(null)} className="text-gray-500 hover:underline">Close</button>
                      <span className="text-gray-400">Your own words, pulled from the draft. Click one to use it.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
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
              <select value={draft.tone || 'casual'} onChange={(e) => { update({ tone: e.target.value }); setToneOffer(draft.content.trim() ? e.target.value : null) }}
                className="h-8 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)} tone</option>)}
              </select>
              <span className="flex-1" />
              <button type="button" onClick={() => setShowPrompt((v) => !v)} className="sq-tool h-8 px-3 rounded-lg text-sm text-amber-800 bg-amber-50 hover:bg-amber-100 font-medium">
                💡 Prompt
              </button>
              <button type="button" onClick={loadNotes} className="sq-tool h-8 px-3 rounded-lg text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-medium">
                🐘 Evernote
              </button>
            </div>

            {showPrompt && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2 sq-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-900">💡 Writing prompt <span className="font-normal text-amber-700/80">· steer it, or just hit the button</span></span>
                  <button type="button" onClick={() => setShowPrompt(false)} className="text-xs text-amber-800 hover:underline">Close</button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {trendList.length > 0 && (
                    <select value={promptTrend} onChange={(e) => setPromptTrend(e.target.value)} className="h-8 max-w-[14rem] bg-white border border-amber-200 rounded-lg px-2">
                      <option value="">Any trend / none</option>
                      {trendList.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  )}
                  {structure && (
                    <select value={promptSeries || draft.series_id || ''} onChange={(e) => setPromptSeries(e.target.value)} className="h-8 bg-white border border-amber-200 rounded-lg px-2">
                      <option value="">No series</option>
                      {structure.series.map((x) => <option key={x.id} value={x.id}>{seriesEmoji(x)} {x.name}</option>)}
                    </select>
                  )}
                  {myNotes.length > 0 && <label className="flex items-center gap-1.5 text-amber-900"><input type="checkbox" checked={useNotes} onChange={(e) => setUseNotes(e.target.checked)} /> Use my notes ({myNotes.length})</label>}
                  <input value={promptAngle} onChange={(e) => setPromptAngle(e.target.value)} placeholder="Angle (optional)" className="h-8 flex-1 min-w-[8rem] px-2 bg-white border border-amber-200 rounded-lg" />
                </div>
                {promptText && <p className="text-[15px] leading-relaxed text-amber-950 bg-white/80 rounded-lg px-3 py-2 border border-amber-100">{promptText}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={getPrompt} disabled={promptBusy} className="sq-btn-primary text-xs px-3 py-1.5 rounded-md font-semibold">{promptBusy ? <span className="sq-pulse">Thinking…</span> : promptText ? '🔄 Another' : '💡 Give me a prompt'}</button>
                  {promptText && <button type="button" onClick={() => {
                    const patch: Partial<typeof draft> = {}
                    if (promptSeries) patch.series_id = promptSeries
                    if (Object.keys(patch).length) update(patch)
                    textareaRef.current?.focus()
                  }} className="text-xs px-3 py-1.5 rounded-md bg-white border border-amber-200 text-amber-900 hover:bg-amber-100">Apply this series to the draft</button>}
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={draft.content}
              onChange={(e) => update({ content: e.target.value })}
              placeholder={type === 'longform' ? 'Write your article. **bold**, _italic_, ## headings, - lists…' : "What's happening? **bold** and _italic_ become styled text on social."}
              rows={draft.kind === 'blog' ? 14 : 7}
              className="w-full p-4 text-[15px] leading-relaxed border border-gray-200 rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />

            {(toneOffer || undoText) && (
              <div className="flex flex-wrap items-center gap-2 mt-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 sq-fade-in">
                {toneOffer && <>
                  <span className="text-xs text-indigo-900">Rewrite what you've written in a <strong>{toneOffer}</strong> tone?</span>
                  <button type="button" onClick={() => rewriteInTone(toneOffer)} disabled={rewriting} className="sq-btn-primary text-xs px-3 py-1 rounded-md font-semibold">{rewriting ? <span className="sq-pulse">Rewriting…</span> : '✨ Rewrite'}</button>
                  <button type="button" onClick={() => setToneOffer(null)} className="text-xs text-indigo-700 hover:underline">Keep mine</button>
                </>}
                {undoText && !toneOffer && <>
                  <span className="text-xs text-indigo-900">Rewritten in a <strong>{draft.tone}</strong> tone.</span>
                  <button type="button" onClick={() => { update({ content: undoText }); setUndoText(null) }} className="text-xs text-indigo-700 hover:underline">Undo</button>
                  <button type="button" onClick={() => setUndoText(null)} className="text-xs text-gray-500 hover:underline">Dismiss</button>
                </>}
              </div>
            )}
            {grade && (
              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-2 sq-fade-in">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-violet-800">{grade.grade}</span>
                  <span className="text-sm text-violet-900/80 flex-1">{grade.summary}</span>
                  <button type="button" onClick={() => setGrade(null)} className="text-xs text-violet-700 hover:underline self-start">Close</button>
                </div>
                {grade.strengths?.length > 0 && <ul className="text-sm text-emerald-800 space-y-0.5">{grade.strengths.map((x, i) => <li key={i}>✓ {x}</li>)}</ul>}
                <ul className="space-y-1.5">{grade.notes.map((n, i) => <li key={i} className="text-sm bg-white rounded-lg px-3 py-2 border border-violet-100"><span className="text-[10px] font-semibold uppercase text-violet-700 mr-1.5">{n.area}</span>{n.note}</li>)}</ul>
                <p className="text-[11px] text-violet-700/70">Notes only. Nothing was changed in your draft.</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="text-gray-400">{countChars(draft.content)} chars</span>
              <button type="button" onClick={gradeIt} disabled={grading || !draft.content.trim()} className="px-2.5 py-1 rounded-md bg-violet-100 text-violet-800 hover:bg-violet-200 font-medium disabled:opacity-50">{grading ? <span className="sq-pulse">Grading…</span> : '🎓 Grade my draft'}</button>
              {type === 'post' && selectedPlatforms.map((p) => {
                const limit = PLATFORM_LIMITS[p]
                const n = countChars(effectiveText(p))
                const cls = n > limit ? 'text-red-600 font-semibold' : n > limit * 0.9 ? 'text-amber-600' : 'text-gray-500'
                return <span key={p} className={cls}>{PLATFORM_META[p].icon} {n}/{limit}{draft.overrides?.[p] != null ? '*' : ''}</span>
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

          {structure && (
            <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-gray-700 font-medium">Series
                  <select value={draft.series_id || ''} onChange={async (e) => {
                    if (e.target.value !== '__new__') return update({ series_id: e.target.value || null })
                    const name = onNewSeries ? window.prompt('Name your new series') : null
                    if (name?.trim()) { const made = await onNewSeries!(name.trim()); if (made) update({ series_id: made.id }) }
                  }} className="h-8 text-sm bg-white border border-gray-200 rounded-lg px-2 font-normal">
                    <option value="">No series</option>
                    {onNewSeries && <option value="__new__">＋ New series…</option>}
                    {structure.series.map((x) => <option key={x.id} value={x.id}>{seriesEmoji(x)} {x.name}</option>)}
                  </select>
                </label>
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-blue-700">📅
                  <input type="date" value={draft.planned_for || ''} onChange={(e) => update({ planned_for: e.target.value || null })} className="h-6 bg-transparent text-xs" />
                  <input type="time" value={(draft.planned_time || '').slice(0, 5)} onChange={(e) => update({ planned_time: e.target.value || null, planned_for: draft.planned_for || ymdLocal(new Date()) })} className="h-6 bg-transparent text-xs" />
                  {draft.planned_for && <button type="button" onClick={() => update({ planned_for: null, planned_time: null })} className="text-blue-400 hover:text-red-600">×</button>}
                </span>
                <span className="text-gray-400">{isLong ? "Saved here, then pasted into Substack — it can't be posted to from this app." : 'Every post is also filed here as a Substack Note — saved, then pasted into Substack.'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-gray-500 mr-1">Tags</span>
                {(draft.tags || []).map((k) => {
                  const info = tagOptions.find((t) => t.key === k)
                  return <button key={k} type="button" onClick={() => update({ tags: (draft.tags || []).filter((x) => x !== k) })} title="Remove tag" className="px-2.5 py-1 rounded-full bg-orange-200 text-orange-900 hover:bg-orange-300">{info?.emoji || '🏷️'} {k} ×</button>
                })}
                {tagOptions.filter((t) => !(draft.tags || []).includes(t.key)).slice(0, 14).map((t) => (
                  <button key={t.key} type="button" onClick={() => update({ tags: [...(draft.tags || []), t.key] })} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-700">{t.emoji} {t.name}</button>
                ))}
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(newTag) } }} onBlur={() => newTag.trim() && addTag(newTag)}
                  placeholder="+ new tag" className="h-7 w-28 px-2 rounded-full border border-dashed border-orange-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-200" />
              </div>
            </div>
          )}

          {type === 'post' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-gray-400 mr-1">Publishing to <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle mx-0.5" /> =</span>
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => update({ platforms: { ...draft.platforms, [p]: !draft.platforms[p] } })}
                  title={draft.platforms[p] ? `Will publish to ${PLATFORM_META[p].label}` : `Not publishing to ${PLATFORM_META[p].label} — click to turn on`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition ${draft.platforms[p] ? PLATFORM_META[p].color + ' border-transparent shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ring-2 ${draft.platforms[p] ? 'bg-emerald-400 ring-emerald-400/40 shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'bg-gray-300 ring-transparent'}`} aria-hidden />
                  {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
                </button>
              ))}
              {structure && <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-200 bg-orange-50 text-orange-800" title="Always saved. Use Copy for Substack to post it there."><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />🗒 Substack Note · saved</span>}
              {PLATFORMS.filter((p) => draft.platforms[p] && connsFor(p).length > 1).map((p) => (
                <label key={`acct-${p}`} className="basis-full flex items-center gap-2 text-xs text-gray-600">
                  <span>{PLATFORM_META[p].icon} {PLATFORM_META[p].label} posts as</span>
                  <select value={chosenConn(p)?.id} onChange={(e) => update({ accounts: { ...(draft.accounts || {}), [p]: e.target.value } })}
                    className="h-8 text-sm bg-white border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    {connsFor(p).map((c) => <option key={c.id} value={c.id}>@{c.handle}{c.displayName ? ` — ${c.displayName}` : ''}</option>)}
                  </select>
                </label>
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
      </div>

      <div className="lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-3">
        <div className="sq-card p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">{type === 'post' ? 'Live previews' : 'Preview'}</h3>
            {type === 'post' && <span className="text-[11px] text-gray-400">click any to edit for that platform</span>}
          </div>

          {type === 'longform' ? (
            <div className="space-y-4">
              <SubstackPreview title={draft.title || ''} content={draft.content} image={firstImage} author={Object.values(identities)[0]} />
              <LinkedInArticlePreview title={draft.title || ''} content={draft.content} image={firstImage} author={identities.linkedin || Object.values(identities)[0]} />
            </div>
          ) : (
            <div className="space-y-4">
            <PlatformPreviews
              accounts={connections.length ? identities : accounts}
              selected={draft.platforms}
              onToggle={(p) => update({ platforms: { ...draft.platforms, [p]: !draft.platforms[p] } })}
              baseText={socialText}
              overrides={draft.overrides || {}}
              image={firstImage}
              onOverride={(p, text) => {
                const next = { ...(draft.overrides || {}) }
                if (text == null) delete next[p]; else next[p] = text
                update({ overrides: next })
              }}
            />
            {!draft.platforms.linkedin && (
              <PlatformPreviews previewOnly
                accounts={connections.length ? identities : accounts}
                selected={{ threads: false, twitter: false, bluesky: false, linkedin: true }}
                onToggle={() => {}}
                baseText={socialText}
                overrides={draft.overrides || {}}
                image={firstImage}
                onOverride={(p, text) => {
                  const next = { ...(draft.overrides || {}) }
                  if (text == null) delete next[p]; else next[p] = text
                  update({ overrides: next })
                }}
              />
            )}
            {structure && (
            <SubstackNotePreview text={draft.content} hook={draft.hook} author={Object.values(identities)[0]}
              series={structure?.series.find((x) => x.id === draft.series_id) ? { name: structure!.series.find((x) => x.id === draft.series_id)!.name, emoji: seriesEmoji(structure!.series.find((x) => x.id === draft.series_id)!) } : null}
              tags={(draft.tags || []).map((k) => ({ key: k, emoji: tagOptions.find((t) => t.key === k)?.emoji || '🏷️' }))} />
            )}
            </div>
          )}

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

      <div className="lg:col-span-3 lg:col-start-1">
        <div className="sq-card p-5 md:p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">🎨 Images</h3>
          <ImageStudio userId={userId} kind={draft.kind} platforms={draft.platforms} images={draft.image_urls || []} onChange={(image_urls) => update({ image_urls })} />
        </div>
      </div>

      <div className="lg:col-span-3 lg:col-start-1">
        <div className="sq-card p-4 flex flex-wrap gap-3 items-center">
          <button type="button" onClick={analyze} disabled={analyzing || !draft.content.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-50">
            {analyzing ? <span className="sq-pulse">Analyzing…</span> : '✨ Analyze'}
          </button>
          <button type="button" onClick={() => persist()} disabled={saveState === 'saving'}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200">
            {type === 'post' ? 'Save draft' : '💾 Save'}
          </button>
          {structure && (
            <button type="button" disabled={!draft.content.trim()} onClick={async () => {
              if (type === 'longform') {
                const html = `<h1>${(draft.title || '').replace(/</g, '&lt;')}</h1>${markdownToHtml(draft.content)}`
                try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([`${draft.title || ''}\n\n${draft.content}`], { type: 'text/plain' }) })]) }
                catch { await navigator.clipboard.writeText(`${draft.title || ''}\n\n${draft.content}`) }
              } else await navigator.clipboard.writeText(draft.content)
              setCopiedSub(true); setTimeout(() => setCopiedSub(false), 1800)
            }} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#ff6719] text-white hover:brightness-95 disabled:opacity-50">{copiedSub ? '✓ Copied' : 'Copy for Substack'}</button>
          )}
          {(isLong || type === 'post') && (
            <button type="button" disabled={!draft.content.trim()} onClick={async () => {
              const body = markdownToSocial(!isLong && draft.overrides?.linkedin ? draft.overrides.linkedin : draft.content)
              await navigator.clipboard.writeText(isLong && draft.title ? `${draft.title}\n\n${body}` : body)
              setCopiedLi(true); setTimeout(() => setCopiedLi(false), 1800)
            }} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0a66c2] text-white hover:brightness-110 disabled:opacity-50">{copiedLi ? '✓ Copied' : 'Copy for LinkedIn'}</button>
          )}
          <span className="flex-1" />
          {type === 'post' && !showSchedule && (
            <button type="button" onClick={postNow} disabled={posting || !draft.content.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
              {posting ? <span className="sq-pulse">Posting…</span> : '🚀 Post now'}
            </button>
          )}
          {type !== 'post' ? null : !showSchedule ? (
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


    </div>
  )
}
