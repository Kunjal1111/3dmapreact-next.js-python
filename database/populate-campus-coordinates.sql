-- Authoritative GPS coordinates & entrance nodes for all PPSU campus facilities.
-- Snapped directly to the connected 237-node pedestrian network.
USE ppsu_campus;

-- 1. P. P. Savani University (Main Entrance & Campus Gate)
UPDATE campus_locations
SET
  latitude = 21.4972300,
  longitude = 73.0072410,
  entrance_latitude = 21.4973615,
  entrance_longitude = 73.0071056,
  route_node_id = '79113735-221d-46ae-8f41-8681efc127f1',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'P. P. Savani University';

-- 2. PPSU Campus Central Plaza
UPDATE campus_locations
SET
  latitude = 21.4989230,
  longitude = 73.0078000,
  entrance_latitude = 21.4989227,
  entrance_longitude = 73.0078003,
  route_node_id = '42130e48-e727-4512-a96e-41ab1ee3343d',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'PPSU Campus Central Plaza';

-- 3. Library
UPDATE campus_locations
SET
  latitude = 21.4989500,
  longitude = 73.0076200,
  entrance_latitude = 21.4989236,
  entrance_longitude = 73.0076349,
  route_node_id = '49ea23f3-a47f-4772-b12b-1124abf276ab',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Library';

-- 4. Hostel (Student Residential Complex)
UPDATE campus_locations
SET
  latitude = 21.4991500,
  longitude = 73.0089500,
  entrance_latitude = 21.4991319,
  entrance_longitude = 73.0089338,
  route_node_id = '11f1f06e-bc2d-4572-b54b-8bf344ef5083',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Hostel';

-- 5. Indoor Gymnasium
UPDATE campus_locations
SET
  latitude = 21.4992500,
  longitude = 73.0097100,
  entrance_latitude = 21.4992286,
  entrance_longitude = 73.0096950,
  route_node_id = '0fc8fe06-1678-4ba2-9a4b-e44b45458847',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Indoor Gymnasium';

-- 6. Canteen / Cafeteria
UPDATE campus_locations
SET
  latitude = 21.4985200,
  longitude = 73.0086200,
  entrance_latitude = 21.4985125,
  entrance_longitude = 73.0086507,
  route_node_id = '0f9ef220-7008-4c12-8d45-294361b57ce8',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Canteen / Cafeteria';

-- 7. Hospital and Medical Facility
UPDATE campus_locations
SET
  latitude = 21.4977500,
  longitude = 73.0069200,
  entrance_latitude = 21.4977255,
  entrance_longitude = 73.0069066,
  route_node_id = 'e55e347a-2ead-49fa-b0e2-2fbbf5338321',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Hospital and Medical Facility';

-- 8. Kapildev Cricket Ground
UPDATE campus_locations
SET
  latitude = 21.4989000,
  longitude = 73.0057500,
  entrance_latitude = 21.4988946,
  entrance_longitude = 73.0058033,
  route_node_id = '6cc0ccf7-950b-4926-8b00-42d1dc1c916b',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Kapildev Cricket Ground';

-- 9. Major Dhyanchand Sports Arena
UPDATE campus_locations
SET
  latitude = 21.4989800,
  longitude = 73.0068200,
  entrance_latitude = 21.4989581,
  entrance_longitude = 73.0068418,
  route_node_id = '85cf4ac6-5907-4831-be25-f8a20f8e9fb9',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Major Dhyanchand Sports Arena';

-- 10. Sunil Chhetri Multi Purpose Ground
UPDATE campus_locations
SET
  latitude = 21.4990600,
  longitude = 73.0061500,
  entrance_latitude = 21.4990463,
  entrance_longitude = 73.0061106,
  route_node_id = 'dbb41736-5c73-4519-b0a8-5f3aea2319cf',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'Sunil Chhetri Multi Purpose Ground';

-- 11. P P Savani Auditorium Hall
UPDATE campus_locations
SET
  latitude = 21.4988000,
  longitude = 73.0069200,
  entrance_latitude = 21.4987854,
  entrance_longitude = 73.0069031,
  route_node_id = 'ebbb0d4e-8c22-4b4c-b600-8bb19b8eacf2',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'P P Savani Auditorium Hall';

-- 12. PPSU Academic Schools
UPDATE campus_locations
SET
  latitude = 21.4989900,
  longitude = 73.0084500,
  entrance_latitude = 21.4989816,
  entrance_longitude = 73.0084258,
  route_node_id = 'bd28ff55-e8ff-4c58-8401-ddcaaed3756c',
  coordinates_verified = TRUE,
  is_verified = TRUE,
  is_active = TRUE
WHERE name = 'PPSU Academic Schools';
