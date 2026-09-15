export type Platform = 'threads' | 'twitter' | 'bluesky'

export const PLATFORM_LIMITS: Record<Platform, number> = {
  threads: 500,
  twitter: 280,
  bluesky: 300,
}

export const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string }> = {
  threads: { label: 'Threads', icon: '🧵', color: 'bg-gray-900 text-white' },
  twitter: { label: 'X', icon: '𝕏', color: 'bg-black text-white' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: 'bg-sky-500 text-white' },
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Lightweight markdown → HTML for the blog preview (no external deps)
export function markdownToHtml(md: string): string {
  const lines = escapeHtml(md).split('\n')
  const out: string[] = []
  let inList = false

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])_(.+?)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^- /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.slice(2))}</li>`)
      continue
    }
    if (inList) { out.push('</ul>'); inList = false }
    if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`)
    else if (/^> /.test(line)) out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`)
    else if (line === '') out.push('')
    else out.push(`<p>${inline(line)}</p>`)
  }
  if (inList) out.push('</ul>')
  return out.join('\n')
}

const BOLD_A = 0x1d400, BOLD_a = 0x1d41a, BOLD_0 = 0x1d7ce
const ITAL_A = 0x1d434, ITAL_a = 0x1d44e

function styleChars(s: string, upper: number, lower: number, digit?: number): string {
  let r = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c >= 65 && c <= 90) r += String.fromCodePoint(upper + (c - 65))
    else if (c >= 97 && c <= 122) {
      if (lower === ITAL_a && ch === 'h') r += 'ℎ'
      else r += String.fromCodePoint(lower + (c - 97))
    } else if (digit && c >= 48 && c <= 57) r += String.fromCodePoint(digit + (c - 48))
    else r += ch
  }
  return r
}

// Social platforms have no formatting; render bold/italic as Unicode styled letters
export function markdownToSocial(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, (_, t) => styleChars(t, BOLD_A, BOLD_a, BOLD_0))
    .replace(/(^|[^*\w])_(.+?)_(?!\w)/g, (_, pre, t) => pre + styleChars(t, ITAL_A, ITAL_a))
    .replace(/^## (.+)$/gm, (_, t) => styleChars(t, BOLD_A, BOLD_a, BOLD_0))
    .replace(/^> (.+)$/gm, '“$1”')
    .replace(/^- /gm, '• ')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '$1 $2')
}

export const countChars = (s: string) => Array.from(s).length

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// 'YYYY-MM-DD' → local Date (new Date('YYYY-MM-DD') would parse as UTC and shift a day)
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatTime(t?: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`
}
