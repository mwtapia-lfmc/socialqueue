'use client'

import { useMemo, useState } from 'react'
import { parseNoteFile, pickNotes, notebookOf, isEmptyNote, type Note } from '../lib/notes'
import { timeAgo } from '../lib/text'

type Brand = 'evernote' | 'apple' | null
const BRAND = {
  evernote: { off: 'bg-[#00A82D]/10 border-[#00A82D]/40 hover:border-[#00A82D]', on: 'bg-[#00A82D] border-[#00A82D] text-white shadow-lg', chip: 'bg-white/25', sub: 'text-white/85', chipOff: 'bg-[#00A82D]/15 text-[#007a20]' },
  apple: { off: 'bg-[#FFCC00]/15 border-[#FFCC00]/60 hover:border-[#FFCC00]', on: 'bg-[#FFCC00] border-[#FFCC00] text-gray-900 shadow-lg', chip: 'bg-black/10', sub: 'text-gray-800/75', chipOff: 'bg-[#FFCC00]/30 text-[#7a5f00]' },
}

export const NOTES_SQL = `CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'paste',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`

interface Props {
  notes: Note[]
  missing: boolean
  onImport: (rows: { title: string; body: string; source: string }[]) => Promise<void>
  onDelete: (n: Note) => Promise<void>
}

export default function NotesLibrary({ notes, missing, onImport, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [notebook, setNotebook] = useState('')
  const [uploadBook, setUploadBook] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [picked, setPicked] = useState<string[] | null>(null)
  const [ask, setAsk] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<{ q: string; answer: string; sources: string[] } | null>(null)

  const books = useMemo(() => {
    const m = new Map<string, number>()
    notes.forEach((n) => m.set(notebookOf(n), (m.get(notebookOf(n)) || 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }, [notes])
  const open = (picked ?? books.slice(0, 2).map((b) => b.name)).filter((n) => books.some((b) => b.name === n))
  const toggle = (name: string) => setPicked(open.includes(name) ? open.filter((x) => x !== name) : [...open, name])

  const files = async (fl: FileList | null) => {
    if (!fl?.length) return
    setBusy(true)
    try {
      const parsed = (await Promise.all(Array.from(fl).map(parseNoteFile))).flat()
      const book = uploadBook.trim()
      const rows = book ? parsed.map((r) => ({ ...r, source: `${r.source.split(':')[0]}:${book}` })) : parsed
      if (!rows.length) alert('No notes found in that file.')
      else await onImport(rows)
    } catch (e) { alert('Could not read that file: ' + (e as Error).message) }
    setBusy(false)
  }
  const empties = notes.filter(isEmptyNote)
  const needle = q.trim().toLowerCase()
  const inBook = (name: string) => notes.filter((n) => notebookOf(n) === name && (!needle || `${n.title} ${n.body}`.toLowerCase().includes(needle)))

  const askClaude = async () => {
    if (!ask.trim() || asking) return
    setAsking(true)
    try {
      const scope = open.length ? notes.filter((n) => open.includes(notebookOf(n))) : notes
      const pool = pickNotes(scope, ask, 14, 1200)
      const withBook = pool.map((p) => ({ ...p, notebook: notebookOf(scope.find((n) => n.title === p.title) || { source: '' }) }))
      const r = await fetch('/api/ask-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: ask, notes: withBook }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setAnswer({ q: ask, answer: d.answer, sources: d.sources || [] })
    } catch (e) { alert('Ask failed: ' + (e as Error).message) }
    setAsking(false)
  }

  if (missing) {
    return (
      <div className="sq-card p-5 space-y-3 sq-fade-in">
        <p className="font-semibold">One-time setup: a table for your notes</p>
        <p className="text-sm text-gray-600">In Supabase, open <strong>SQL Editor</strong>, paste this, and click <strong>Run</strong>. Then reload this page.</p>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{NOTES_SQL}</pre>
        <button onClick={() => { navigator.clipboard.writeText(NOTES_SQL); setCopied(true) }} className="sq-btn-primary text-sm px-3 py-1.5 rounded-lg font-semibold">{copied ? 'Copied ✓' : 'Copy the SQL'}</button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sq-fade-in">
      {notes.length > 0 && (
        <div className="sq-card p-4 space-y-2 border-amber-200 bg-amber-50/40">
          <div className="flex gap-2">
            <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askClaude()} placeholder="Ask Claude about your notes: &quot;what did I write about the algorithm?&quot;"
              className="flex-1 h-10 px-3 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <button onClick={askClaude} disabled={asking || !ask.trim()} className="sq-btn-primary h-10 px-4 rounded-lg text-sm font-semibold">{asking ? <span className="sq-pulse">Looking…</span> : '🔎 Ask'}</button>
          </div>
          <p className="text-xs text-gray-500">Searching {open.length ? <strong>{open.join(', ')}</strong> : 'all notes'}. Pick notebooks below to narrow or widen it.</p>
          {answer && (
            <div className="bg-white rounded-lg border border-amber-100 px-4 py-3 space-y-1.5">
              <p className="text-[11px] text-gray-400">“{answer.q}”</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer.answer}</p>
              {answer.sources.length > 0 && <p className="text-[11px] text-gray-500">From: {answer.sources.join(' · ')}</p>}
              <button onClick={() => setAnswer(null)} className="text-[11px] text-gray-400 hover:underline">Clear</button>
            </div>
          )}
        </div>
      )}

      <details className="sq-card p-4" open={notes.length === 0}>
        <summary className="text-sm font-semibold cursor-pointer">📥 Add notes <span className="font-normal text-gray-400">· Evernote .enex, text files, or paste</span></summary>
        <div className="space-y-3 mt-3">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <label className="sq-btn-primary px-3 py-1.5 rounded-lg font-semibold cursor-pointer">
              {busy ? 'Importing…' : '📥 Upload files'}
              <input type="file" multiple accept=".enex,.txt,.md,.markdown,.html,.htm" className="hidden" onChange={(e) => { files(e.target.files); e.target.value = '' }} />
            </label>
            <input value={uploadBook} onChange={(e) => setUploadBook(e.target.value)} list="sq-notebooks" placeholder="Notebook name for these files (optional)" className="h-9 w-64 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
            <span className="text-xs text-gray-500"><strong>Evernote:</strong> export a notebook as .enex, and the file name becomes the notebook name. <strong>Apple Notes:</strong> paste below.</span>
          </div>
          <div className="grid gap-2">
            <div className="flex gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
              <input value={notebook} onChange={(e) => setNotebook(e.target.value)} list="sq-notebooks" placeholder="Notebook (e.g. Apple Notes)" className="w-52 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
              <button type="button" onClick={() => setNotebook('Apple Notes')} className="text-xs px-2.5 rounded-lg bg-[#FFCC00]/30 text-[#7a5f00] font-medium shrink-0">Apple Notes</button>
              <button type="button" onClick={() => setNotebook('Evernote')} className="text-xs px-2.5 rounded-lg bg-[#00A82D]/15 text-[#007a20] font-medium shrink-0">Evernote</button>
              <datalist id="sq-notebooks">{books.map((b) => <option key={b.name} value={b.name} />)}</datalist>
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Paste a note, a rant, a voice memo transcript…" className="p-3 text-sm border border-gray-200 rounded-lg bg-white" />
            <div><button disabled={!body.trim() || busy} onClick={async () => { setBusy(true); await onImport([{ title: title.trim() || body.trim().split('\n')[0].slice(0, 60), body: body.trim(), source: `paste:${notebook.trim() || 'Pasted'}` }]); setTitle(''); setBody(''); setBusy(false) }} className="text-sm px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium">Save note</button></div>
          </div>
        </div>
      </details>

      {notes.length > 0 && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {books.map((b) => {
              const on = open.includes(b.name)
              const mine = notes.filter((n) => notebookOf(n) === b.name)
              const br: Brand = /apple/i.test(b.name) || mine.some((n) => n.source.startsWith('apple-notes')) ? 'apple' : /evernote/i.test(b.name) || mine.some((n) => n.source.startsWith('evernote')) ? 'evernote' : null
              return (
                <button key={b.name} onClick={() => toggle(b.name)} aria-pressed={on}
                  className={`text-left rounded-2xl p-4 border transition flex flex-col gap-2 min-h-[120px] ${br ? (on ? BRAND[br].on : BRAND[br].off) : on ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white/90 border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl leading-none">📓</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${on ? (br ? BRAND[br].chip : 'bg-white/25') : br ? BRAND[br].chipOff : 'bg-gray-100 text-gray-700'}`}>{b.count}</span>
                  </div>
                  <span className="font-semibold text-[15px] leading-tight break-words">{b.name}</span>
                  <span className={`text-[11px] leading-snug line-clamp-2 ${on ? (br ? BRAND[br].sub : 'text-white/80') : 'text-gray-500'}`}>{mine.slice(0, 2).map((n) => n.title).join(' · ')}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Click tiles to open them side by side.</span>
            {empties.length > 0 && <button onClick={async () => { if (confirm(`Delete ${empties.length} empty note${empties.length > 1 ? 's' : ''} (no title, no body)?`)) for (const n of empties) await onDelete(n) }} className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium">🧹 Remove {empties.length} empty</button>}
            <span className="flex-1" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search open notebooks…" className="w-full sm:w-60 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
          </div>
          {open.length === 0 ? <p className="text-sm text-gray-400">Pick a notebook above to open it. Open as many as you want side by side.</p> : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${open.length > 2 ? 300 : 360}px, 1fr))` }}>
              {open.map((name) => {
                const rows = inBook(name)
                return (
                  <section key={name} className="sq-card overflow-hidden flex flex-col max-h-[70vh]">
                    <header className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">📓 {name}</h3>
                      <span className="text-[11px] text-gray-400">{rows.length} notes</span>
                    </header>
                    <ul className="divide-y divide-gray-100 overflow-y-auto">
                      {rows.slice(0, 150).map((n) => (
                        <li key={n.id} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setExpanded(expanded === n.id ? null : n.id)} className="flex-1 min-w-0 text-left">
                              <span className="block text-sm font-medium truncate">{n.title}</span>
                              {expanded !== n.id && <span className="block text-xs text-gray-500 truncate">{n.body.replace(/\s+/g, ' ')}</span>}
                            </button>
                            <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(n.created_at)}</span>
                            <button onClick={() => confirm('Delete this note?') && onDelete(n)} className="text-gray-400 hover:text-red-600 px-1 shrink-0">×</button>
                          </div>
                          {expanded === n.id && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{n.body}</p>}
                        </li>
                      ))}
                      {rows.length === 0 && <li className="px-4 py-6 text-sm text-gray-400 text-center">No matches.</li>}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
