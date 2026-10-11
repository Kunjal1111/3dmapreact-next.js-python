-- Migration: Add entrance coordinates to campus_locations and index them
USE ppsu_campus;

-- Add entrance_latitude and entrance_longitude columns if they do not exist
ALTER TABLE campus_locations
  ADD COLUMN IF NOT EXISTS entrance_latitude DECIMAL(10, 7) NULL AFTER latitude,
  ADD COLUMN IF NOT EXISTS entrance_longitude DECIMAL(10, 7) NULL AFTER entrance_latitude;

-- Add indexes on coordinates for spatial querying
ALTER TABLE campus_locations
  ADD INDEX IF NOT EXISTS idx_campus_coords (latitude, longitude),
  ADD INDEX IF NOT EXISTS idx_campus_entrance (entrance_latitude, entrance_longitude);
