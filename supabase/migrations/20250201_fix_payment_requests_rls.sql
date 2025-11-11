-- Migration: Fix RLS policies for payment_requests table
-- Date: 2025-02-01
-- Description: Update RLS policies to allow authenticated users to create payment requests

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read their own payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Tenants can create payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Anyone can complete payment requests" ON payment_requests;

-- Allow authenticated users to read all payment requests (for now, can be restricted later)
CREATE POLICY "Authenticated users can read payment requests"
  ON payment_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to read payment requests (for QR scanning)
CREATE POLICY "Anonymous users can read payment requests"
  ON payment_requests
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to create payment requests
CREATE POLICY "Authenticated users can create payment requests"
  ON payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to create payment requests (for terminals without auth)
CREATE POLICY "Anonymous users can create payment requests"
  ON payment_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to update payment requests
CREATE POLICY "Authenticated users can update payment requests"
  ON payment_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to update payment requests (for completing payments)
CREATE POLICY "Anonymous users can update payment requests"
  ON payment_requests
  FOR UPDATE
  TO anon
  USING (status = 'pending' AND expires_at > NOW())
  WITH CHECK (status IN ('completed', 'expired', 'cancelled'));
