import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const content = formData.get('content') as string
    const platforms = JSON.parse(formData.get('platforms') as string)
    const scheduleDate = formData.get('scheduleDate') as string
    const scheduleTime = formData.get('scheduleTime') as string

    // TODO: Save to Supabase
    // TODO: Store images in storage bucket

    return NextResponse.json(
      {
        success: true,
        message: 'Post scheduled successfully',
        data: {
          content,
          platforms,
          scheduleDate,
          scheduleTime,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
