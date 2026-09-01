'use client'

import { useState } from 'react'

interface ComposePostProps {
  onPostCreated: () => void
}

export default function ComposePost({ onPostCreated }: ComposePostProps) {
  const [content, setContent] = useState('')
  const [platforms, setPlatforms] = useState({
    threads: true,
    twitter: false,
  })
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('content', content)
    formData.append('platforms', JSON.stringify(platforms))
    formData.append('scheduleDate', scheduleDate)
    formData.append('scheduleTime', scheduleTime)
    images.forEach((img) => formData.append('images', img))

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setContent('')
        setScheduleDate('')
        setScheduleTime('')
        setImages([])
        onPostCreated()
        alert('Post scheduled successfully!')
      }
    } catch (error) {
      console.error('Error creating post:', error)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h2 className="text-xl font-semibold mb-4">Compose New Post</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Post Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={6}
            required
          />
          <span className="text-xs text-gray-500 mt-1">{content.length} characters</span>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Upload Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setImages(Array.from(e.target.files || []))}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {images.length > 0 && <p className="text-sm text-gray-600 mt-2">{images.length} image(s) selected</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Post to:</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={platforms.threads}
                onChange={(e) => setPlatforms({ ...platforms, threads: e.target.checked })}
              />
              <span>Threads</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={platforms.twitter}
                onChange={(e) => setPlatforms({ ...platforms, twitter: e.target.checked })}
              />
              <span>Twitter/X</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Schedule Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Schedule Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSubmitting ? 'Scheduling...' : 'Schedule Post'}
        </button>
      </form>
    </div>
  )
}
