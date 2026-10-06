'use client'

import { useState } from 'react'

interface Props { onGo: (view: any) => void }

const SECTIONS: { id: string; icon: string; title: string; body: (go: (v: any) => void) => React.ReactNode }[] = [
  { id: 'start', icon: '🚀', title: 'Getting started in 2 minutes', body: (go) => (
    <ol className="list-decimal pl-5 space-y-1.5">
      <li><button onClick={() => go('accounts')} className="text-indigo-600 hover:underline">Connect an account</button> — Bluesky takes an app password; Threads and X are one-click logins.</li>
      <li>Open <button onClick={() => go('compose')} className="text-indigo-600 hover:underline">Compose</button>, write something, make sure the platform pills show a <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" /> green light, and hit <strong>🚀 Post now</strong>.</li>
      <li>Check <button onClick={() => go('queue')} className="text-indigo-600 hover:underline">Queue</button> — the green card has "View on …" links to the live posts.</li>
      <li>Install it on your phone: Safari → Share → <strong>Add to Home Screen</strong>.</li>
    </ol>
  ) },
  { id: 'compose', icon: '✍️', title: 'Compose', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Post vs Blog</strong> toggle at the top. Blogs are long-form drafts (Substack has no API, so you copy them over); posts go to social.</li>
      <li><strong>Toolbar:</strong> B / I / H / • / ❝ / 🔗 / 😊. Bold and italic become real styled text on social (𝗯𝗼𝗹𝗱, 𝘪𝘵𝘢𝘭𝘪𝘤); headings and lists render in blog previews.</li>
      <li><strong>Tone dropdown</strong> — change it with text present and you'll be offered an AI rewrite in that voice. Undo is one click.</li>
      <li><strong>Autosave:</strong> everything you type is saved as a draft within a second (status dot top-right). <strong>+ New</strong> starts fresh.</li>
      <li><strong>Platform pills</strong> under the text: green dot = will publish there. Each platform's character limit is shown live (Threads 500 · X 280 · Bluesky 300 · LinkedIn 3000).</li>
      <li><strong>Live previews</strong> (right side, or below on phone): one card per platform showing your real avatar and handle. <strong>Click a card's text</strong> to write a custom version for just that platform — it gets a "Customized" badge; Reset returns it to the shared text.</li>
      <li><strong>✨ Analyze</strong> scores engagement, suggests hashtags and headlines, and recommends a time. Click a hashtag to insert it; click a headline to use it.</li>
      <li><strong>🐘 Evernote</strong> opens an import panel (sample notes until Evernote credentials exist).</li>
    </ul>
  ) },
  { id: 'images', icon: '🎨', title: 'Images', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Upload</strong>: click, drag-and-drop onto the Images card, or paste (⌘V). Up to 4 per post. Attaches immediately at <strong>original</strong> size — nothing is cropped unless you ask.</li>
      <li><strong>Format</strong> buttons: pick Landscape 16:9 (X, Bluesky, LinkedIn), Portrait 4:5 (Threads feed), or Square before uploading to center-crop to that shape.</li>
      <li><strong>Generate</strong>: describe an image; it's created at the chosen format. <strong>Amend with AI</strong>: type a change ("make the sky orange") and apply it to the staged image. Both need <code>OPENAI_API_KEY</code> on Vercel — otherwise you get a sample gradient.</li>
      <li>Threads requires images to be publicly reachable; they're stored in your Supabase <code>media</code> bucket, which is.</li>
    </ul>
  ) },
  { id: 'batch', icon: '⚡', title: 'Batch: dump → review → spread', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Dump:</strong> one idea per paragraph, or stream it and press <strong>✨ Split with AI</strong> — Claude cuts it into platform-length posts keeping your wording.</li>
      <li><strong>Review:</strong> edit any card, toggle platforms per post, delete, add.</li>
      <li><strong>Spread:</strong> pick a <strong>Rhythm</strong> (Balanced · Threads daily · Bluesky · X growth · LinkedIn 3×/week) or set start date, days, weekdays and time slots yourself. Posts are spaced evenly; nudge any single one. Amber warnings flag cadence problems (e.g. two LinkedIn posts in a day). <strong>Schedule all</strong> or save all as drafts.</li>
    </ul>
  ) },
  { id: 'schedule', icon: '📅', title: 'Scheduling, Queue and auto-publish', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Schedule →</strong> in Compose asks for a date and time and moves the item to the Calendar and Queue. Drafts can also be scheduled from the Drafts tab.</li>
      <li><strong>Queue</strong> has three groups: Needs attention (failed, with the reason and a Retry), Scheduled, Published (with links). <strong>Back to drafts</strong> unschedules.</li>
      <li><strong>Auto-publish</strong> runs every minute on the server. If the Queue shows an amber "Auto-publish is OFF" banner, Vercel is missing <code>CRON_SECRET</code> and/or <code>SUPABASE_SERVICE_ROLE_KEY</code> — add them and redeploy.</li>
      <li>Scheduled cross-posts are <strong>staggered about a minute apart</strong> per platform on purpose. <strong>Post now</strong> fires everything immediately.</li>
    </ul>
  ) },
  { id: 'calendar', icon: '🗓', title: 'Calendar', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Month / Week / Agenda.</strong> Week is a 6am–11pm grid with a pink "now" line.</li>
      <li><strong>Drag</strong> a post to another day (Month) or hour (Week) to reschedule. Published posts are locked; dragging a failed one re-arms it.</li>
      <li><strong>Click empty space</strong> — a day, or an hour slot — to open Compose pre-scheduled for that moment.</li>
      <li>Filter by platform and status; busy days show "+N more" (click to expand).</li>
    </ul>
  ) },
  { id: 'profiles', icon: '👤', title: 'Profiles', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li>Every connected account: avatar, bio, follower counts, and your published posts pulled live. <strong>Repurpose</strong> drops an old post into Compose.</li>
      <li><strong>Columns</strong> view = one scrolling feed per account. <strong>Timeline</strong> view = all accounts on one shared day axis so same-day posts line up.</li>
      <li>LinkedIn doesn't let apps read your post history, so that column shows the profile only. Data refreshes every 10 minutes; ↻ forces it.</li>
    </ul>
  ) },
  { id: 'trends', icon: '📈', title: 'Trends', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li>Rows for <strong>Bluesky</strong> (live trending topics with post counts and who's driving them), <strong>Google Trends</strong> (US search spikes, opens a Google search), <strong>Hacker News</strong>, and <strong>X</strong> (once your X account has API credits). Drag the ⋮⋮ handle to reorder rows.</li>
      <li><strong>Write about this</strong> seeds Compose. <strong>✨ AI angles</strong> drafts three takes in your voice using your recent posts as samples.</li>
      <li>Meta (Threads/Instagram/Facebook) and LinkedIn publish no trending data to anyone — Bluesky + Google are the closest proxy.</li>
    </ul>
  ) },
  { id: 'platforms', icon: '🔗', title: 'Platform notes', body: () => (
    <ul className="list-disc pl-5 space-y-1.5">
      <li><strong>Threads</strong> — works in Meta "development mode" for accounts listed as Threads Testers on your Meta app. Connect via login, or paste a token from the Meta console (60-day, auto-renews).</li>
      <li><strong>Bluesky</strong> — app password from Settings → Privacy &amp; Security → App Passwords. Free, no approval.</li>
      <li><strong>X</strong> — connects free, but X charges per API call (~1.5¢ per post, 20¢ if the post has a link; $20 free credit when you save a card in the X developer console). Avoid links in X posts.</li>
      <li><strong>LinkedIn</strong> — code is ready; registering the app requires a LinkedIn company Page to "own" it (posts still go to your personal profile).</li>
      <li><strong>Instagram / Facebook</strong> — possible through the same Meta app (IG needs a Business/Creator account and an image on every post). Parked for now.</li>
    </ul>
  ) },
  { id: 'faq', icon: '❓', title: 'FAQ', body: () => (
    <dl className="space-y-3">
      <div><dt className="font-semibold">A post published on one platform but not another?</dt><dd className="text-gray-700">Check the pill had a green light. If both were on and it was scheduled, the second lands ~1 minute later by design. If it failed, the Queue's "Needs attention" card shows the platform's exact error.</dd></div>
      <div><dt className="font-semibold">Why do I see a version number?</dt><dd className="text-gray-700">It's in the sidebar (v{process.env.NEXT_PUBLIC_APP_VERSION} now). If a change doesn't seem to show up, hard-reload (⌘⇧R) and check the number went up.</dd></div>
      <div><dt className="font-semibold">Is anything stored on my device?</dt><dd className="text-gray-700">A cache of your posts, accounts, profiles and trends so the app opens instantly; it refreshes in the background. The source of truth is your Supabase database.</dd></div>
      <div><dt className="font-semibold">Can it post to Substack?</dt><dd className="text-gray-700">No one can — Substack has no publishing API. Write blogs here, copy them over.</dd></div>
    </dl>
  ) },
]

export default function Help({ onGo }: Props) {
  const [active, setActive] = useState(SECTIONS[0].id)
  return (
    <div className="grid lg:grid-cols-4 gap-6 sq-fade-in">
      <nav className="lg:sticky lg:top-24 self-start">
        <div className="sq-card p-3 space-y-0.5">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#help-${s.id}`} onClick={() => setActive(s.id)} className={`block rounded-lg px-3 py-2 text-sm ${active === s.id ? 'bg-indigo-50 text-indigo-800 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{s.icon} {s.title}</a>
          ))}
        </div>
      </nav>
      <div className="lg:col-span-3 space-y-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">How SocialQueue works</h2>
          <p className="text-gray-500 text-sm mt-1">Write once, post everywhere. This page describes the app as it actually behaves right now.</p>
        </div>
        {SECTIONS.map((s) => (
          <section key={s.id} id={`help-${s.id}`} className="sq-card p-5 md:p-6 scroll-mt-24">
            <h3 className="font-bold text-lg mb-3">{s.icon} {s.title}</h3>
            <div className="text-[15px] leading-relaxed text-gray-800">{s.body(onGo)}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
