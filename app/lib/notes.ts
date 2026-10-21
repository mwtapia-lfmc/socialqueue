export interface Note { id: string; title: string; body: string; source: string; created_at: string }

const STOP = new Set('the a an and or of to in on for with is are was were be it this that at as by from my your our i you we they he she not but so if then than too very just about into over out up down how what why who when'.split(' '))
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter((w) => !STOP.has(w))

const SOURCE_NAMES: Record<string, string> = { evernote: 'Evernote', paste: 'Pasted', file: 'Files', 'apple-notes': 'Apple Notes' }
// source is "kind" or "kind:Notebook name"
export const notebookOf = (n: { source: string }) => { const i = n.source.indexOf(':'); return i > 0 ? n.source.slice(i + 1) : SOURCE_NAMES[n.source] || n.source }

// Pick the notes most relevant to the given text; fall back to a spread of recent ones.
export function pickNotes(notes: Note[], context: string, n = 6, chars = 500) {
  if (!notes.length) return []
  const terms = new Set(words(context))
  const scored = notes.map((x) => {
    const ws = words(`${x.title} ${x.title} ${x.body.slice(0, 2000)}`)
    let s = 0; for (const w of ws) if (terms.has(w)) s++
    return { x, s: terms.size ? s / Math.sqrt(ws.length + 1) : 0 }
  }).sort((a, b) => b.s - a.s)
  const top = scored.filter((r) => r.s > 0).slice(0, n)
  const fill = scored.filter((r) => r.s <= 0).sort(() => Math.random() - 0.5).slice(0, Math.max(0, n - top.length))
  return [...top, ...fill].map(({ x }) => ({ title: x.title, text: x.body.replace(/\s+/g, ' ').slice(0, chars) }))
}

const textOf = (html: string) => {
  const d = new DOMParser().parseFromString(html.replace(/<(br|\/div|\/p|\/li|\/h\d)\s*\/?>/gi, '\n'), 'text/html')
  return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

// Evernote .enex → notes. Other files (txt, md, html) become one note each.
export async function parseNoteFile(file: File): Promise<{ title: string; body: string; source: string }[]> {
  const raw = await file.text()
  const name = file.name.replace(/\.[^.]+$/, '')
  if (/\.enex$/i.test(file.name) || /<en-export/i.test(raw.slice(0, 2000))) {
    const doc = new DOMParser().parseFromString(raw, 'text/xml')
    return Array.from(doc.getElementsByTagName('note')).map((n) => ({
      title: n.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled',
      body: textOf(n.getElementsByTagName('content')[0]?.textContent || '').slice(0, 20000),
      source: `evernote:${name}`,
    })).filter((n) => n.body || n.title !== 'Untitled')
  }
  const body = (/\.(html?|rtf)$/i.test(file.name) ? textOf(raw) : raw.trim()).slice(0, 20000)
  return body ? [{ title: name, body, source: /\.html?$/i.test(file.name) ? 'apple-notes' : 'file' }] : []
}
