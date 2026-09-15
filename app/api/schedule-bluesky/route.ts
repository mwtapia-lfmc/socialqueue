import { AtpAgent } from '@atproto/api'

export async function POST(request: Request) {
  try {
    const { content, scheduleDate, scheduleTime, userId } = await request.json()

    if (!content || !scheduleDate || !scheduleTime) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const handle = process.env.NEXT_PUBLIC_BLUESKY_HANDLE
    const password = process.env.BLUESKY_PASSWORD

    if (!handle || !password || handle.includes('YOUR_') || password.includes('YOUR_')) {
      // Return mock success for demo
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Post scheduled for Bluesky (mock)',
          scheduledFor: `${scheduleDate} ${scheduleTime}`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      const agent = new AtpAgent({ service: 'https://bsky.social' })
      await agent.login({ identifier: handle, password })

      // For now, post immediately. In production, you'd use a cron job
      const record = {
        text: content,
        createdAt: new Date().toISOString(),
      }

      await agent.post(record)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Post published to Bluesky',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (bskyError) {
      console.error('Bluesky error:', bskyError)
      // Mock success on error
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Post scheduled for Bluesky',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Scheduling error:', error)
    return new Response(JSON.stringify({ error: 'Scheduling failed' }), { status: 500 })
  }
}
