'use client'

import { useState } from 'react'
import { parseNoteFile, type Note } from '../lib/notes'
import { timeAgo } from '../lib/text'

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
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const files = async (fl: FileList | null) => {
    if (!fl?.length) return
    setBusy(true)
    try {
      const rows = (await Promise.all(Array.from(fl).map(parseNoteFile))).flat()
      if (!rows.length) alert('No notes found in that file.')
      else await onImport(rows)
    } catch (e) { alert('Could not read that file: ' + (e as Error).message) }
    setBusy(false)
  }
  const needle = q.trim().toLowerCase()
  const shown = notes.filter((n) => !needle || `${n.title} ${n.body}`.toLowerCase().includes(needle))

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
      <div className="sq-card p-4 space-y-3">
        <p className="text-sm text-gray-600">Your raw material. Prompts, article ideas and the grader draw on these so they sound like you, not a stranger.</p>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <label className="sq-btn-primary px-3 py-1.5 rounded-lg font-semibold cursor-pointer">
            {busy ? 'Importing…' : '📥 Upload notes'}
            <input type="file" multiple accept=".enex,.txt,.md,.markdown,.html,.htm" className="hidden" onChange={(e) => { files(e.target.files); e.target.value = '' }} />
          </label>
          <span className="text-xs text-gray-500"><strong>Evernote:</strong> export a notebook as .enex. <strong>Apple Notes:</strong> paste below, or save a note as text or HTML.</span>
        </div>
        <div className="grid gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Paste a note, a rant, a voice memo transcript…" className="p-3 text-sm border border-gray-200 rounded-lg bg-white" />
          <div><button disabled={!body.trim() || busy} onClick={async () => { setBusy(true); await onImport([{ title: title.trim() || body.trim().split('\n')[0].slice(0, 60), body: body.trim(), source: 'paste' }]); setTitle(''); setBody(''); setBusy(false) }} className="text-sm px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium">Save note</button></div>
        </div>
      </div>

      {notes.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="w-full sm:w-72 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" />
            <span className="text-xs text-gray-400">{notes.length} notes</span>
          </div>
          <ul className="sq-card divide-y divide-gray-100 overflow-hidden">
            {shown.slice(0, 200).map((n) => (
              <li key={n.id} className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setOpen(open === n.id ? null : n.id)} className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-medium truncate">{n.title}</span>
                    {open !== n.id && <span className="block text-xs text-gray-500 truncate">{n.body.replace(/\s+/g, ' ')}</span>}
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{n.source}</span>
                  <span className="hidden md:inline text-[11px] text-gray-400 shrink-0">{timeAgo(n.created_at)}</span>
                  <button onClick={() => confirm('Delete this note?') && onDelete(n)} className="text-gray-400 hover:text-red-600 px-1 shrink-0">×</button>
                </div>
                {open === n.id && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap max-h-72 overflow-y-auto">{n.body}</p>}
              </li>
            ))}
          </ul>
          {shown.length > 200 && <p className="text-xs text-gray-400">Showing the first 200. Search to narrow.</p>}
        </>
      )}
    </div>
  )
}
