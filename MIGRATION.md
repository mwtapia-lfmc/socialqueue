# Database Migration (applied 2026-09-15)

Run in Supabase SQL Editor. Clears ownerless demo rows, adds `user_id`, and replaces the public RLS policies with per-user ones.

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

## Auth setup

- Supabase → Authentication → Providers → Google: enabled with a Google Cloud OAuth client (redirect URI `https://fbkroevujomkefgnprym.supabase.co/auth/v1/callback`)
- Supabase → Authentication → URL Configuration: Site URL `https://socialqueue-kappa.vercel.app`, redirect `https://socialqueue-kappa.vercel.app/**`
- Vercel env: `ANTHROPIC_API_KEY` set. `OPENAI_API_KEY`, `BLUESKY_*`, `EVERNOTE_*` optional — routes return mock data without them.
