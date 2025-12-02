-- Add show_reward_button column to user_profiles table
-- This column controls the visibility of the daily reward navigation button in tenant owner profiles

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS show_reward_button BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_profiles.show_reward_button IS 'Controls whether to show the daily reward navigation button in the profile (tenant owner only)';
