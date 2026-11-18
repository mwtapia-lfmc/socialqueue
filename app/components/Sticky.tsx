'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface StickyState { open: boolean; docked: boolean; x: number; y: number; tab: 'all' | 'draft' }
export const STICKY_DEFAULT: StickyState = { open: true, docked: true, x: 0, y: 0, tab: 'all' }

interface Props {
  text: string                      // the all-notes pad
  onChange: (t: string) => void
  draftText?: string                // this draft's own page
  onDraftChange?: (t: string) => void
  draftLabel?: string
  state: StickyState
  onState: (s: StickyState) => void
  anchor: HTMLElement | null        // the slot in the column the note pins to when docked
}

const SIDEBAR = 232 // the menu's width; the note can't be dropped over it
const FLOAT_W = 288

// One yellow pad, rendered once as a fixed element. Docked, it tracks its slot in the column;
// dragged by its header it floats anywhere. Never remounts, so a drag is never interrupted.
export default function Sticky({ text, onChange, draftText = '', onDraftChange, draftLabel = 'This draft', state, onState, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const [dragging, setDragging] = useState(false)
  const [slot, setSlot] = useState<{ left: number; top: number; width: number } | null>(null)
  const tab = onDraftChange ? state.tab || 'all' : 'all'

  // Follow the slot while docked (scroll, resize, layout changes)
  useLayoutEffect(() => {
    if (!state.docked || !anchor) { setSlot(null); return }
    let raf = 0
    const measure = () => { const r = anchor.getBoundingClientRect(); setSlot({ left: r.left, top: r.top, width: r.width }) }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll)
    const ro = new ResizeObserver(onScroll); ro.observe(anchor); ro.observe(document.body)
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); ro.disconnect(); cancelAnimationFrame(raf) }
  }, [state.docked, anchor])

  // Listeners go on at the moment of the grab so no move is missed
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    e.preventDefault()
    // Keep the grab point under the pointer even though the note narrows when it floats
    const dx = Math.min(e.clientX - r.left, FLOAT_W - 40), dy = e.clientY - r.top
    const w = FLOAT_W
    const place = (cx: number, cy: number) => {
      const minX = window.innerWidth >= 768 ? SIDEBAR + 8 : 8
      const x = Math.min(window.innerWidth - w - 8, Math.max(minX, cx - dx))
      const y = Math.min(window.innerHeight - 48, Math.max(8, cy - dy))
      onState({ ...stateRef.current, docked: false, x, y })
    }
    const move = (ev: PointerEvent) => place(ev.clientX, ev.clientY)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setDragging(false) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    setDragging(true)
    place(e.clientX, e.clientY)
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!state.open || !mounted) return null
  const docked = state.docked && !!slot
  if (state.docked && !slot) return null // no slot on this screen (e.g. the column isn't rendered)
  const pos = docked ? { left: slot!.left, top: slot!.top, width: slot!.width } : { left: state.x, top: state.y, width: FLOAT_W }

  // Portaled to <body> so no ancestor transform or filter can throw off the fixed position
  return createPortal(
    <div ref={ref}
      className={`fixed z-[90] flex flex-col rounded-sm shadow-[0_10px_30px_-10px_rgba(120,90,0,0.45)] ${dragging ? 'cursor-grabbing select-none' : ''}`}
      style={{ background: 'linear-gradient(180deg, #fff79a 0%, #fff064 100%)', ...pos }}>
      <div onPointerDown={startDrag} title="Drag me anywhere" className="flex items-center gap-2 px-3 py-1.5 cursor-grab bg-[#f7e34a]/70 border-b border-[#e9d43b] text-[11px] font-semibold text-yellow-900 select-none">
        <span className="tracking-widest opacity-60">⋮⋮</span>
        <span className="flex-1 flex items-center gap-1 min-w-0">
          <span className="mr-1">Stickies</span>
          {onDraftChange && (['all', 'draft'] as const).map((k) => (
            <button key={k} type="button" onClick={() => onState({ ...state, tab: k })} className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap ${tab === k ? 'bg-yellow-900 text-yellow-50' : 'hover:bg-yellow-300/70'}`}>
              {k === 'all' ? 'All notes' : draftLabel}{(k === 'draft' ? draftText : text).trim() && tab !== k ? ' •' : ''}
            </button>
          ))}
        </span>
        {!state.docked && <button type="button" onClick={() => onState({ ...state, docked: true })} title="Put it back in the column" className="px-1.5 rounded hover:bg-yellow-300/70 whitespace-nowrap">⇤ dock</button>}
        <button type="button" onClick={() => onState({ ...state, open: false })} title="Hide (your notes stay)" className="px-1.5 rounded hover:bg-yellow-300/70">×</button>
      </div>
      <textarea value={tab === 'draft' ? draftText : text} onChange={(e) => (tab === 'draft' ? onDraftChange! : onChange)(e.target.value)}
        placeholder={tab === 'draft' ? 'Notes just for this piece: angles, quotes to find, what to cut…' : 'All your notes live here. Ideas, quotes, to-dos. They stick around across every draft.'}
        rows={docked ? 9 : 12}
        className="w-full flex-1 p-3 text-[13px] leading-relaxed bg-transparent border-0 focus:outline-none resize-y text-yellow-950 placeholder:text-yellow-800/50"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} />
    </div>,
    document.body
  )
}
