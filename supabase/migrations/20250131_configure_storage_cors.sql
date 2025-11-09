-- Migration: Configure CORS for Supabase Storage buckets
-- Date: 2025-01-31
-- Description: Add CORS configuration to allow file uploads from Vercel production

-- Note: Supabase Storage CORS is configured at the project level, not per-bucket
-- You need to configure this in the Supabase Dashboard:
-- 1. Go to Project Settings → API
-- 2. Scroll to "CORS Configuration"
-- 3. Add your allowed origins:
--    - http://localhost:5173 (development)
--    - https://gifterra-safe.vercel.app (production)
--    - Any other custom domains

-- Alternative: Use Supabase CLI to update CORS
-- supabase storage update-config --cors-allowed-origins "http://localhost:5173,https://gifterra-safe.vercel.app"

-- This SQL file is for documentation purposes only
-- CORS for Supabase Storage must be configured through:
-- 1. Supabase Dashboard (Settings → API → CORS Configuration)
-- 2. Supabase CLI: supabase storage update-config
-- 3. Supabase Management API

-- Verify bucket exists and is public
SELECT name, public
FROM storage.buckets
WHERE id = 'gh-avatars';

-- If bucket doesn't exist or isn't public, create/update it:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('gh-avatars', 'gh-avatars', true)
-- ON CONFLICT (id)
-- DO UPDATE SET public = true;
