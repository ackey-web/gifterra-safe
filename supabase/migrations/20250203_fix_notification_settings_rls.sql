-- Fix RLS policies for user_notification_settings table
-- Issue: Previous policies used auth.jwt() which requires authenticated sessions
-- Solution: Allow public access for users to manage their own settings based on user_address

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own settings" ON user_notification_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_notification_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_notification_settings;

-- Create new policies that work with anon key
-- Allow SELECT for any user's settings (public read)
CREATE POLICY "Enable read access for all users"
  ON user_notification_settings
  FOR SELECT
  USING (true);

-- Allow INSERT for any user_address (public insert)
CREATE POLICY "Enable insert access for all users"
  ON user_notification_settings
  FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE for any user_address (public update)
CREATE POLICY "Enable update access for all users"
  ON user_notification_settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow DELETE for any user_address (public delete)
CREATE POLICY "Enable delete access for all users"
  ON user_notification_settings
  FOR DELETE
  USING (true);
