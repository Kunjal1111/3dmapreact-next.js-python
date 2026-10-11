-- Apply to the existing ppsu_campus database. This script creates tables only.
USE ppsu_campus;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS walking_nodes (
  id CHAR(36) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campus_locations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category ENUM('academic', 'food', 'hostel', 'sports', 'services', 'outdoors') NOT NULL,
  longitude DECIMAL(10, 7) NULL,
  latitude DECIMAL(10, 7) NULL,
  entrance_latitude DECIMAL(10, 7) NULL,
  entrance_longitude DECIMAL(10, 7) NULL,
  source_url VARCHAR(500) NOT NULL,
  route_node_id CHAR(36) NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  coordinates_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_location_name (name),
  KEY idx_location_public (is_verified, is_active, category),
  KEY idx_campus_coords (latitude, longitude),
  KEY idx_campus_entrance (entrance_latitude, entrance_longitude),
  CONSTRAINT fk_location_node FOREIGN KEY (route_node_id) REFERENCES walking_nodes(id) ON DELETE SET NULL,
  CONSTRAINT fk_location_author FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS walking_edges (
  id CHAR(36) PRIMARY KEY,
  from_node_id CHAR(36) NOT NULL,
  to_node_id CHAR(36) NOT NULL,
  distance_meters DECIMAL(9, 2) NOT NULL,
  coordinates JSON NOT NULL,
  instruction VARCHAR(180) NOT NULL,
  is_bidirectional BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_edge_from (from_node_id),
  CONSTRAINT chk_edge_distance CHECK (distance_meters > 0),
  CONSTRAINT fk_edge_from FOREIGN KEY (from_node_id) REFERENCES walking_nodes(id) ON DELETE CASCADE,
  CONSTRAINT fk_edge_to FOREIGN KEY (to_node_id) REFERENCES walking_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_analytics (
  event_date DATE NOT NULL,
  event_type ENUM('search', 'route', 'location_view') NOT NULL,
  event_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (event_date, event_type),
  KEY idx_analytics_date (event_date)
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key CHAR(64) PRIMARY KEY,
  window_started_at TIMESTAMP NOT NULL,
  hit_count INT UNSIGNED NOT NULL,
  KEY idx_rate_window (window_started_at)
);

-- Create the first account through /api/auth/register, then grant admin access:
-- UPDATE users SET role = 'ADMIN' WHERE email = 'your-admin@ppsu.ac.in';