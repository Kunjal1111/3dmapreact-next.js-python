# PPSU Campus 3D

**Explore. Navigate. Experience.** A responsive campus explorer for the P. P. Savani University main campus at Dhamdod/Kosamba, Surat, Gujarat.

## Campus data policy

The official PPSU website confirms the main campus address as **NH48, GETCO, Near Biltech, Dhamdod Village, Mangrol, Kosamba, Surat 394125**. It also lists campus facilities and academic schools, but does not publish a surveyed public building plan or an indoor walking network.

For that reason, this project does not ship guessed facility coordinates, drawn campus buildings, or fabricated walkways. The supplied PPSU main-campus center is used only to center the map; it is not assigned to any facility or treated as a surveyed building position or campus boundary. The source-backed facility directory is seeded from `database/seed-campus-locations.sql`; those entries have no coordinates and remain out of map pins and navigation until surveyed. Run `database/verify-campus-location-coordinates.sql` for a read-only report of the ten facility coordinate states. Mapbox's 3D building visualization uses only its base-map building data, not fabricated PPSU geometry. Add only administrator-surveyed facility points and paths backed by PPSU sources.

Verified public sources:

- [PPSU official website](https://www.ppsu.ac.in/)
- [Official PPSU campus page](https://www.ppsu.ac.in/ppsu-campus)
- [Getting to PPSU and main campus address](https://www.ppsu.ac.in/getting-ppsu)

## Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS, Framer Motion, and Lucide icons
- Mapbox GL JS with light, dark, and satellite styles; 2D, pitched 3D, and terrain modes
- MySQL 8 with parameterized queries and connection pooling
- Zod request validation, bcrypt password hashing, and signed HTTP-only sessions
- Dijkstra walking routes over admin-maintained, surveyed graph data

## Local setup

Prerequisites: Node.js 20.9 or newer, npm, a MySQL 8 database, and a Mapbox public access token.

1. Install packages with `npm install`.
2. Put local values in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
   DATABASE_URL=mysql://user:password@127.0.0.1:3306/ppsu_campus
   AUTH_SECRET=replace-with-at-least-32-random-characters
   ```

   The Mapbox token is intentionally public because it is used by the browser. Restrict its allowed URLs/origins and scopes in Mapbox. `AUTH_SECRET` must be a private random value of at least 32 characters; never expose it with a `NEXT_PUBLIC_` prefix.

3. Initialize the existing `ppsu_campus` database in MySQL Workbench:
   - Connect to the MySQL instance that the app will use and select the existing `ppsu_campus` schema.
   - Open [`database/schema.sql`](database/schema.sql) and execute the full script. It selects `ppsu_campus` and uses only `CREATE TABLE IF NOT EXISTS`; it does not create, drop, or reset a database or existing table.
   - Run `SHOW TABLES;` with `ppsu_campus` selected. The project requires `campus_locations`, `daily_analytics`, `rate_limit_buckets`, `users`, `walking_edges`, and `walking_nodes`.
4. Ensure the existing `DATABASE_URL` targets this same MySQL instance and database, and that its account has permission to create and use these tables. Do not put credentials in source files or share them in logs.
5. For an existing database created before location survey status was introduced, execute [`database/migrate-campus-location-verification.sql`](database/migrate-campus-location-verification.sql) once. Then execute [`database/seed-campus-locations.sql`](database/seed-campus-locations.sql); it is safe to rerun and inserts only missing official directory entries with `NULL` coordinates.
6. Start the app with `npm run dev` and open `http://localhost:3000`.

The app can render without a Mapbox token, but the interactive map will show a configuration state. The database-backed location and account APIs remain unavailable until MySQL and `AUTH_SECRET` are configured.

## Admin bootstrap and campus data

1. Register a normal account from the sign-in dialog.
2. Grant the first administrator role through a trusted MySQL session:

   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'admin@ppsu.ac.in';
   ```

   Self-registration always creates `USER` accounts. Admin access is checked against the current database role, so removing the role takes effect on the next admin API request.

3. Sign in and open **Admin**. Add walking-network nodes using surveyed coordinates. Add a campus location with its official PPSU source, surveyed coordinates, and (if navigable) a nearby route node. The location and route node must align within approximately five metres.
4. Add each measured walking segment with its distance, geometry coordinates, and turn guidance. Segment geometry must begin/end at its chosen nodes. Bidirectional segments can be traversed in either direction.
5. Review a location before publishing it. Only active, verified locations appear in public search and directions.

The dashboard deliberately does not geocode or invent campus pins. Source URLs must use HTTPS on `ppsu.ac.in` or one of its subdomains. Coordinates and path geometry should come from an authorized campus survey or an authoritative PPSU publication.

## Routing and analytics

`POST /api/directions` runs Dijkstra over `walking_nodes` and `walking_edges`; it returns the shortest connected measured path, geometry, administrator-authored step instructions, distance, and an estimated walking time at 1.25 m/s. Missing graph connections return an explicit error instead of a straight-line guess.

Analytics store only daily event counts grouped by event type. No search text, location identifier, account ID, session ID, raw IP address, or individual history is stored in analytics. Rate-limit buckets use a keyed HMAC of the request address and are separate from analytics. Configure the deployment proxy to set trusted `x-forwarded-for` headers.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Vercel deployment

1. Push this project to a Git provider and import it into Vercel. The Next.js framework is detected automatically; no custom `vercel.json` is needed.
2. Provision a reachable MySQL 8 database that accepts Vercel connections, enable TLS, and apply `database/schema.sql`.
3. Add `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `DATABASE_URL`, and a unique `AUTH_SECRET` in Vercel Project Settings for Production and Preview as appropriate. Use a distinct database or restrict accounts for Preview deployments.
4. Restrict the Mapbox public token to the deployed domains, including the required Geocoding API and style/tile access.
5. Deploy, register the first account, grant its admin role through the database, then add only source-backed, surveyed locations and route geometry.

The production MySQL pool requires TLS. Keep database credentials and `AUTH_SECRET` in Vercel environment variables; never commit them. `.env.local` is ignored by Git.

## Project layout

```text
src/
  app/                    Next.js routes, metadata, and global styles
  app/api/                Public, authentication, directions, and admin APIs
  components/             Explorer, Mapbox view, auth dialog, admin dashboard
  lib/                    Database, auth, validation, rate limiting, routing
database/schema.sql       MySQL schema; intentionally contains no campus seed data
database/migrate-campus-location-verification.sql  Add nullable positions and verification state
database/seed-campus-locations.sql  Source-backed facility names; no coordinates or routes
```

## Accessibility and operations

The explorer uses labeled controls, keyboard-operable buttons, visible focus styles, status announcements, reduced-motion preferences, Mapbox attribution, and responsive layouts. Error, empty, loading, and token/database configuration states are included. Keep the verified campus dataset reviewed as facilities, paths, and access rules change.
   3 d m a p r e a c t - n e x t . j s - p y t h o n  
 #   3 d m a p r e a c t - n e x t . j s - p y t h o n  
 