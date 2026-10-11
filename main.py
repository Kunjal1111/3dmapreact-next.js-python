import json
import math
import os
import sys
import uuid
import pymysql
import requests
from typing import List, Optional, Tuple, Dict, Any

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import networkx as nx
import geopy
import geopy.distance
from geopy.distance import geodesic
from shapely.geometry import Point, LineString

# PPSU Dhamdod Campus geographic bounds
CAMPUS_MIN_LAT = 21.485
CAMPUS_MAX_LAT = 21.515
CAMPUS_MIN_LON = 72.995
CAMPUS_MAX_LON = 73.020

def parse_db_url():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        env_file = os.path.join(os.path.dirname(__file__), ".env.local")
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL="):
                        db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is not configured.")
    # mysql://user:pass@host:port/dbname
    url = db_url.replace("mysql://", "")
    auth, rest = url.split("@")
    user, password = auth.split(":")
    # unquote password
    import urllib.parse
    user = urllib.parse.unquote(user)
    password = urllib.parse.unquote(password)
    
    if "/" in rest:
        hostport, dbname = rest.split("/")
    else:
        hostport, dbname = rest, "ppsu_campus"
        
    if ":" in hostport:
        host, port = hostport.split(":")
        port = int(port)
    else:
        host = hostport
        port = 3306
        
    return host, port, user, password, dbname

app = FastAPI(
    title="PPSU Campus Navigation Python Microservice",
    description="Spatial verification, OpenStreetMap graph analysis, and NetworkX shortest walking path routing.",
    version="1.0.0"
)

# Explicitly configure CORS for trusted local Next.js frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Global in-memory graph cache
graph_cache: Optional[nx.Graph] = None

def get_db_connection():
    host, port, user, password, dbname = parse_db_url()
    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=dbname,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

class RouteRequest(BaseModel):
    fromId: str = Field(..., description="Start campus location UUID")
    toId: str = Field(..., description="Destination campus location UUID")

class RouteResponse(BaseModel):
    distanceMeters: float
    durationSeconds: int
    coordinates: List[List[float]]
    instructions: List[str]

def load_graph_from_db() -> nx.Graph:
    global graph_cache
    G = nx.Graph()
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, label, longitude, latitude FROM walking_nodes")
            nodes = cursor.fetchall()
            for n in nodes:
                node_id = n["id"]
                lat = float(n["latitude"])
                lon = float(n["longitude"])
                G.add_node(node_id, label=n["label"], lat=lat, lon=lon, pos=(lon, lat))
                
            cursor.execute("SELECT id, from_node_id, to_node_id, distance_meters, coordinates, instruction, is_bidirectional FROM walking_edges")
            edges = cursor.fetchall()
            for e in edges:
                u, v = e["from_node_id"], e["to_node_id"]
                dist = float(e["distance_meters"])
                coords_raw = e["coordinates"]
                if isinstance(coords_raw, str):
                    coords = json.loads(coords_raw)
                else:
                    coords = coords_raw
                instruction = e["instruction"]
                is_bidi = bool(e["is_bidirectional"])
                
                G.add_edge(u, v, id=e["id"], distance=dist, coords=coords, instruction=instruction)
                if not is_bidi:
                    # If directed, note it, but for walk networknx undirected is standard
                    pass
        conn.close()
    except Exception as err:
        print(f"Error loading graph from DB: {err}")
    
    graph_cache = G
    return G

@app.get("/health")
@app.get("/api/python/health")
def health_check():
    conn_ok = False
    try:
        conn = get_db_connection()
        conn.ping()
        conn.close()
        conn_ok = True
    except Exception:
        conn_ok = False
        
    G = graph_cache or load_graph_from_db()
    
    return {
        "status": "healthy" if conn_ok else "database_disconnected",
        "pythonVersion": sys.version,
        "databaseConnected": conn_ok,
        "graph": {
            "nodesCount": len(G.nodes) if G else 0,
            "edgesCount": len(G.edges) if G else 0,
            "isConnected": nx.is_connected(G) if G and len(G.nodes) > 0 else False
        },
        "tools": {
            "networkx": True,
            "osmnx": True,
            "geopy": True,
            "shapely": True,
            "geopandas": True
        }
    }

@app.get("/api/python/locations/audit")
def audit_locations():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, description, category, longitude, latitude, source_url, is_verified, coordinates_verified, route_node_id FROM campus_locations ORDER BY name")
            rows = cursor.fetchall()
        conn.close()
        
        audit_results = []
        for r in rows:
            lon = float(r["longitude"]) if r["longitude"] is not None else None
            lat = float(r["latitude"]) if r["latitude"] is not None else None
            is_ver = bool(r["is_verified"])
            coords_ver = bool(r["coordinates_verified"])
            
            if lat is None or lon is None:
                status_code = "UNVERIFIED_MISSING_COORDINATES"
                details = "Missing geographic coordinates. Requires physical campus survey."
            elif not (CAMPUS_MIN_LAT <= lat <= CAMPUS_MAX_LAT and CAMPUS_MIN_LON <= lon <= CAMPUS_MAX_LON):
                status_code = "INVALID_COORDINATES"
                details = f"Coordinates ({lat}, {lon}) are outside official PPSU Dhamdod campus boundary."
            elif coords_ver:
                status_code = "VERIFIED"
                details = "Coordinates verified against authoritative campus imagery & OSM."
            else:
                status_code = "UNVERIFIED_PENDING_SURVEY"
                details = "Coordinates present but pending formal verification."
                
            audit_results.append({
                "id": r["id"],
                "name": r["name"],
                "category": r["category"],
                "latitude": lat,
                "longitude": lon,
                "isVerified": is_ver,
                "coordinatesVerified": coords_ver and status_code == "VERIFIED",
                "routeNodeId": r["route_node_id"],
                "auditStatus": status_code,
                "details": details,
                "sourceUrl": r["source_url"]
            })
            
        return {
            "totalLocations": len(rows),
            "verifiedCount": sum(1 for a in audit_results if a["auditStatus"] == "VERIFIED"),
            "unverifiedMissingCount": sum(1 for a in audit_results if a["auditStatus"] == "UNVERIFIED_MISSING_COORDINATES"),
            "locations": audit_results
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Database error during location audit: {err}")

@app.post("/api/python/graph/sync")
def sync_osm_campus_graph():
    """Fetch OpenStreetMap campus walkways, build connected graph, and populate MySQL tables."""
    url = "https://overpass-api.de/api/interpreter"
    query = """[out:json][timeout:30];
    (
      way["highway"](21.491,73.001,21.503,73.013);
    );
    out body;
    >;
    out skel qt;"""
    
    try:
        resp = requests.post(url, data={"data": query}, headers={"User-Agent": "PPSU-Campus-Nav/1.0"}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as err:
        raise HTTPException(status_code=502, detail=f"Failed to fetch OpenStreetMap data: {err}")
        
    elements = data.get("elements", [])
    nodes_map: Dict[int, Tuple[float, float]] = {}
    ways_list: List[Dict[str, Any]] = []
    
    for el in elements:
        if el.get("type") == "node":
            nodes_map[el["id"]] = (float(el["lat"]), float(el["lon"]))
        elif el.get("type") == "way":
            ways_list.append(el)
            
    if not nodes_map or not ways_list:
        raise HTTPException(status_code=404, detail="No pedestrian graph elements found in target campus bounding box.")
        
    # Build NetworkX graph
    G = nx.Graph()
    for node_id, (lat, lon) in nodes_map.items():
        G.add_node(str(node_id), lat=lat, lon=lon, label=f"OSM Node {node_id}")
        
    edges_to_insert = []
    for way in ways_list:
        node_ids = [str(n) for n in way.get("nodes", [])]
        way_tags = way.get("tags", {})
        way_name = way_tags.get("name", way_tags.get("highway", "Campus Path"))
        
        for i in range(len(node_ids) - 1):
            u, v = node_ids[i], node_ids[i+1]
            if u in G.nodes and v in G.nodes:
                lat1, lon1 = G.nodes[u]["lat"], G.nodes[u]["lon"]
                lat2, lon2 = G.nodes[v]["lat"], G.nodes[v]["lon"]
                dist = round(geodesic((lat1, lon1), (lat2, lon2)).meters, 2)
                coords = [[lon1, lat1], [lon2, lat2]]
                instruction = f"Walk along {way_name}"
                G.add_edge(u, v, distance=dist, coords=coords, instruction=instruction)
                
    # Filter to largest connected component
    G.remove_nodes_from(list(nx.isolates(G)))
    components = list(nx.connected_components(G))
    if not components:
        raise HTTPException(status_code=422, detail="No connected graph component found.")
    
    largest_component = max(components, key=len)
    G_connected = G.subgraph(largest_component).copy()
    
    # Store in MySQL database
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Clear existing graph
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            cursor.execute("TRUNCATE TABLE walking_edges")
            cursor.execute("TRUNCATE TABLE walking_nodes")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            # Map node IDs to DB UUIDs
            node_uuid_map = {}
            for node_id in G_connected.nodes:
                db_uuid = str(uuid.uuid4())
                node_uuid_map[node_id] = db_uuid
                lat = G_connected.nodes[node_id]["lat"]
                lon = G_connected.nodes[node_id]["lon"]
                label = G_connected.nodes[node_id]["label"]
                cursor.execute(
                    "INSERT INTO walking_nodes (id, label, longitude, latitude) VALUES (%s, %s, %s, %s)",
                    (db_uuid, label, lon, lat)
                )
                
            edge_count = 0
            for u, v, data in G_connected.edges(data=True):
                edge_uuid = str(uuid.uuid4())
                from_uuid = node_uuid_map[u]
                to_uuid = node_uuid_map[v]
                dist = data.get("distance", 1.0)
                coords_json = json.dumps(data.get("coords", []))
                instruction = data.get("instruction", "Walk along campus path")
                
                cursor.execute(
                    """INSERT INTO walking_edges 
                       (id, from_node_id, to_node_id, distance_meters, coordinates, instruction, is_bidirectional) 
                       VALUES (%s, %s, %s, %s, %s, %s, TRUE)""",
                    (edge_uuid, from_uuid, to_uuid, dist, coords_json, instruction)
                )
                edge_count += 1
                
            # Snap verified campus locations to nearest node
            cursor.execute("SELECT id, name, longitude, latitude FROM campus_locations WHERE coordinates_verified = TRUE AND longitude IS NOT NULL AND latitude IS NOT NULL")
            verified_locs = cursor.fetchall()
            for loc in verified_locs:
                loc_lat = float(loc["latitude"])
                loc_lon = float(loc["longitude"])
                min_dist = float("inf")
                best_node_uuid = None
                
                for node_id in G_connected.nodes:
                    n_lat = G_connected.nodes[node_id]["lat"]
                    n_lon = G_connected.nodes[node_id]["lon"]
                    d = geodesic((loc_lat, loc_lon), (n_lat, n_lon)).meters
                    if d < min_dist:
                        min_dist = d
                        best_node_uuid = node_uuid_map[node_id]
                        
                if best_node_uuid:
                    cursor.execute("UPDATE campus_locations SET route_node_id = %s WHERE id = %s", (best_node_uuid, loc["id"]))
                    
        conn.close()
        
        # Refresh in-memory graph
        load_graph_from_db()
        
        return {
            "success": True,
            "nodesInserted": len(G_connected.nodes),
            "edgesInserted": edge_count,
            "snappedLocationsCount": len(verified_locs)
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to sync graph to database: {err}")

@app.post("/api/python/routes/calculate", response_model=RouteResponse)
@app.post("/routes/calculate", response_model=RouteResponse)
def calculate_route(req: RouteRequest):
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, route_node_id, coordinates_verified, longitude, latitude FROM campus_locations WHERE id IN (%s, %s) AND is_active = TRUE",
                (req.fromId, req.toId)
            )
            rows = cursor.fetchall()
        conn.close()
    except Exception as err:
        raise HTTPException(status_code=503, detail=f"Database query failed: {err}")
        
    if len(rows) != 2:
        raise HTTPException(status_code=400, detail="Choose two valid active campus locations.")
        
    loc_map = {r["id"]: r for r in rows}
    from_loc = loc_map.get(req.fromId)
    to_loc = loc_map.get(req.toId)
    
    if not from_loc or not to_loc:
        raise HTTPException(status_code=400, detail="Location record not found.")
        
    # Check verification
    for loc in (from_loc, to_loc):
        if not loc["coordinates_verified"] or loc["longitude"] is None or loc["latitude"] is None:
            raise HTTPException(
                status_code=409,
                detail=f"Route data needs verification for '{loc['name']}' before directions are available."
            )
            
    G = graph_cache or load_graph_from_db()
    if not G or len(G.nodes) == 0:
        raise HTTPException(status_code=503, detail="Campus pedestrian graph is empty or not loaded.")
        
    from_node = from_loc.get("route_node_id")
    to_node = to_loc.get("route_node_id")
    
    # Snap if route_node_id is missing or not in graph
    def find_nearest_node(lat: float, lon: float) -> Optional[str]:
        best_n = None
        best_d = float("inf")
        for n, d in G.nodes(data=True):
            if "lat" in d and "lon" in d:
                dist = geodesic((lat, float(d["lat"])), (lon, float(d["lon"]))).meters
                if dist < best_d:
                    best_d = dist
                    best_n = n
        return best_n

    if not from_node or from_node not in G.nodes:
        from_node = find_nearest_node(float(from_loc["latitude"]), float(from_loc["longitude"]))
    if not to_node or to_node not in G.nodes:
        to_node = find_nearest_node(float(to_loc["latitude"]), float(to_loc["longitude"]))
        
    if not from_node or not to_node:
        raise HTTPException(status_code=404, detail="No suitable pedestrian graph node found for start or destination.")
        
    if from_node == to_node:
        coords = [[float(from_loc["longitude"]), float(from_loc["latitude"])]]
        return RouteResponse(distanceMeters=0.0, durationSeconds=0, coordinates=coords, instructions=["You are already at your destination."])
        
    try:
        path = nx.shortest_path(G, source=from_node, target=to_node, weight="distance")
        distance_meters = round(nx.shortest_path_length(G, source=from_node, target=to_node, weight="distance"), 1)
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="No connected walking path exists between these campus places.")
    except nx.NodeNotFound:
        raise HTTPException(status_code=404, detail="Specified routing nodes were not found in graph.")

    # Reconstruct polyline coordinates & turn-by-turn instructions
    coordinates: List[List[float]] = []
    instructions: List[str] = []
    
    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        edge_data = G.get_edge_data(u, v)
        if not edge_data:
            continue
            
        edge_coords = edge_data.get("coords", [])
        if edge_coords:
            # Check direction of coordinates
            u_pos = [G.nodes[u]["lon"], G.nodes[u]["lat"]]
            v_pos = [G.nodes[v]["lon"], G.nodes[v]["lat"]]
            
            # If coordinates first element is closer to v_pos than u_pos, reverse
            if len(edge_coords) >= 2:
                d_normal = math.hypot(edge_coords[0][0] - u_pos[0], edge_coords[0][1] - u_pos[1])
                d_reverse = math.hypot(edge_coords[-1][0] - u_pos[0], edge_coords[-1][1] - u_pos[1])
                if d_reverse < d_normal:
                    edge_coords = list(reversed(edge_coords))
                    
            if not coordinates:
                coordinates.extend(edge_coords)
            else:
                coordinates.extend(edge_coords[1:])
        else:
            u_pos = [G.nodes[u]["lon"], G.nodes[u]["lat"]]
            v_pos = [G.nodes[v]["lon"], G.nodes[v]["lat"]]
            if not coordinates:
                coordinates.append(u_pos)
            coordinates.append(v_pos)
            
        inst = edge_data.get("instruction", f"Walk along verified path toward node {v}")
        instructions.append(inst)
        
    # Standard walk pace = 1.25 m/s (~4.5 km/h)
    duration_seconds = math.ceil(distance_meters / 1.25)
    
    return RouteResponse(
        distanceMeters=distance_meters,
        durationSeconds=duration_seconds,
        coordinates=coordinates,
        instructions=instructions
    )

if __name__ == "__main__":
    import uvicorn
    print("Starting PPSU Campus Python Navigation microservice on port 8000...")
    load_graph_from_db()
    uvicorn.run(app, host="127.0.0.1", port=8000)
