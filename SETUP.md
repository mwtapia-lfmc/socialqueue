# SocialQueue Setup Guide

SocialQueue is a social media scheduling dashboard for Threads and Twitter/X.

## Phase 1 Features
- ✅ Compose posts with text and images
- ✅ Schedule posts for specific dates/times
- ✅ Calendar view of scheduled posts
- ✅ Post queue management
- 🚧 Multi-platform support (Threads + Twitter/X)

## Prerequisites

1. **Meta Developer Account**
   - App ID: `1076620851489401`
   - Threads App ID: `1526069572608622`
   - [Get App Secret](https://developers.facebook.com/apps/1076620851489401/settings/basic/)

2. **Twitter/X Developer Account** (optional)
   - Apply for API access at [developer.twitter.com](https://developer.twitter.com)
   - Get Client ID and Client Secret

3. **Supabase Project**
   - Create at [supabase.com](https://supabase.com)
   - Get Project URL and Anon Key
   - Will need to create tables for posts, accounts, and scheduled jobs

## Environment Variables

Copy `.env.local` and fill in your credentials:

```bash
# Threads
NEXT_PUBLIC_THREADS_APP_ID=1526069572608622
THREADS_APP_SECRET=your_app_secret_here
NEXT_PUBLIC_THREADS_REDIRECT_URI=http://localhost:3000/api/auth/threads/callback

# Twitter/X
NEXT_PUBLIC_TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_TWITTER_REDIRECT_URI=http://localhost:3000/api/auth/twitter/callback

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database (for scheduled jobs)
DATABASE_URL=postgresql://user:password@host/dbname
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

## Database Schema (Supabase)

### posts table
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  platforms JSONB DEFAULT '{"threads": false, "twitter": false}',
  schedule_date DATE NOT NULL,
  schedule_time TIME NOT NULL,
  media_urls TEXT[],
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### accounts table
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Next Steps

1. Set up Supabase project and database tables
2. Get Threads API access (already in progress)
3. Get Twitter/X API credentials
4. Implement OAuth flows for each platform
5. Wire up database storage
6. Build scheduling backend (cron jobs)
7. Test posting functionality

## Support

For issues with Meta/Threads API, see [Threads API Docs](https://developers.facebook.com/docs/threads)
For Twitter/X API, see [Twitter API Docs](https://developer.twitter.com/en/docs)
