-- Migration: Add receive_message to user_profiles table
-- Date: 2025-01-31
-- Description: Add custom message that displays when someone sends tokens to this user

-- Add receive_message column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS receive_message TEXT DEFAULT 'ありがとうございました。';

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.receive_message IS 'Custom message displayed to sender after completing a transfer to this user. Default: ありがとうございました。';
