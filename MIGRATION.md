# Database Migrations

Run each block in the Supabase SQL Editor, in order. Blocks already applied are marked.

## 1. Per-user ownership on the original tables — APPLIED 2026-09-15

```sql
DELETE FROM posts;
DELETE FROM blog_posts;

ALTER TABLE posts ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE blog_posts ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow all access to posts" ON posts;
DROP POLICY IF EXISTS "Allow all access to blog_posts" ON blog_posts;

CREATE POLICY "own posts" ON posts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own blog_posts" ON blog_posts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## 2. Unified `items` table (drafts → scheduled) + media storage bucket

Posts and blogs now live in one table with a `status` that moves from `draft` to `scheduled`. Autosave writes drafts; the Schedule action sets the date and moves the item onto the calendar. Images are cropped in the browser and uploaded to the `media` bucket.

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post',
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  tone TEXT,
  platforms JSONB NOT NULL DEFAULT '{"threads": true, "twitter": false, "bluesky": false}',
  hashtags TEXT[],
  image_urls TEXT[],
  analysis JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  schedule_date DATE,
  schedule_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX items_user_status_idx ON items (user_id, status, schedule_date);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users upload own media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users manage own media" ON storage.objects FOR ALL
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "media is publicly readable" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');
```

## Auth setup — APPLIED

- Supabase → Authentication → Providers → Google: enabled with a Google Cloud OAuth client (redirect URI `https://fbkroevujomkefgnprym.supabase.co/auth/v1/callback`). Consent screen is in *testing* mode — only listed test users can sign in.
- Supabase → Authentication → URL Configuration: Site URL `https://socialqueue-kappa.vercel.app`, redirect `https://socialqueue-kappa.vercel.app/**`
- Vercel env: `ANTHROPIC_API_KEY` set. `OPENAI_API_KEY` (image generation + AI edits), `BLUESKY_*`, `EVERNOTE_*` optional — routes return sample data without them.

## 3. Connected accounts + auto-publish scheduler

Stores per-user platform credentials (RLS-scoped) and adds publish tracking to `items`. The `pg_cron` job pings the publish endpoint every minute; it needs `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` set on Vercel.

```sql
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  account_id TEXT,
  credentials JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connections" ON connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE items ADD COLUMN published_at TIMESTAMPTZ, ADD COLUMN publish_log JSONB;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule('socialqueue-publish', '* * * * *', $$
  SELECT net.http_get(
    url := 'https://socialqueue-kappa.vercel.app/api/cron/publish',
    headers := '{"Authorization": "Bearer <CRON_SECRET from .env.local>"}'::jsonb
  );
$$);
```

## 4. Per-platform text overrides

```sql
ALTER TABLE items ADD COLUMN overrides JSONB NOT NULL DEFAULT '{}';
```

## 5. Multiple accounts per platform

Lets one platform hold several connected accounts, and lets each post choose which account it publishes from.

```sql
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_user_id_platform_key;
ALTER TABLE connections ADD CONSTRAINT connections_user_platform_account_key UNIQUE (user_id, platform, account_id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS accounts JSONB NOT NULL DEFAULT '{}';
```

## 6. Substack content structure (publication → series → buckets → posts)

Adds the structure tables and links `items` to them. Run once.

```sql
CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'substack',
  year_theme TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publication_id, key)
);
CREATE TABLE buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (publication_id, key)
);
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own publications" ON publications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own series" ON series FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own buckets" ON buckets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES publications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bucket_id UUID REFERENCES buckets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS hook TEXT,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS planned_for DATE,
  ADD COLUMN IF NOT EXISTS source_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
```
