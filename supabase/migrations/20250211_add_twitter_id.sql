-- Migration: Add twitter_id to user_profiles
-- Date: 2025-02-11
-- Description: Add X (Twitter) account ID field to user profiles for social sharing

-- Add twitter_id column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS twitter_id TEXT;

-- Add index for twitter_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_twitter_id ON user_profiles(twitter_id) WHERE twitter_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN user_profiles.twitter_id IS 'X (Twitter) account ID (without @, e.g., "gifterra_app")';
