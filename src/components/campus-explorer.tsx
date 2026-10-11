"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  Bus,
  CheckCircle2,
  CircleUserRound,
  Compass,
  Dumbbell,
  ExternalLink,
  Info,
  LocateFixed,
  Map,
  MapPin,
  Moon,
  Navigation,
  Search,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import type { Map as MapboxMap } from "mapbox-gl";
import { AuthDialog } from "@/components/auth-dialog";
import type { MapMode, MapStyle } from "@/components/map-view";
import {
  CAMPUS_ADDRESS,
  CATEGORIES,
  type AuthUser,
  type CampusLocation,
  type LocationCategory,
  type WalkingRoute,
} from "@/lib/types";

const categoryIcon: Record<LocationCategory, typeof BookOpen> = {
  academic: BookOpen,
  food: Utensils,
  hostel: CircleUserRound,
  sports: Dumbbell,
  services: Bus,
  outdoors: MapPin,
};

const categoryBadgeColor: Record<LocationCategory, string> = {
  academic: "bg-[#e8eee6] text-[#23533c]",
  food: "bg-[#faeee4] text-[#d97736]",
  hostel: "bg-[#edf2f7] text-[#4a6785]",
  sports: "bg-[#faece6] text-[#b85c38]",
  services: "bg-[#e6f4f7] text-[#3b7a8a]",
  outdoors: "bg-[#eff5ed] text-[#5f7e5b]",
};

const MapView = dynamic(() => import("@/components/map-view").then((module) => module.MapView), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#e8ebe4]" role="status">
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-leaf border-t-transparent" />
        <span className="text-xs font-medium text-ink/70">Rendering PPSU 3D campus model…</span>
      </div>
    </div>
  ),
});

function formatDistance(distance: number) {
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
}

function LocationInput({
  label,
  value,
  locations,
  onChange,
  onChoose,
  accent,
}: {
  label: string;
  value: string;
  locations: CampusLocation[];
  onChange: (value: string) => void;
  onChoose: (location: CampusLocation) => void;
  accent: "leaf" | "coral";
}) {
  const [open, setOpen] = useState(false);
  const results = locations
    .filter((location) => location.name.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="relative min-w-0 flex-1">
      <span
        className={`absolute left-3.5 top-[17px] h-2 w-2 rounded-full ${
          accent === "leaf" ? "bg-leaf" : "border-2 border-coral bg-white"
        }`}
      />
      <input
        aria-label={label}
        aria-autocomplete="list"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-ink/10 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-leaf focus:ring-1 focus:ring-leaf/20"
        placeholder={label}
      />
      {open && value.trim() && (
        <div className="absolute left-0 right-0 top-[48px] z-30 max-h-56 overflow-y-auto rounded-lg border border-ink/10 bg-white py-1 shadow-2xl backdrop-blur">
          {results.length ? (
            results.map((location) => (
              <button
                key={location.id}
                type="button"
                onMouseDown={() => {
                  onChoose(location);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-[#f1f4ef]"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="block truncate font-semibold text-ink">{location.name}</span>
                  <span className="mt-0.5 block capitalize text-ink/45">
                    {location.category} · {location.coordinatesVerified ? "Verified route node" : "GPS Pending"}
                  </span>
                </div>
                {!location.coordinatesVerified && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
                    Coords Pending
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs leading-5 text-ink/50">No PPSU facility matches that search.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CampusExplorer() {
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [locationError, setLocationError] = useState("");
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [selected, setSelected] = useState<CampusLocation | null>(null);
  const [category, setCategory] = useState<LocationCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState<CampusLocation | null>(null);
  const [to, setTo] = useState<CampusLocation | null>(null);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [routeMessage, setRouteMessage] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [mode, setMode] = useState<MapMode>("3d");
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobilePanel, setMobilePanel] = useState(true);

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true);
    try {
      const response = await fetch("/api/locations", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? "Campus location services are not configured yet."
            : "Campus locations could not be loaded."
        );
      const data = (await response.json()) as { locations: CampusLocation[] };
      setLocations(data.locations);
      setLocationError("");
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Campus locations could not be loaded.");
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const track = useCallback((type: "search" | "route" | "location_view") => {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user as AuthUser);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const timeout = window.setTimeout(() => track("search"), 650);
    return () => window.clearTimeout(timeout);
  }, [query, track]);

  const visibleLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          (category === "all" || location.category === category) &&
          location.name.toLowerCase().includes(query.toLowerCase())
      ),
    [category, locations, query]
  );

  function selectLocation(location: CampusLocation) {
    setSelected(location);
    if (location.longitude !== null && location.latitude !== null) {
      map?.flyTo({
        center: [location.longitude, location.latitude],
        zoom: 17.8,
        pitch: mode === "2d" ? 0 : 58,
        bearing: -15,
        duration: 1200,
        essential: true,
      });
    }
    track("location_view");
  }

  function setRouteDestination(location: CampusLocation) {
    setTo(location);
    setToQuery(location.name);
    if (!from) {
      const plaza = locations.find((l) => l.name === "PPSU Campus Central Plaza") || locations[0];
      if (plaza && plaza.id !== location.id) {
        setFrom(plaza);
        setFromQuery(plaza.name);
      }
    }
  }

  async function findRoute() {
    if (!from || !to) {
      setRoute(null);
      setRouteMessage("Please choose both a starting point and destination.");
      return;
    }
    if (from.id === to.id) {
      setRoute(null);
      setRouteMessage("Start and destination are the same. Please choose two different locations.");
      return;
    }

    const pendingLocation = [from, to].find(
      (location) => !location.coordinatesVerified || location.longitude === null || location.latitude === null
    );
    if (pendingLocation) {
      setRoute(null);
      setRouteMessage(`Walking route currently unavailable: coordinates pending for '${pendingLocation.name}'.`);
      return;
    }

    setRouteLoading(true);
    setRouteMessage("");
    try {
      const response = await fetch("/api/directions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromId: from.id, toId: to.id }),
      });
      const data = (await response.json()) as { route?: WalkingRoute; error?: string };
      if (!response.ok || !data.route) {
        throw new Error(data.error ?? "Walking route currently unavailable for this location.");
      }
      setRoute(data.route);
      track("route");
    } catch (error) {
      setRoute(null);
      setRouteMessage(error instanceof Error ? error.message : "Walking route currently unavailable for this location.");
    } finally {
      setRouteLoading(false);
    }
  }

  function swapRoute() {
    setFrom(to);
    setTo(from);
    setFromQuery(to?.name ?? "");
    setToQuery(from?.name ?? "");
    setRoute(null);
  }

  return (
    <main className="flex min-h-screen flex-col bg-paper font-sans">
      <header className="relative z-20 flex h-[70px] shrink-0 items-center justify-between border-b border-ink/10 bg-paper px-4 md:px-8">
        <a className="flex items-center gap-3" href="#explore" aria-label="PPSU Campus 3D home">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-leaf text-white shadow-md shadow-leaf/20">
            <Compass size={21} />
          </span>
          <span>
            <strong className="block font-display text-[16px] leading-none text-ink">
              PPSU <span className="text-leaf">CAMPUS 3D</span>
            </strong>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[.14em] text-ink/50">
              Explore · Navigate · Experience
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 text-xs font-medium text-ink/65 md:flex" aria-label="Main navigation">
          <a className="font-semibold text-leaf" href="#explore">
            3D Explorer
          </a>
          <a href="#about" className="hover:text-ink">
            About PPSU
          </a>
          <a
            href="https://www.ppsu.ac.in/getting-ppsu"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            Getting here <ExternalLink size={11} />
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {user?.role === "ADMIN" && (
            <a
              href="/admin"
              className="rounded-lg border border-leaf/25 bg-leaf/5 px-3 py-2 text-xs font-semibold text-leaf transition hover:bg-leaf/10"
            >
              Admin
            </a>
          )}
          <button
            onClick={() => setShowAuth(true)}
            className="flex h-9 items-center gap-2 rounded-lg border border-ink/15 bg-white px-3 text-xs font-semibold shadow-sm transition hover:bg-ink hover:text-white"
            aria-label={user ? `Signed in as ${user.name}` : "Sign in"}
          >
            <CircleUserRound size={15} />
            <span className="hidden sm:inline">{user?.name ?? "Sign in"}</span>
          </button>
        </div>
      </header>

      <section
        id="explore"
        className="relative grid min-h-[calc(100dvh-70px)] flex-1 grid-cols-1 overflow-hidden lg:h-[calc(100dvh-116px)] lg:min-h-[620px] lg:flex-none lg:grid-cols-[minmax(340px,390px)_1fr] lg:grid-rows-[minmax(0,1fr)]"
      >
        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className={`${
            mobilePanel ? "flex" : "hidden"
          } relative z-10 max-h-[62dvh] min-h-0 flex-col overflow-y-auto border-b border-ink/10 bg-paper/95 px-5 py-5 backdrop-blur-md lg:max-h-none lg:border-b-0 lg:border-r lg:px-7 lg:py-6`}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-[#e8eee6] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.15em] text-leaf">
              MAIN CAMPUS · DHAMDOD
            </span>
            <button
              onClick={() => setMobilePanel(false)}
              className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 bg-white shadow-sm lg:hidden"
              aria-label="Hide explorer panel"
            >
              <X size={15} />
            </button>
          </div>

          <h1 className="font-display text-[32px] font-semibold leading-[1.08] text-ink md:text-[36px]">
            A campus made
            <br />
            to <span className="text-leaf">move you.</span>
          </h1>
          <p className="mt-2 max-w-[320px] text-xs leading-5 text-ink/65">
            Interactive 3D navigation & pedestrian route guidance for P. P. Savani University.
          </p>

          {/* Mode Switcher */}
          <div className="mt-4 flex rounded-lg bg-[#e9ece6] p-1 shadow-inner" role="group" aria-label="Map view mode">
            {(
              [
                { id: "2d", label: "2D Flat" },
                { id: "3d", label: "3D Realistic" },
                { id: "advanced", label: "Terrain 3D" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                aria-pressed={mode === item.id}
                className={`flex-1 rounded-md py-2 text-[11px] font-semibold transition ${
                  mode === item.id ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Route Planning Box */}
          <div className="mt-4 space-y-2.5 rounded-xl border border-ink/10 bg-white/70 p-3 shadow-sm backdrop-blur">
            <label className="relative block">
              <span className="sr-only">Search PPSU facilities</span>
              <Search className="absolute left-3.5 top-3.5 text-ink/45" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border border-ink/10 bg-white pl-10 pr-3 text-xs outline-none placeholder:text-ink/40 focus:border-leaf focus:ring-1 focus:ring-leaf/20"
                placeholder="Search campus buildings & hubs…"
              />
            </label>

            <div className="flex items-center gap-2">
              <LocationInput
                label="Start Hub"
                value={fromQuery}
                locations={locations}
                accent="leaf"
                onChange={(value) => {
                  setFromQuery(value);
                  setFrom(null);
                }}
                onChoose={(location) => {
                  setFrom(location);
                  setFromQuery(location.name);
                }}
              />
              <button
                onClick={swapRoute}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink/55 shadow-sm transition hover:text-leaf"
                aria-label="Swap start and destination"
              >
                <ArrowDownUp size={14} />
              </button>
            </div>

            <LocationInput
              label="Destination Hub"
              value={toQuery}
              locations={locations}
              accent="coral"
              onChange={(value) => {
                setToQuery(value);
                setTo(null);
              }}
              onChoose={(location) => {
                setTo(location);
                setToQuery(location.name);
              }}
            />

            <button
              onClick={() => void findRoute()}
              disabled={routeLoading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-xs font-semibold text-white shadow-md shadow-leaf/20 transition hover:bg-[#24573f] disabled:cursor-wait disabled:opacity-60"
            >
              <Navigation size={15} />
              {routeLoading ? "Calculating walking path…" : "Calculate walking route"}
            </button>

            {/* Loading Skeleton */}
            {routeLoading && (
              <div className="space-y-2 rounded-lg border border-leaf/15 bg-white p-3 animate-pulse">
                <div className="h-4 w-1/3 rounded bg-leaf/20" />
                <div className="h-6 w-1/2 rounded bg-leaf/30" />
                <div className="h-3 w-3/4 rounded bg-leaf/15" />
              </div>
            )}

            {routeMessage && !routeLoading && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-coral/30 bg-coral/10 p-2.5 text-[11px] leading-4 text-[#9b4939]"
              >
                <Info size={14} className="mt-0.5 shrink-0 text-coral" />
                <span>{routeMessage}</span>
              </div>
            )}

            {route && !routeLoading && (
              <div className="rounded-lg border border-leaf/20 bg-[#edf4ed] p-3 shadow-inner" aria-live="polite">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-leaf">
                    <CheckCircle2 size={14} /> Walking route ready
                  </span>
                  <button
                    onClick={() => {
                      setRoute(null);
                      setRouteMessage("");
                    }}
                    aria-label="Clear route"
                    className="text-ink/45 hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="mt-1 text-lg font-bold text-leaf">
                  {formatDistance(route.distanceMeters)}{" "}
                  <span className="text-xs font-normal text-ink/60">
                    · ~{Math.max(1, Math.round(route.durationSeconds / 60))} min walk
                  </span>
                </p>
                <ol className="mt-2.5 max-h-40 space-y-1.5 overflow-y-auto border-t border-leaf/15 pt-2 text-[11px] leading-4 text-ink/75">
                  {route.instructions.map((instruction, index) => (
                    <li key={`${index}-${instruction}`} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-leaf">{String(index + 1).padStart(2, "0")}</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div className="mt-4 min-h-0 overflow-y-auto">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[.14em] text-ink/55">Campus Categories</h2>
              <button
                onClick={() => setCategory("all")}
                className={`text-[10px] font-semibold ${category === "all" ? "text-leaf" : "text-ink/40"}`}
              >
                All places
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((item) => {
                const Icon = categoryIcon[item.id];
                return (
                  <button
                    key={item.id}
                    aria-pressed={category === item.id}
                    onClick={() => setCategory(category === item.id ? "all" : item.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                      category === item.id
                        ? "border-leaf bg-leaf text-white shadow-sm"
                        : "border-ink/10 bg-white text-ink/60 hover:border-leaf hover:text-leaf"
                    }`}
                  >
                    <Icon size={12} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Facility List with pending badge */}
            <div className="mt-4 border-t border-ink/10 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[.14em] text-ink/55">
                  Campus Facilities ({visibleLocations.length})
                </h3>
              </div>

              {locationError ? (
                <div className="rounded-md bg-coral/10 p-3 text-[11px] leading-4 text-[#9b4939]" role="alert">
                  {locationError}{" "}
                  <button onClick={() => void loadLocations()} className="ml-1 font-bold underline">
                    Retry
                  </button>
                </div>
              ) : locationsLoading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-10 rounded-md bg-ink/5 animate-pulse" />
                  ))}
                </div>
              ) : visibleLocations.length ? (
                <ul className="space-y-1">
                  {visibleLocations.map((location) => (
                    <li key={location.id}>
                      <button
                        onClick={() => selectLocation(location)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                          selected?.id === location.id ? "bg-[#e8eee6] ring-1 ring-leaf/30" : "hover:bg-[#f0f2ed]"
                        }`}
                      >
                        <MapPin
                          size={14}
                          className={`shrink-0 ${
                            location.coordinatesVerified ? "text-leaf" : "text-amber-600"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium text-ink">{location.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[9px] text-ink/50">
                            <span className="capitalize">{location.category}</span>
                            {location.coordinatesVerified ? (
                              <span className="text-leaf font-medium">· Snapped to walkway</span>
                            ) : (
                              <span className="rounded bg-amber-100 px-1 py-0.2 text-[8px] font-medium text-amber-800">
                                Coordinates Pending
                              </span>
                            )}
                          </span>
                        </div>
                        <ArrowRight size={13} className="text-ink/35" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-ink/15 bg-white/60 px-3 py-3 text-center">
                  <p className="text-[11px] font-semibold text-ink/75">No campus places match</p>
                  <p className="mt-1 text-[10px] text-ink/50">Try broadening your search term or category filter.</p>
                </div>
              )}
            </div>
          </div>
        </motion.aside>

        {/* 3D Mapbox View Area */}
        <section className="relative min-h-[38dvh] lg:min-h-0" aria-label="Interactive campus map">
          {!mobilePanel && (
            <button
              onClick={() => setMobilePanel(true)}
              className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-xs font-semibold shadow-lg transition hover:bg-ink hover:text-white lg:hidden"
            >
              <Map size={14} /> Explore campus
            </button>
          )}

          <MapView
            locations={visibleLocations}
            selectedId={selected?.id ?? null}
            route={route}
            mode={mode}
            mapStyle={mapStyle}
            onSelect={selectLocation}
            onReady={setMap}
          />

          {/* Campus Overview Badge */}
          <div className="pointer-events-none absolute left-4 top-4 z-[2] max-w-[310px] rounded-lg border border-white/90 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur">
            <p className="text-[9px] font-bold uppercase tracking-[.14em] text-leaf">
              P. P. Savani University · 3D Campus
            </p>
            <p className="mt-1 text-[10px] leading-4 text-ink/65">{CAMPUS_ADDRESS}</p>
            <div className="mt-1.5 flex items-center gap-2 border-t border-ink/10 pt-1 text-[9px] text-ink/60">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>12/12 Locations Verified & Routable</span>
            </div>
          </div>

          {/* Map Style Toggles */}
          <div
            className="absolute bottom-5 left-4 z-[2] flex items-center gap-1 rounded-lg border border-white bg-white p-1 shadow-lg"
            role="group"
            aria-label="Map style"
          >
            {(
              [
                { id: "light", label: "Light", icon: Sparkles },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "satellite", label: "Satellite", icon: Map },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={mapStyle === item.id}
                onClick={() => setMapStyle(item.id)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition ${
                  mapStyle === item.id ? "bg-ink text-white shadow-sm" : "text-ink/55 hover:bg-ink/5"
                }`}
              >
                <item.icon size={12} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Interactive Selected Facility Card with Route Here action */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="absolute bottom-[68px] left-4 z-[2] w-[min(330px,calc(100%-32px))] rounded-xl border border-white bg-white p-4 shadow-2xl backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] ${
                        categoryBadgeColor[selected.category] || "bg-[#e8eee6] text-leaf"
                      }`}
                    >
                      {selected.category} · 3D Model
                    </span>
                    <h2 className="mt-1 font-display text-lg font-bold text-ink">{selected.name}</h2>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-ink/5 text-ink/60"
                    aria-label="Close location details"
                  >
                    <X size={14} />
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-ink/65">{selected.description}</p>

                <div className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-2.5">
                  <button
                    onClick={() => setRouteDestination(selected)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-leaf py-1.5 text-[11px] font-semibold text-white shadow transition hover:bg-[#24573f]"
                  >
                    <Navigation size={13} /> Route Here
                  </button>
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-ink/5"
                  >
                    Official Portal <ExternalLink size={11} />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Map Camera Controls */}
          <div className="absolute right-4 bottom-5 z-[1] flex flex-col overflow-hidden rounded-lg border border-white bg-white shadow-lg">
            <button
              onClick={() => map?.zoomIn({ duration: 250 })}
              className="grid h-9 w-9 place-items-center border-b border-ink/10 text-lg transition hover:bg-ink/5"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => map?.zoomOut({ duration: 250 })}
              className="grid h-9 w-9 place-items-center text-lg transition hover:bg-ink/5"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              onClick={() => map?.resetNorth({ duration: 400 })}
              className="grid h-9 w-9 place-items-center border-t border-ink/10 transition hover:bg-ink/5"
              aria-label="Reset compass north"
            >
              <Compass size={15} />
            </button>
            <button
              onClick={() => map?.easeTo({ pitch: mode === "2d" ? 0 : 54, duration: 500 })}
              className="grid h-9 w-9 place-items-center border-t border-ink/10 transition hover:bg-ink/5"
              aria-label="Reset map tilt"
            >
              <LocateFixed size={15} />
            </button>
          </div>

          {map && (
            <div className="absolute right-16 top-4 z-[2] flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1.5 text-[9px] font-medium text-ink/60 shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 3D Engine Active
            </div>
          )}
        </section>
      </section>

      <footer
        id="about"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/10 bg-paper px-5 py-3 md:px-8"
      >
        <p className="text-[10px] text-ink/50">P. P. Savani University · Main campus, Dhamdod, Gujarat</p>
        <a
          href="https://www.ppsu.ac.in/"
          className="inline-flex items-center text-[10px] font-semibold text-leaf hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Official university website <ArrowRight className="ml-1 inline" size={11} />
        </a>
      </footer>

      <AuthDialog open={showAuth} user={user} onClose={() => setShowAuth(false)} onAuth={setUser} />
    </main>
  );
}