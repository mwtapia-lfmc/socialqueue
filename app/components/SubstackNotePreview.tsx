'use client'

interface Props { text: string; hook?: string | null; author?: { displayName?: string; handle?: string; avatar?: string }; series?: { name: string; emoji: string } | null; tags?: { key: string; emoji: string }[] }

export default function SubstackNotePreview({ text, author, series, tags = [] }: Props) {
  const name = author?.displayName || author?.handle || 'You'
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ff6719] text-white font-semibold">Substack Note</span>
        <span className="flex-1" />
        <span className="text-[11px] text-gray-400">{text.length} chars · saved only, paste into Substack</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-2">
          {author?.avatar ? <img src={author.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500" />}
          <div className="leading-tight"><p className="text-sm font-semibold">{name}</p><p className="text-[11px] text-gray-400">now</p></div>
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-900 min-h-6">{text || <span className="text-gray-300">Your note will appear here…</span>}</p>
        {(series || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3 text-[11px]">
            {series && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-800">{series.emoji} {series.name}</span>}
            {tags.map((t) => <span key={t.key} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.emoji} #{t.key}</span>)}
          </div>
        )}
        <div className="flex gap-7 mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400"><span>♡ Like</span><span>💬 Reply</span><span>↻ Restack</span><span>↗ Share</span></div>
      </div>
    </div>
  )
}
