# P. P. Savani University (PPSU) 3D Campus Navigation
## Facility Verification Audit Report (Updated)

**Date of Audit**: 2026-10-11  
**Database**: `ppsu_campus` (`campus_locations`, `walking_nodes`, `walking_edges`)  
**Campus Location**: NH 48, Corner of GETCO, Near Biltech / Bilitha Railway Crossing, Dhamdod, Kosamba, Surat 394125, Gujarat, India  
**Geographic Bounding Box**: `21.485°N – 21.515°N`, `72.995°E – 73.020°E`

---

### 1. Executive Summary

* **Total Database Locations**: 12
* **Active Published Locations**: 12
* **Verified & Routable Locations**: 12 (100% complete)
* **Unverified Locations**: 0
* **Invalid Coordinates / Out-of-Bounds**: 0
* **Pedestrian Graph Nodes**: 237 nodes
* **Pedestrian Graph Edges**: 257 edges
* **Connected Components**: 1 (100% connected graph, 0 isolated nodes)
* **Route Node Coverage**: 12 / 12 (100%) snapped directly to pedestrian walkways
* **3D Building Models**: 12 custom 3D polygon extrusions with heights, roof colors, and interactive click events

---

### 2. Facility Verification & Routing Matrix

| # | Facility Name | Category | Latitude | Longitude | Entrance Lat/Lon | Route Node ID | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **P. P. Savani University** | `academic` | `21.4972300` | `73.0072410` | `21.4973615, 73.0071056` | `79113735-221d-46ae-8f41-8681efc127f1` | **VERIFIED & ROUTABLE** |
| 2 | **PPSU Campus Central Plaza** | `outdoors` | `21.4989230` | `73.0078000` | `21.4989227, 73.0078003` | `42130e48-e727-4512-a96e-41ab1ee3343d` | **VERIFIED & ROUTABLE** |
| 3 | **Library** | `academic` | `21.4989500` | `73.0076200` | `21.4989236, 73.0076349` | `49ea23f3-a47f-4772-b12b-1124abf276ab` | **VERIFIED & ROUTABLE** |
| 4 | **Hostel** | `hostel` | `21.4991500` | `73.0089500` | `21.4991319, 73.0089338` | `11f1f06e-bc2d-4572-b54b-8bf344ef5083` | **VERIFIED & ROUTABLE** |
| 5 | **Indoor Gymnasium** | `sports` | `21.4992500` | `73.0097100` | `21.4992286, 73.0096950` | `0fc8fe06-1678-4ba2-9a4b-e44b45458847` | **VERIFIED & ROUTABLE** |
| 6 | **Canteen / Cafeteria** | `food` | `21.4985200` | `73.0086200` | `21.4985125, 73.0086507` | `0f9ef220-7008-4c12-8d45-294361b57ce8` | **VERIFIED & ROUTABLE** |
| 7 | **Hospital and Medical Facility** | `services` | `21.4977500` | `73.0069200` | `21.4977255, 73.0069066` | `e55e347a-2ead-49fa-b0e2-2fbbf5338321` | **VERIFIED & ROUTABLE** |
| 8 | **Kapildev Cricket Ground** | `sports` | `21.4989000` | `73.0057500` | `21.4988946, 73.0058033` | `6cc0ccf7-950b-4926-8b00-42d1dc1c916b` | **VERIFIED & ROUTABLE** |
| 9 | **Major Dhyanchand Sports Arena** | `sports` | `21.4989800` | `73.0068200` | `21.4989581, 73.0068418` | `85cf4ac6-5907-4831-be25-f8a20f8e9fb9` | **VERIFIED & ROUTABLE** |
| 10 | **Sunil Chhetri Multi Purpose Ground** | `sports` | `21.4990600` | `73.0061500` | `21.4990463, 73.0061106` | `dbb41736-5c73-4519-b0a8-5f3aea2319cf` | **VERIFIED & ROUTABLE** |
| 11 | **P P Savani Auditorium Hall** | `academic` | `21.4988000` | `73.0069200` | `21.4987854, 73.0069031` | `ebbb0d4e-8c22-4b4c-b600-8bb19b8eacf2` | **VERIFIED & ROUTABLE** |
| 12 | **PPSU Academic Schools** | `academic` | `21.4989900` | `73.0084500` | `21.4989816, 73.0084258` | `bd28ff55-e8ff-4c58-8401-ddcaaed3756c` | **VERIFIED & ROUTABLE** |

---

### 3. Pedestrian Routing Validation Results

A* / Dijkstra multi-point shortest path calculations between major campus hubs were tested and verified:
- `P. P. Savani University -> PPSU Campus Central Plaza`: **326.9m** (16 nodes, ~4.3 min walk)
- `PPSU Campus Central Plaza -> Library`: **19.9m** (7 nodes, ~1 min walk)
- `Library -> Hostel`: **146.7m** (12 nodes, ~2.0 min walk)
- `Hostel -> Indoor Gymnasium`: **137.6m** (7 nodes, ~1.8 min walk)
- `Indoor Gymnasium -> Canteen / Cafeteria`: **162.9m** (7 nodes, ~2.2 min walk)
- `Canteen / Cafeteria -> Hospital and Medical Facility`: **406.7m** (20 nodes, ~5.4 min walk)
- `Hospital and Medical Facility -> Major Dhyanchand Sports Arena`: **187.4m** (8 nodes, ~2.5 min walk)
- `Major Dhyanchand Sports Arena -> Kapildev Cricket Ground`: **112.4m** (10 nodes, ~1.5 min walk)
- `Kapildev Cricket Ground -> Sunil Chhetri Multi Purpose Ground`: **49.0m** (3 nodes, ~1 min walk)
- `Sunil Chhetri Multi Purpose Ground -> P P Savani Auditorium Hall`: **180.9m** (17 nodes, ~2.4 min walk)
- `P P Savani Auditorium Hall -> PPSU Academic Schools`: **181.8m** (13 nodes, ~2.4 min walk)
- `PPSU Academic Schools -> P. P. Savani University`: **393.6m** (19 nodes, ~5.2 min walk)
