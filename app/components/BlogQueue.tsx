'use client'

interface BlogQueueProps {
  blogs: any[]
}

export default function BlogQueue({ blogs }: BlogQueueProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h2 className="text-xl font-semibold mb-4">Scheduled Blog Posts</h2>

      {blogs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No blog posts scheduled yet</p>
      ) : (
        <div className="space-y-4">
          {blogs.map((blog: any) => (
            <div key={blog.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg flex-1">{blog.title}</h3>
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {blog.schedule_date} {blog.schedule_time}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{blog.content}</p>

              <div className="flex gap-4 items-center flex-wrap">
                {blog.engagement_score && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">Score:</span>
                    <span className="font-semibold text-purple-600">{blog.engagement_score}/10</span>
                  </div>
                )}

                {blog.best_publish_time && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">Best time:</span>
                    <span className="font-semibold text-blue-600">{blog.best_publish_time}</span>
                  </div>
                )}

                {blog.trending_topics && blog.trending_topics.length > 0 && (
                  <div className="flex gap-1">
                    {blog.trending_topics.slice(0, 2).map((topic: string, i: number) => (
                      <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        {topic}
                      </span>
                    ))}
                    {blog.trending_topics.length > 2 && (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        +{blog.trending_topics.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3 border-t pt-3">
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                <button className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
