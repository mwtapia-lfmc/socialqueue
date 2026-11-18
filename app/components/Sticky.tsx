'use client'

import { useEffect, useRef, useState } from 'react'

export interface StickyState { open: boolean; docked: boolean; x: number; y: number }
export const STICKY_DEFAULT: StickyState = { open: true, docked: true, x: 0, y: 0 }

interface Props {
  text: string
  onChange: (t: string) => void
  state: StickyState
  onState: (s: StickyState) => void
  mode: 'docked' | 'floating'   // which placement this instance renders
}

const SIDEBAR = 232 // the menu's width; the note can't be dropped over it

// One yellow pad for all your notes. Docked it sits in the column; dragged by its header it floats anywhere.
export default function Sticky({ text, onChange, state, onState, mode }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const [dragging, setDragging] = useState(false)

  // Listeners go on at the moment of the grab so no move is missed
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    e.preventDefault()
    const dx = e.clientX - r.left, dy = e.clientY - r.top
    const w = r.width, h = r.height
    const place = (cx: number, cy: number) => {
      const minX = window.innerWidth >= 768 ? SIDEBAR + 8 : 8
      const x = Math.min(window.innerWidth - w - 8, Math.max(minX, cx - dx))
      const y = Math.min(window.innerHeight - 48, Math.max(8, cy - dy))
      onState({ ...stateRef.current, docked: false, x, y })
    }
    const move = (ev: PointerEvent) => place(ev.clientX, ev.clientY)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); setDragging(false) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    setDragging(true)
    place(e.clientX, e.clientY)
  }

  if (!state.open) return null
  if (mode === 'docked' && !state.docked) return null
  if (mode === 'floating' && state.docked) return null
  const floating = mode === 'floating'

  return (
    <div ref={ref}
      className={`flex flex-col rounded-sm shadow-[0_10px_30px_-10px_rgba(120,90,0,0.45)] ${floating ? 'fixed z-[90] w-72' : 'w-full'} ${dragging ? 'cursor-grabbing select-none' : ''}`}
      style={{ background: 'linear-gradient(180deg, #fff79a 0%, #fff064 100%)', ...(floating ? { left: state.x, top: state.y } : {}) }}>
      <div onPointerDown={startDrag} title="Drag me anywhere" className="flex items-center gap-2 px-3 py-1.5 cursor-grab bg-[#f7e34a]/70 border-b border-[#e9d43b] text-[11px] font-semibold text-yellow-900 select-none">
        <span className="tracking-widest opacity-60">⋮⋮</span>
        <span className="flex-1">Stickies</span>
        {!state.docked && <button type="button" onClick={() => onState({ ...state, docked: true })} title="Put it back in the column" className="px-1.5 rounded hover:bg-yellow-300/70">⇤ dock</button>}
        <button type="button" onClick={() => onState({ ...state, open: false })} title="Hide (your notes stay)" className="px-1.5 rounded hover:bg-yellow-300/70">×</button>
      </div>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} placeholder="All your notes live here. Ideas, quotes, to-dos — they stick around across every draft."
        rows={floating ? 12 : 9}
        className="w-full flex-1 p-3 text-[13px] leading-relaxed bg-transparent border-0 focus:outline-none resize-y text-yellow-950 placeholder:text-yellow-800/50"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} />
    </div>
  )
}
