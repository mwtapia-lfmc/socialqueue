'use client'

import { formatDistanceToNow } from 'date-fns'

interface ScheduledPostsProps {
  posts: any[]
}

export default function ScheduledPosts({ posts }: ScheduledPostsProps) {
  const sortedPosts = [...posts].sort((a, b) => new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime())

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h2 className="text-xl font-semibold mb-4">Queue</h2>

      {sortedPosts.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No scheduled posts yet. Create one to get started!</p>
      ) : (
        <div className="space-y-4">
          {sortedPosts.map((post, i) => (
            <div key={i} className="border rounded-lg p-4 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{post.content.substring(0, 100)}...</p>
                  <p className="text-sm text-gray-500">
                    Scheduled for {new Date(post.scheduleDate).toLocaleDateString()} at{' '}
                    {post.scheduleTime || '12:00 PM'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {post.platforms?.includes('threads') && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Threads</span>
                  )}
                  {post.platforms?.includes('twitter') && (
                    <span className="px-2 py-1 bg-black text-white text-xs rounded">Twitter/X</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                <button className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
