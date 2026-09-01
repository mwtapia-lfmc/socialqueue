export default function Header({ user }: { user: any }) {
  return (
    <header className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">SocialQueue</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Sign out</button>
          </div>
        )}
      </div>
    </header>
  )
}
