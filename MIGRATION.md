# Database Migration Guide

Run these SQL commands in your Supabase dashboard to update the schema:

## 1. Update posts table

```sql
-- Add user_id column
ALTER TABLE posts ADD COLUMN user_id UUID NOT NULL DEFAULT gen_random_uuid();

-- Add foreign key constraint
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fk 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old RLS policy
DROP POLICY IF EXISTS "Allow all access to posts" ON posts;

-- Add new RLS policies for user-based access
CREATE POLICY "Users can view their own posts" 
  ON posts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create posts" 
  ON posts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
  ON posts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
  ON posts FOR DELETE 
  USING (auth.uid() = user_id);
```

## 2. Update blog_posts table

```sql
-- Add user_id column
ALTER TABLE blog_posts ADD COLUMN user_id UUID NOT NULL DEFAULT gen_random_uuid();

-- Add foreign key constraint
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_user_id_fk 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old RLS policy
DROP POLICY IF EXISTS "Allow all access to blog_posts" ON blog_posts;

-- Add new RLS policies
CREATE POLICY "Users can view their own blog posts" 
  ON blog_posts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create blog posts" 
  ON blog_posts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blog posts" 
  ON blog_posts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blog posts" 
  ON blog_posts FOR DELETE 
  USING (auth.uid() = user_id);
```

## 3. Enable Google OAuth in Supabase

1. Go to Authentication > Providers
2. Enable Google
3. Add your Google OAuth credentials from Google Cloud Console
4. Set callback URL: `https://yourdomain.vercel.app/auth/callback`
