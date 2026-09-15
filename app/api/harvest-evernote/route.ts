export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400 })
    }

    // Mock Evernote notes for demo
    const mockNotes = [
      {
        id: '1',
        title: 'How to build scalable systems',
        content:
          'Building scalable systems requires thinking about databases, caching, load balancing, and monitoring. Start with a monolith but architect it to be modular. As you scale, separate concerns into microservices.',
        created: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'The future of AI',
        content:
          'AI is transforming every industry. Large language models can now write code, analyze data, and create content. The next frontier is autonomous agents that can plan and execute multi-step tasks.',
        created: new Date().toISOString(),
      },
      {
        id: '3',
        title: 'Remote work best practices',
        content:
          'Remote work is here to stay. To succeed: over-communicate, use async-first workflows, have clear schedules, invest in tools, and build community. The best companies will be those with distributed talent.',
        created: new Date().toISOString(),
      },
    ]

    return new Response(JSON.stringify({ notes: mockNotes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Evernote harvest error:', error)
    return new Response(JSON.stringify({ error: 'Harvest failed' }), { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, noteId } = await request.json()

    if (!userId || !noteId) {
      return new Response(JSON.stringify({ error: 'User ID and note ID required' }), { status: 400 })
    }

    // Mock - in production, fetch from Evernote API
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Note added to drafts',
        noteId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Draft creation error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create draft' }), { status: 500 })
  }
}
