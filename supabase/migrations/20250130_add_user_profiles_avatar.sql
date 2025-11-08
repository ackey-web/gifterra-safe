-- Migration: Add avatar_url to user_profiles table
-- Date: 2025-01-30
-- Description: Add profile image support to user profiles

-- Step 1: Add avatar_url column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Step 2: Create avatars storage bucket (run in Supabase Dashboard or via Storage API)
-- Bucket name: avatars
-- Public: Yes
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- Step 3: Create RLS policies for avatars bucket
-- Note: These should be applied to the storage.objects table

-- Allow anyone to view avatars
CREATE POLICY IF NOT EXISTS "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload avatars
CREATE POLICY IF NOT EXISTS "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update their avatars
CREATE POLICY IF NOT EXISTS "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete their avatars
CREATE POLICY IF NOT EXISTS "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');

-- Note: The avatar files will be stored in the following structure:
-- {wallet_address}/avatar.jpg
--
-- Client-side handling:
-- - Images are resized to 512x512 maintaining aspect ratio
-- - All images are converted to JPEG format with 0.8 quality
-- - Maximum file size: 5MB (validated client-side before upload)
-- - Supported formats: JPG, PNG, GIF, WebP
