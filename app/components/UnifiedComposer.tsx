'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface UnifiedComposerProps {
  userId: string
  onPostCreated: () => void
}

type ContentType = 'post' | 'blog'
type Tone = 'professional' | 'casual' | 'funny' | 'inspirational'

export default function UnifiedComposer({ userId, onPostCreated }: UnifiedComposerProps) {
  const [contentType, setContentType] = useState<ContentType>('post')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tone, setTone] = useState<Tone>('casual')
  const [platforms, setPlatforms] = useState({
    threads: true,
    twitter: false,
    bluesky: false,
  })
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [dallePrompt, setDallePrompt] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [hashtags, setHashtags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<any>(null)

  const handleGenerateImage = async () => {
    if (!dallePrompt) {
      alert('Enter a description for the image')
      return
    }

    setIsGeneratingImage(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: dallePrompt }),
      })

      if (!response.ok) throw new Error('Image generation failed')
      const data = await response.json()
      setGeneratedImages([...generatedImages, data.imageUrl])
      setDallePrompt('')
    } catch (error) {
      console.error('Image generation error:', error)
      alert('Failed to generate image')
    }
    setIsGeneratingImage(false)
  }

  const handleAnalyze = async () => {
    if (!content) {
      alert('Write some content first')
      return
    }

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, contentType }),
      })

      if (!response.ok) throw new Error('Analysis failed')
      const data = await response.json()
      setAnalysis(data)
      setHashtags(data.suggestedHashtags || [])
      setSuggestions(data.suggestions)
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Failed to analyze content')
    }
    setIsAnalyzing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content || (contentType === 'blog' && !title)) {
      alert('Please fill in required fields')
      return
    }

    if (!scheduleDate || !scheduleTime) {
      alert('Please set a schedule date and time')
      return
    }

    setIsSubmitting(true)

    try {
      const table = contentType === 'blog' ? 'blog_posts' : 'posts'
      const payload = contentType === 'blog' ? {
        user_id: userId,
        title,
        content,
        platforms,
        schedule_date: scheduleDate,
        schedule_time: scheduleTime,
        tone,
        engagement_score: analysis?.engagement_score,
        trending_topics: analysis?.trending_topics,
        headline_variations: analysis?.headline_variations,
        best_publish_time: analysis?.best_publish_time,
        hashtags,
        status: 'scheduled',
      } : {
        user_id: userId,
        content,
        platforms,
        schedule_date: scheduleDate,
        schedule_time: scheduleTime,
        tone,
        image_count: images.length + generatedImages.length,
        engagement_score: analysis?.engagement_score,
        hashtags,
        status: 'scheduled',
      }

      const { error } = await supabase.from(table).insert([payload])

      if (error) throw error

      setContent('')
      setTitle('')
      setScheduleDate('')
      setScheduleTime('')
      setImages([])
      setGeneratedImages([])
      setAnalysis(null)
      setHashtags([])
      setSuggestions(null)
      onPostCreated()
      alert(`${contentType === 'blog' ? 'Blog' : 'Post'} scheduled successfully!`)
    } catch (error) {
      console.error('Error creating content:', error)
      alert('Failed to schedule content')
    }

    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setContentType('post')}
            className={`px-4 py-2 rounded-lg font-medium ${
              contentType === 'post' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Post
          </button>
          <button
            onClick={() => setContentType('blog')}
            className={`px-4 py-2 rounded-lg font-medium ${
              contentType === 'blog' ? 'bg-purple-600 text-white' : 'bg-gray-100'
            }`}
          >
            Blog
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {contentType === 'blog' && (
            <div>
              <label className="block text-sm font-medium mb-2">Blog Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter blog title..."
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {contentType === 'blog' ? 'Blog Content' : 'Post Content'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content..."
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={contentType === 'blog' ? 10 : 6}
              required
            />
            <span className="text-xs text-gray-500 mt-1">{content.length} characters</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
              <option value="funny">Funny</option>
              <option value="inspirational">Inspirational</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Post to:</label>
            <div className="flex gap-4 flex-wrap">
              {['threads', 'twitter', 'bluesky'].map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={platforms[platform as keyof typeof platforms]}
                    onChange={(e) =>
                      setPlatforms({ ...platforms, [platform]: e.target.checked })
                    }
                  />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image Upload</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setImages(Array.from(e.target.files || []))}
              className="block w-full text-sm"
            />
            {images.length > 0 && <p className="text-sm text-gray-600 mt-2">{images.length} image(s) selected</p>}
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">Generate Image with DALL-E</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dallePrompt}
                onChange={(e) => setDallePrompt(e.target.value)}
                placeholder="Describe the image you want..."
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {isGeneratingImage ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {generatedImages.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {generatedImages.map((img, i) => (
                  <img key={i} src={img} alt="Generated" className="h-20 w-20 object-cover rounded" />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Schedule Date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Schedule Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full p-2 border rounded-lg"
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
              {isAnalyzing ? 'Analyzing...' : '✨ Analyze'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule'}
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
              <p className="text-lg font-semibold text-blue-600">{analysis.best_publish_time || 'N/A'}</p>
            </div>
          </div>

          {hashtags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Suggested Hashtags</p>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag, i) => (
                  <span key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.trending_topics && analysis.trending_topics.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Trending Topics</p>
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
