// All text blocks of a Claude reply, joined (skips thinking / tool blocks)
export const textOf = (msg: any): string => ((msg?.content || []) as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
