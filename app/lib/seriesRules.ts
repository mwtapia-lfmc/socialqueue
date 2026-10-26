// Per-series writing rules, stored in the user's auth metadata (series_rules)
export interface SeriesRule { titleFormat?: string; headline?: string; hook?: string; image?: string }
export type SeriesRules = Record<string, SeriesRule>

export const HEADLINE_BEST = `- Specific beats clever: name the thing (film, company, person, idea).
- 6 to 12 words, under about 60 characters so it isn't cut off in inboxes and feeds.
- Put the key word or name near the front.
- Carry tension: a claim, a question, a contradiction or a stake, not a topic label.
- Promise only what the piece delivers. No clickbait, no "You won't believe".
- Plain words in the writer's own voice. No colon-subtitle unless it earns it.`

export const HOOK_BEST = `- Stands alone: makes sense with zero context.
- Concrete and specific over abstract ("3-hour movie" beats "too long").
- Has an edge: an opinion, a surprise, a contradiction or a confession.
- Short: under about 150 characters reads best as a Note or a quote card.
- No throat-clearing ("In this piece…", "I think that…").`

export const IMAGE_BEST = `Editorial illustration that captures the piece's central idea or tension, not a literal scene list. Bold composition, one clear focal point, no words or letters in the image, no real logos, no likenesses of real people.`

// "REVIEW: ____" or "REVIEW: {title}" → "REVIEW: "
export const titlePrefix = (fmt?: string) => (fmt ? fmt.split(/_{2,}|\{title\}/)[0] : '')
