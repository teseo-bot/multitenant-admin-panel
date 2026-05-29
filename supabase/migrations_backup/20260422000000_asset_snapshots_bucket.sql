-- Migration: Create Asset Snapshots Bucket
-- Created: 2026-04-22

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset_snapshots', 'asset_snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow public read access to all snapshots
CREATE POLICY "Public Access for Snapshots" ON storage.objects
FOR SELECT
USING (bucket_id = 'asset_snapshots');

-- 4. Policy: Allow authenticated users to upload snapshots
CREATE POLICY "Authenticated users can upload snapshots" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'asset_snapshots' AND auth.role() = 'authenticated');

-- 5. Policy: Allow authenticated users to update their own uploads (optional, but good practice if overriding)
CREATE POLICY "Authenticated users can update snapshots" ON storage.objects
FOR UPDATE
USING (bucket_id = 'asset_snapshots' AND auth.role() = 'authenticated');
