-- Read-only report for the ten existing PPSU main-campus facilities.
-- No facility-level coordinates have been verified, so this script makes no updates.
USE ppsu_campus;

SELECT
  id,
  name,
  latitude,
  longitude,
  source_url,
  CASE
    WHEN latitude IS NULL AND longitude IS NULL THEN 'NEEDS VERIFICATION'
    WHEN coordinates_verified = TRUE
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL THEN 'VERIFIED'
    ELSE 'COORDINATES PRESENT - VERIFY'
  END AS coordinate_status
FROM campus_locations
WHERE name IN (
  'Library',
  'Hostel',
  'Indoor Gymnasium',
  'Canteen / Cafeteria',
  'Hospital and Medical Facility',
  'Kapildev Cricket Ground',
  'Major Dhyanchand Sports Arena',
  'Sunil Chhetri Multi Purpose Ground',
  'P P Savani Auditorium Hall',
  'PPSU Academic Schools'
)
ORDER BY name;
