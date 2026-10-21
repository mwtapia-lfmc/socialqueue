'use client'

import { useState } from 'react'
import { markdownToSocial } from '../lib/text'

interface Props { title: string; content: string; image?: string; author?: { displayName?: string; handle?: string; avatar?: string } }

export default function LinkedInArticlePreview({ title, content, image, author }: Props) {
  const [copied, setCopied] = useState(false)
  const body = markdownToSocial(content)
  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  const mins = Math.max(1, Math.round(words / 230))
  const name = author?.displayName || author?.handle || 'You'
  const copy = async () => { await navigator.clipboard.writeText(`${title ? title + '\n\n' : ''}${body}`); setCopied(true); setTimeout(() => setCopied(false), 1800) }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0a66c2] text-white font-semibold">in LinkedIn Article</span>
        <span className="text-[11px] text-gray-400">{words} words · {mins} min read</span>
        <span className="flex-1" />
        <button type="button" onClick={copy} disabled={!content.trim()} className="text-[11px] px-2.5 py-1 rounded-md bg-[#0a66c2] text-white font-semibold hover:brightness-110 disabled:opacity-40">{copied ? '✓ Copied' : 'Copy for LinkedIn'}</button>
      </div>
      {image && <img src={image} alt="" className="w-full max-h-56 object-cover" />}
      <div className="p-5">
        <h1 className="text-[26px] leading-tight font-semibold text-gray-900 mb-3">{title || <span className="text-gray-300">Your title</span>}</h1>
        <div className="flex items-center gap-2.5 mb-4">
          {author?.avatar ? <img src={author.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-700" />}
          <div className="leading-tight text-[13px]"><p className="font-semibold text-gray-900">{name}</p><p className="text-gray-500">Published now · {mins} min read</p></div>
        </div>
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-800 max-h-80 overflow-y-auto sq-scroll">{body || <span className="text-gray-300">Your article will appear here…</span>}</div>
      </div>
      <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100 bg-gray-50/60">LinkedIn doesn't let apps publish Articles. Copy this, then paste into <strong>Write article</strong> on LinkedIn. Bold and italic become styled characters; headings and lists are plain text.</p>
    </div>
  )
}
