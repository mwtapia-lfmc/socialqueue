'use client'

import { useState } from 'react'

interface CalendarProps {
  posts: any[]
}

export default function Calendar({ posts }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const days = Array.from({ length: daysInMonth(currentDate) }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth(currentDate) })

  const getPostsForDay = (day: number) => {
    return posts.filter((post) => {
      const postDate = new Date(post.scheduleDate)
      return postDate.getDate() === day && postDate.getMonth() === currentDate.getMonth()
    })
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h2 className="text-xl font-semibold mb-4">Calendar</h2>

      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          ← Previous
        </button>
        <h3 className="text-lg font-semibold">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="h-24 bg-gray-50 rounded"></div>
        ))}
        {days.map((day) => {
          const dayPosts = getPostsForDay(day)
          return (
            <div key={day} className="h-24 bg-white border rounded p-2 overflow-y-auto">
              <div className="font-semibold text-sm mb-1">{day}</div>
              <div className="space-y-1">
                {dayPosts.slice(0, 2).map((post, i) => (
                  <div key={i} className="text-xs bg-blue-100 text-blue-700 p-1 rounded truncate">
                    {post.platforms?.includes('threads') ? '🧵' : ''} {post.platforms?.includes('twitter') ? '𝕏' : ''}
                  </div>
                ))}
                {dayPosts.length > 2 && <div className="text-xs text-gray-500">+{dayPosts.length - 2} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
