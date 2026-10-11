"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import { AlertCircle, MapPinned } from "lucide-react";
import type { CampusLocation, WalkingRoute } from "@/lib/types";
import campusBuildingsGeoJson from "@/lib/campus-buildings-geojson.json";

export type MapMode = "2d" | "3d" | "advanced";
export type MapStyle = "light" | "dark" | "satellite";

const PPSU_MAP_CENTER: [number, number] = [73.0078, 21.4988];
const CAMPUS_ZOOM = 16.6;

const STYLE_URLS: Record<MapStyle, string> = {
  light: "mapbox://styles/mapbox/streets-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

const CATEGORY_COLORS: Record<string, string> = {
  academic: "#23533c",
  food: "#d97736",
  hostel: "#4a6785",
  sports: "#b85c38",
  services: "#3b7a8a",
  outdoors: "#5f7e5b",
};

type MapViewProps = {
  locations: CampusLocation[];
  selectedId: string | null;
  route: WalkingRoute | null;
  mode: MapMode;
  mapStyle: MapStyle;
  onSelect: (location: CampusLocation) => void;
  onReady: (map: MapboxMap | null) => void;
};

function locationMarker(location: CampusLocation, active: boolean): HTMLElement {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `campus-marker${active ? " campus-marker-active" : ""}${!location.coordinatesVerified ? " opacity-70 border-dashed" : ""}`;
  marker.setAttribute("aria-label", location.name);
  marker.title = `${location.name}${location.coordinatesVerified ? "" : " (Coordinates Pending Survey)"}`;
  const pinBg = CATEGORY_COLORS[location.category] || "#ef775e";
  marker.style.backgroundColor = active ? "#1e4d35" : pinBg;
  marker.innerHTML = `<span></span>`;
  return marker;
}

function updateBuildingExtrusions(
  map: MapboxMap,
  mode: MapMode,
  onSelectBuilding?: (name: string) => void
) {
  const ppsuSourceId = "ppsu-campus-buildings";
  const ppsuLayerId = "ppsu-campus-3d-buildings";
  const ppsuLabelLayerId = "ppsu-campus-building-labels";
  const mapboxLayerId = "mapbox-3d-buildings";

  if (mode === "2d") {
    if (map.getLayer(ppsuLabelLayerId)) map.removeLayer(ppsuLabelLayerId);
    if (map.getLayer(ppsuLayerId)) map.removeLayer(ppsuLayerId);
    if (map.getLayer(mapboxLayerId)) map.removeLayer(mapboxLayerId);
    return;
  }

  // 1. Add PPSU Campus Specific 3D Building Extrusions from local GeoJSON
  if (!map.getSource(ppsuSourceId)) {
    map.addSource(ppsuSourceId, {
      type: "geojson",
      data: campusBuildingsGeoJson as GeoJSON.FeatureCollection,
    });
  }

  if (!map.getLayer(ppsuLayerId) && map.getSource(ppsuSourceId)) {
    const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol");
    map.addLayer(
      {
        id: ppsuLayerId,
        source: ppsuSourceId,
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": [
            "case",
            ["has", "color"],
            ["get", "color"],
            ["match", ["get", "category"],
              "academic", "#23533c",
              "food", "#d97736",
              "hostel", "#4a6785",
              "sports", "#b85c38",
              "services", "#3b7a8a",
              "outdoors", "#5f7e5b",
              "#7b8580"
            ]
          ],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["to-number", ["get", "height"], 15]],
          "fill-extrusion-base": ["to-number", ["get", "base_height"], 0],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer?.id
    );

    // Interactive building labels in 3D
    if (!map.getLayer(ppsuLabelLayerId)) {
      map.addLayer({
        id: ppsuLabelLayerId,
        source: ppsuSourceId,
        type: "symbol",
        minzoom: 15.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-offset": [0, -1.2],
          "text-anchor": "bottom",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#17231e",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }

    // Interactive cursor and click events on PPSU 3D buildings
    map.on("mouseenter", ppsuLayerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", ppsuLayerId, () => {
      map.getCanvas().style.cursor = "";
    });

    if (onSelectBuilding) {
      map.on("click", ppsuLayerId, (e) => {
        if (e.features && e.features[0]) {
          const featureName = e.features[0].properties?.name;
          if (featureName) {
            onSelectBuilding(featureName);
          }
        }
      });
    }
  }

  // 2. Add background Composite Mapbox 3D buildings for regional context
  if (!map.getLayer(mapboxLayerId) && map.getSource("composite")) {
    const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol");
    map.addLayer(
      {
        id: mapboxLayerId,
        source: "composite",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 15,
        filter: ["==", ["get", "extrude"], "true"],
        paint: {
          "fill-extrusion-color": "#d8d2c8",
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, ["to-number", ["get", "height"], 0]],
          "fill-extrusion-base": ["to-number", ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.85,
        },
      },
      firstSymbolLayer?.id
    );
  }
}

function installMapOverlays(
  map: MapboxMap,
  route: WalkingRoute | null,
  mode: MapMode,
  onSelectBuilding?: (name: string) => void
) {
  if (!map.getSource("walking-route")) {
    map.addSource("walking-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "walking-route-casing",
      type: "line",
      source: "walking-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.95 },
    });
    map.addLayer({
      id: "walking-route-line",
      type: "line",
      source: "walking-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ef775e", "line-width": 4.5, "line-dasharray": [1, 1.5] },
    });
    map.addLayer({
      id: "walking-route-arrows",
      type: "symbol",
      source: "walking-route",
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 90,
        "text-field": "➤",
        "text-font": ["Open Sans Semibold"],
        "text-size": 12,
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "map",
        "text-keep-upright": false,
      },
      paint: { "text-color": "#c84f3e", "text-halo-color": "#ffffff", "text-halo-width": 2 },
    });
  }

  const source = map.getSource("walking-route") as mapboxgl.GeoJSONSource;
  source.setData(
    route?.coordinates.length
      ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coordinates } }
      : { type: "FeatureCollection", features: [] }
  );

  updateBuildingExtrusions(map, mode, onSelectBuilding);

  if (mode === "advanced") {
    if (!map.getSource("campus-terrain")) {
      map.addSource("campus-terrain", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: "campus-terrain", exaggeration: 1.15 });
  } else {
    map.setTerrain(null);
  }
}

export function MapView({ locations, selectedId, route, mode, mapStyle, onSelect, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const routeRef = useRef(route);
  const modeRef = useRef(mode);
  const mapStyleRef = useRef(mapStyle);
  const appliedMapStyleRef = useRef<MapStyle | null>(null);
  const onReadyRef = useRef(onReady);
  const onSelectRef = useRef(onSelect);
  const locationsRef = useRef(locations);

  routeRef.current = route;
  modeRef.current = mode;
  mapStyleRef.current = mapStyle;
  onReadyRef.current = onReady;
  onSelectRef.current = onSelect;
  locationsRef.current = locations;

  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const handleBuildingClick = useCallback((buildingName: string) => {
    const loc = locationsRef.current.find((l) => l.name.toLowerCase() === buildingName.toLowerCase());
    if (loc) {
      onSelectRef.current(loc);
    }
  }, []);

  useEffect(() => {
    const markers = markersRef.current;
    if (!containerRef.current || !token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    mapboxgl.accessToken = token;
    const initialize = () => {
      if (!mapboxgl.supported()) {
        setLoading(false);
        setMapError("WebGL is unavailable in this browser, so the campus map cannot be displayed.");
        return;
      }
      try {
        if (containerRef.current?.childNodes.length) containerRef.current.replaceChildren();
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style: STYLE_URLS[mapStyleRef.current],
          center: PPSU_MAP_CENTER,
          zoom: CAMPUS_ZOOM,
          pitch: modeRef.current === "2d" ? 0 : 54,
          bearing: -15,
          maxPitch: 75,
          attributionControl: true,
          cooperativeGestures: true,
        });
        appliedMapStyleRef.current = mapStyleRef.current;
        if (cancelled) {
          map.remove();
          return;
        }
        map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: false }), "top-right");
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-right");
        map.on("load", () => installMapOverlays(map, routeRef.current, modeRef.current, handleBuildingClick));
        map.on("error", (event) => {
          if (event.error?.message) {
            setLoading(false);
            setMapError("Map tiles could not be loaded. Check the Mapbox token and allowed URLs.");
          }
        });
        const resizeObserver = new ResizeObserver(() => {
          if (map.loaded()) map.resize();
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        map.once("remove", () => resizeObserver.disconnect());
        mapRef.current = map;
        onReadyRef.current(map);
        map.once("load", () => {
          setLoading(false);
          map.resize();
        });
      } catch {
        setLoading(false);
        setMapError("The campus map could not be initialized. Check browser WebGL support and the Mapbox token.");
      }
    };
    initialize();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      appliedMapStyleRef.current = null;
      onReadyRef.current(null);
    };
  }, [token, handleBuildingClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedMapStyleRef.current === mapStyle) return;
    map.setStyle(STYLE_URLS[mapStyle]);
    appliedMapStyleRef.current = mapStyle;
    map.once("style.load", () => installMapOverlays(map, routeRef.current, modeRef.current, handleBuildingClick));
  }, [mapStyle, handleBuildingClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: mode === "2d" ? 0 : mode === "3d" ? 54 : 67, duration: 900 });
    if (map.isStyleLoaded()) installMapOverlays(map, routeRef.current, mode, handleBuildingClick);
  }, [mode, handleBuildingClick]);

  // Marker synchronizer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      if (!map.isStyleLoaded()) return;
      const current = markersRef.current;
      const positionedLocations = locations.filter(
        (location): location is CampusLocation & { longitude: number; latitude: number } =>
          location.longitude !== null && location.latitude !== null
      );
      const ids = new Set(positionedLocations.map((location) => location.id));
      current.forEach((marker, id) => {
        if (!ids.has(id)) {
          marker.remove();
          current.delete(id);
        }
      });
      positionedLocations.forEach((location) => {
        const existing = current.get(location.id);
        if (existing) {
          existing.setLngLat([location.longitude, location.latitude]);
          existing.getElement().classList.toggle("campus-marker-active", location.id === selectedId);
          return;
        }
        const element = locationMarker(location, location.id === selectedId);
        element.addEventListener("click", () => onSelectRef.current(location));
        current.set(
          location.id,
          new mapboxgl.Marker({ element, anchor: "bottom" })
            .setLngLat([location.longitude, location.latitude])
            .addTo(map)
        );
      });
    };
    if (map.isStyleLoaded()) update();
    else map.once("style.load", update);
    return () => {
      map.off("style.load", update);
    };
  }, [locations, selectedId, onSelect, mapStyle]);

  // Route bounds update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource("walking-route")) return;
    const source = map.getSource("walking-route") as mapboxgl.GeoJSONSource;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: route?.coordinates ?? [] },
    });
    if (route?.coordinates.length) {
      const bounds = route.coordinates.reduce(
        (result, coordinate) => result.extend(coordinate),
        new mapboxgl.LngLatBounds(route.coordinates[0], route.coordinates[0])
      );
      map.fitBounds(bounds, { padding: { top: 90, right: 90, bottom: 90, left: 90 }, duration: 900, maxZoom: 18.5 });
    }
  }, [route, mapStyle]);

  // Animated pulse dot
  useEffect(() => {
    const map = mapRef.current;
    const coordinates = route?.coordinates;
    if (!map || !coordinates || coordinates.length < 2) return;
    const element = document.createElement("span");
    element.className = "route-progress-dot";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Animated walking route direction");
    const marker = new mapboxgl.Marker({ element, anchor: "center" }).setLngLat(coordinates[0]).addTo(map);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => marker.remove();
    const lengths: number[] = [];
    let totalLength = 0;
    for (let index = 1; index < coordinates.length; index += 1) {
      const [fromLongitude, fromLatitude] = coordinates[index - 1];
      const [toLongitude, toLatitude] = coordinates[index];
      const latitudeScale = Math.cos((((fromLatitude + toLatitude) / 2) * Math.PI) / 180);
      const segmentLength = Math.hypot((toLongitude - fromLongitude) * latitudeScale, toLatitude - fromLatitude);
      lengths.push(segmentLength);
      totalLength += segmentLength;
    }
    if (!totalLength) {
      marker.remove();
      return;
    }
    let animationFrame = 0;
    const startedAt = performance.now();
    const animate = (now: number) => {
      let distance = (((now - startedAt) % 2800) / 2800) * totalLength;
      for (let index = 0; index < lengths.length; index += 1) {
        if (distance <= lengths[index] || index === lengths.length - 1) {
          const progress = lengths[index] ? distance / lengths[index] : 0;
          const from = coordinates[index];
          const to = coordinates[index + 1];
          marker.setLngLat([from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress]);
          break;
        }
        distance -= lengths[index];
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      marker.remove();
    };
  }, [route, mapStyle]);

  const locateCampus = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: PPSU_MAP_CENTER,
      zoom: CAMPUS_ZOOM,
      pitch: mode === "2d" ? 0 : mode === "3d" ? 54 : 67,
      bearing: -15,
      duration: 1300,
    });
  }, [mode]);

  if (!token) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#e8ebe4] p-6 text-center">
        <div className="max-w-sm rounded-xl border border-white bg-white/90 p-7 shadow-xl backdrop-blur">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#e8eee6] text-leaf">
            <MapPinned size={22} />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold">Map connection needed</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Add a public Mapbox token in <code>.env.local</code> to load the PPSU campus map. The official campus
            address is shown at left.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#e8ebe4]">
      <div ref={containerRef} className="absolute inset-0" aria-label="Map of P. P. Savani University main campus" />
      {loading && (
        <div className="absolute inset-0 z-[2] grid place-items-center bg-[#e8ebe4]/80" role="status">
          <span className="rounded-lg bg-white px-4 py-3 text-sm text-ink/65 shadow">
            Loading the PPSU 3D campus map…
          </span>
        </div>
      )}
      {mapError && (
        <div
          role="alert"
          className="absolute bottom-5 left-5 z-[3] flex max-w-sm gap-2 rounded-lg border border-coral/30 bg-white px-4 py-3 text-xs text-ink shadow"
        >
          <AlertCircle size={16} className="shrink-0 text-coral" />
          {mapError}
        </div>
      )}
      <div className="absolute left-4 top-[160px] z-[3] flex gap-2">
        <button
          onClick={locateCampus}
          className="grid h-10 w-10 place-items-center rounded-lg border border-white bg-white text-ink shadow-lg transition hover:bg-ink hover:text-white"
          aria-label="Center map on PPSU campus"
        >
          <MapPinned size={17} />
        </button>
      </div>
    </div>
  );
}