-- One-time, additive migration for source-backed facilities without surveyed pins.
USE ppsu_campus;

ALTER TABLE campus_locations
  MODIFY COLUMN longitude DECIMAL(10, 7) NULL,
  MODIFY COLUMN latitude DECIMAL(10, 7) NULL,
  MODIFY COLUMN created_by CHAR(36) NULL,
  ADD COLUMN coordinates_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER is_verified;

-- Existing published pins were reviewed under the previous single verification flag.
UPDATE campus_locations
SET coordinates_verified = TRUE
WHERE is_verified = TRUE AND longitude IS NOT NULL AND latitude IS NOT NULL;