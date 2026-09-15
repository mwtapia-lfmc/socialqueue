'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface BlogComposeProps {
  onBlogCreated: () => void
}

export default function BlogCompose({ onBlogCreated }: BlogComposeProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)

  const handleAnalyze = async () => {
    if (!title || !content) {
      alert('Please enter a title and content first')
      return
    }

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })

      if (!response.ok) throw new Error('Analysis failed')
      const data = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Failed to analyze blog post')
    }
    setIsAnalyzing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('blog_posts').insert([
        {
          title,
          content,
          engagement_score: analysis?.engagement_score,
          trending_topics: analysis?.trending_topics,
          headline_variations: analysis?.headline_variations,
          best_publish_time: analysis?.best_publish_time,
          schedule_date: scheduleDate,
          schedule_time: scheduleTime,
        },
      ])

      if (error) throw error

      setTitle('')
      setContent('')
      setScheduleDate('')
      setScheduleTime('')
      setAnalysis(null)
      onBlogCreated()
      alert('Blog post scheduled successfully!')
    } catch (error) {
      console.error('Error creating blog post:', error)
      alert('Failed to schedule blog post')
    }

    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">Compose Blog Post</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Blog Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter blog post title..."
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Blog Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your blog post here..."
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={10}
              required
            />
            <span className="text-xs text-gray-500 mt-1">{content.length} characters</span>
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

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400"
            >
              {isAnalyzing ? 'Analyzing...' : '✨ Analyze with AI'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Blog'}
            </button>
          </div>
        </form>
      </div>

      {analysis && (
        <div className="bg-white rounded-lg p-6 shadow space-y-4">
          <h3 className="text-lg font-semibold">AI Analysis Results</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Engagement Score</p>
              <p className="text-3xl font-bold text-purple-600">{analysis.engagement_score}/10</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Best Publish Time</p>
              <p className="text-lg font-semibold text-blue-600">{analysis.best_publish_time || 'Not available'}</p>
            </div>
          </div>

          {analysis.trending_topics && analysis.trending_topics.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Trending Topics Identified</p>
              <div className="flex flex-wrap gap-2">
                {analysis.trending_topics.map((topic: string, i: number) => (
                  <span key={i} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.headline_variations && analysis.headline_variations.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Suggested Headlines</p>
              <ul className="space-y-2">
                {analysis.headline_variations.map((headline: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-blue-600">→</span> {headline}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
