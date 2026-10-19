'use client'

import { useState } from 'react'
import { markdownToHtml } from '../lib/text'

interface Props { title: string; content: string; image?: string; author?: { displayName?: string; handle?: string; avatar?: string } }

export default function SubstackPreview({ title, content, image, author }: Props) {
  const [copied, setCopied] = useState<null | 'post' | 'title'>(null)
  const html = markdownToHtml(content)
  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  const mins = Math.max(1, Math.round(words / 230))
  const name = author?.displayName || author?.handle || 'You'
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const flash = (k: 'post' | 'title') => { setCopied(k); setTimeout(() => setCopied(null), 1800) }
  const copyTitle = async () => { await navigator.clipboard.writeText(title); flash('title') }
  const copyPost = async () => {
    const rich = `<h1>${title.replace(/</g, '&lt;')}</h1>${html}`
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([rich], { type: 'text/html' }), 'text/plain': new Blob([`${title}\n\n${content}`], { type: 'text/plain' }) })])
    } catch { await navigator.clipboard.writeText(`${title}\n\n${content}`) }
    flash('post')
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ff6719] text-white font-semibold">Substack</span>
        <span className="text-[11px] text-gray-400">{words} words · {mins} min read</span>
        <span className="flex-1" />
        <button type="button" onClick={copyTitle} disabled={!title} className="text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40">{copied === 'title' ? '✓ Copied' : 'Copy title'}</button>
        <button type="button" onClick={copyPost} disabled={!content.trim()} className="text-[11px] px-2.5 py-1 rounded-md bg-[#ff6719] text-white font-semibold hover:brightness-95 disabled:opacity-40">{copied === 'post' ? '✓ Copied' : 'Copy for Substack'}</button>
      </div>
      <div className="px-5 py-6 md:px-7">
        <h1 className="font-serif text-[28px] leading-tight font-bold text-gray-900 mb-3" style={{ fontFamily: 'Georgia, serif' }}>{title || <span className="text-gray-300">Your title</span>}</h1>
        <div className="flex items-center gap-2.5 mb-5">
          {author?.avatar ? <img src={author.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500" />}
          <div className="leading-tight text-[13px]"><p className="font-semibold text-gray-900">{name}</p><p className="text-gray-500">{date}</p></div>
        </div>
        {image && <img src={image} alt="" className="w-full rounded-lg mb-6 object-cover max-h-96" />}
        <div className="sq-substack" dangerouslySetInnerHTML={{ __html: html || '<p style="color:#c4c4c4">Your post will render here…</p>' }} />
      </div>
      <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100 bg-gray-50/60">Substack has no publishing API. Click <strong>Copy for Substack</strong>, then paste into a new post at substack.com/publish — headings, bold, lists and links carry over.</p>
    </div>
  )
}
