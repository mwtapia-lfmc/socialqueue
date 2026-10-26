'use client'

import { authedFetch } from '../lib/api'
import { useEffect, useState } from 'react'
import { RATIOS, PLATFORM_SPEC, bestRatioFor, cropToRatio, fileToDataUrl, uploadToStorage, stampLogo, type RatioKey } from '../lib/images'
import { PLATFORM_META, type Platform } from '../lib/text'

interface Props {
  userId: string
  kind: 'post' | 'blog'
  platforms: Record<string, boolean>
  images: string[]
  onChange: (images: string[]) => void
  article?: { title?: string | null; hook?: string | null; content: string; series?: string | null; style?: string | null }
  library?: string[]
  logo?: string | null
  logoLabel?: string
}

export default function ImageStudio({ userId, kind, platforms, images, onChange, article, library = [], logo = null, logoLabel = 'series' }: Props) {
  const [stamp, setStamp] = useState(true)
  const targets = kind === 'blog' ? ['blog'] : Object.keys(platforms).filter((p) => platforms[p])
  const best = bestRatioFor(targets)
  const [ratio, setRatio] = useState<RatioKey>(best)
  const [autoRatio, setAutoRatio] = useState(true)
  // Follow the platforms until the writer picks a format by hand
  useEffect(() => { if (autoRatio) setRatio(best) }, [best, autoRatio])
  const pickRatio = (k: RatioKey) => { setRatio(k); setAutoRatio(k === best) }
  const [working, setWorking] = useState<string | null>(null)
  const previous = library.filter((u) => !images.includes(u) && u !== working)
  const [genPrompt, setGenPrompt] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [busy, setBusy] = useState<null | 'generate' | 'edit' | 'attach'>(null)
  const [note, setNote] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleUpload = async (fileOrFiles?: File | FileList | File[] | null) => {
    const files = !fileOrFiles ? [] : fileOrFiles instanceof File ? [fileOrFiles] : Array.from(fileOrFiles)
    const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, 4 - images.length)
    if (!imgs.length) { if (files.length) alert(images.length >= 4 ? 'Max 4 images per post.' : 'That file is not an image.'); return }
    setNote(null); setBusy('attach')
    try {
      const added: string[] = []
      for (const file of imgs) {
        const dataUrl = await fileToDataUrl(file)
        setWorking(dataUrl)
        const blob = await cropToRatio(dataUrl, ratio)
        added.push(await uploadToStorage(blob, userId))
      }
      onChange([...images, ...added])
      setNote(`${added.length > 1 ? `${added.length} images attached` : 'Attached'}${ratio === 'original' ? ' at original size' : `, cropped to ${RATIOS[ratio].label}`}. Pick a format above if you want it cropped for a specific platform.`)
    } catch (e) {
      const msg = (e as Error).message || String(e)
      setNote(null)
      alert(/decode|load/i.test(msg) ? 'Could not read that image. HEIC/HEIF from the camera sometimes fails — try a screenshot or JPEG.' : 'Image could not be saved: ' + msg + '\n\nIf this mentions a policy or bucket, the storage SQL in MIGRATION.md has not been run.')
    }
    setBusy(null)
  }

  const fromArticle = async () => {
    if (!article) return
    setBusy('generate')
    try {
      const r = await authedFetch('/api/image-prompt', { method: 'POST', body: JSON.stringify({ ...article, shape: RATIOS[ratio].label }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setGenPrompt(d.prompt)
      setBusy(null)
      await handleGenerate(d.prompt)
    } catch (e) { alert('Could not read the article: ' + (e as Error).message); setBusy(null) }
  }

  const handleGenerate = async (override?: string) => {
    const promptText = (override ?? genPrompt).trim()
    // Empty box: read the article and write the prompt from it
    if (!promptText) { if (article && (article.content || article.title || '').trim()) return fromArticle(); return alert('Write something first, or describe the image.') }
    setBusy('generate')
    try {
      const r = await authedFetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, size: RATIOS[ratio].genSize }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setWorking(data.imageUrl)
      setNote(data.mock ? 'Sample image — add OPENAI_API_KEY for real generation' : null)
    } catch (e) {
      alert('Generation failed: ' + (e as Error).message)
    }
    setBusy(null)
  }

  const handleEdit = async () => {
    if (!working || !editPrompt.trim()) return
    setBusy('edit')
    try {
      const blob = await (await fetch(working)).blob()
      const form = new FormData()
      form.append('image', blob, 'image.png')
      form.append('prompt', editPrompt)
      form.append('size', RATIOS[ratio].genSize)
      const r = await authedFetch('/api/edit-image', { method: 'POST', body: form })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setWorking(data.imageUrl)
      setEditPrompt('')
      setNote(data.mock ? 'Unchanged — add OPENAI_API_KEY to enable AI edits' : null)
    } catch (e) {
      alert('Edit failed: ' + (e as Error).message)
    }
    setBusy(null)
  }

  const handleAttach = async () => {
    if (!working) return
    setBusy('attach')
    try {
      let blob = await cropToRatio(working, ratio)
      if (logo && stamp) { try { blob = await stampLogo(blob, logo) } catch (e) { console.warn('logo stamp failed', e) } }
      const url = await uploadToStorage(blob, userId)
      onChange([...images, url])
      setWorking(null)
      setNote(null)
    } catch (e) {
      alert('Image could not be saved: ' + ((e as Error).message || e) + '\n\nIf this mentions a policy or bucket, the storage SQL in MIGRATION.md has not been run.')
    }
    setBusy(null)
  }

  const r = RATIOS[ratio]

  return (
    <div className={`space-y-4 relative rounded-xl transition ${dragOver ? 'ring-2 ring-indigo-400 bg-indigo-50/40' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
      onPaste={(e) => { const f = Array.from(e.clipboardData.files || []); if (f.length) { e.preventDefault(); handleUpload(f) } }}>
      {dragOver && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-white/70 pointer-events-none"><span className="text-sm font-semibold text-indigo-700">Drop to attach{ratio === 'original' ? '' : ` (crops to ${RATIOS[ratio].label})`}</span></div>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Format</span>
        {(Object.keys(RATIOS) as RatioKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickRatio(k)}
            title={RATIOS[k].hint}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              ratio === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {RATIOS[k].label}
          </button>
        ))}
        <span className="text-xs text-gray-500">{r.hint}{ratio !== 'original' ? ` · ${r.px}` : ''}</span>
      </div>
      {targets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-gray-500 mr-1">Best fit</span>
          {targets.map((p) => {
            const spec = PLATFORM_SPEC[p]; if (!spec) return null
            const ok = ratio === spec.ratio || ratio === 'original'
            const icon = p === 'blog' ? '📰' : PLATFORM_META[p as Platform]?.icon
            return <span key={p} title={spec.note} className={`px-2 py-0.5 rounded-full border ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{icon} {RATIOS[spec.ratio].label.split(' ').pop()} · {spec.size}</span>
          })}
          {ratio !== best && <button type="button" onClick={() => { setRatio(best); setAutoRatio(true) }} className="px-2 py-0.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">Use best fit ({RATIOS[best].label})</button>}
          {ratio === best && <span className="text-emerald-700">✓ matches your platforms</span>}
        </div>
      )}
      {previous.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-600">Previous art <span className="font-normal text-gray-400">· click to reuse</span></span>
          <div className="mt-1 flex gap-2 overflow-x-auto sq-scroll pb-1">
            {previous.slice(0, 30).map((u) => (
              <button key={u} type="button" onClick={() => { setWorking(u); setNote('Loaded from your previous art. Attach it, or amend it with AI.') }} className="shrink-0 h-16 w-16 rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-400 hover:shadow">
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block cursor-pointer">
            <span className="text-xs font-medium text-gray-600">Upload {busy === 'attach' && <span className="sq-pulse text-indigo-600">· saving…</span>}</span>
            <div className="mt-1 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 bg-white/60 px-3 py-4 text-center transition">
              <p className="text-sm text-gray-700"><span className="font-semibold text-indigo-700">Choose images</span> or drag &amp; drop here</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Up to 4 · also works with ⌘V paste</p>
            </div>
            <input type="file" accept="image/*" multiple disabled={busy !== null} onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }} className="sr-only" />
          </label>

          <div>
            <span className="text-xs font-medium text-gray-600">Or generate</span>
            <div className="flex gap-2 mt-1">
              <input
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGenerate())}
                placeholder={article ? "Leave blank to make one from your piece, or describe it…" : "Describe the image…"}
                className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button type="button" onClick={() => handleGenerate()} disabled={busy !== null} className="sq-btn-primary px-3 py-2 rounded-lg text-sm font-medium">
                {busy === 'generate' ? <span className="sq-pulse">{genPrompt.trim() ? 'Creating…' : 'Reading your piece…'}</span> : '✨ Generate'}
              </button>
            </div>
          </div>

          {working && (
            <div className="sq-fade-in">
              <span className="text-xs font-medium text-gray-600">Amend with AI</span>
              <div className="flex gap-2 mt-1">
                <input
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleEdit())}
                  placeholder="e.g. make the sky sunset orange, add a coffee cup"
                  className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button type="button" onClick={handleEdit} disabled={busy !== null} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
                  {busy === 'edit' ? <span className="sq-pulse">Editing…</span> : 'Apply'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div
            className="relative w-full rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center"
            style={ratio === 'original' ? { minHeight: 120, maxHeight: 260 } : { aspectRatio: `${r.w} / ${r.h}`, maxHeight: 260 }}
          >
            {working ? (
              <img src={working} alt="Working" className={ratio === 'original' ? 'max-w-full max-h-[260px] object-contain' : 'w-full h-full object-cover'} />
            ) : (
              <span className="text-xs text-gray-400">{r.label} preview</span>
            )}
            {working && (
              <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                {ratio === 'original' ? 'no crop' : `will crop to ${r.w}:${r.h}`}
              </span>
            )}
          </div>
          {working && logo && (
            <label className="flex items-center gap-2 mt-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} />
              <img src={logo} alt="" className="h-5 w-5 rounded object-cover border border-gray-200" />
              Stamp the {logoLabel} logo in the corner
            </label>
          )}
          {working && (
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={handleAttach} disabled={busy !== null} className="sq-btn-primary flex-1 py-2 rounded-lg text-sm font-medium">
                {busy === 'attach' ? <span className="sq-pulse">Saving…</span> : ratio === 'original' ? 'Attach as is' : `Crop to ${r.w}:${r.h} & attach`}
              </button>
              <button type="button" onClick={() => setWorking(null)} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                Discard
              </button>
            </div>
          )}
          {note && <p className="text-xs text-amber-600 mt-2">{note}</p>}
        </div>
      </div>

      {images.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-600">Attached ({images.length})</span>
          <div className="flex gap-2 mt-1 flex-wrap">
            {images.map((src, i) => (
              <div key={i} className="relative group">
                <img src={src} alt="" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
