"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, CircleAlert, Compass, Database, ExternalLink, EyeOff, GitBranch, LoaderCircle, LogOut, MapPin, Plus, RefreshCw, Route, ShieldCheck, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { AuthDialog } from "@/components/auth-dialog";
import { CATEGORIES, type AuthUser, type CampusLocation } from "@/lib/types";

type LocationRecord = CampusLocation & { isActive: boolean };
type GraphNode = { id: string; label: string; longitude: number; latitude: number };
type GraphEdge = { id: string; fromNodeId: string; toNodeId: string; distanceMeters: number; coordinates: [number, number][]; instruction: string; isBidirectional: boolean };
type Analytics = { date: string; type: string; count: number }[];
type Tab = "locations" | "network" | "analytics";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold text-ink/70">{label}<span className="mt-1.5 block">{children}</span></label>;
}

const inputClass = "h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-xs outline-none focus:border-leaf";

export function AdminDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [tab, setTab] = useState<Tab>("locations");
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [showEdgeForm, setShowEdgeForm] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [locationResponse, graphResponse, analyticsResponse] = await Promise.all([
        fetch("/api/admin/locations", { cache: "no-store" }),
        fetch("/api/admin/graph", { cache: "no-store" }),
        fetch("/api/admin/analytics", { cache: "no-store" }),
      ]);
      if ([locationResponse, graphResponse, analyticsResponse].some((response) => response.status === 401 || response.status === 403)) {
        setUser(null);
        setShowAuth(true);
        setError("Sign in with an administrator account to access this dashboard.");
        return;
      }
      if (![locationResponse, graphResponse, analyticsResponse].every((response) => response.ok)) throw new Error("Dashboard data could not be loaded. Check the database connection and try again.");
      const [locationData, graphData, analyticsData] = await Promise.all([locationResponse.json(), graphResponse.json(), analyticsResponse.json()]) as [
        { locations: LocationRecord[] }, { nodes: GraphNode[]; edges: GraphEdge[] }, { analytics: Analytics },
      ];
      setLocations(locationData.locations);
      setNodes(graphData.nodes);
      setEdges(graphData.edges);
      setAnalytics(analyticsData.analytics);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Dashboard data could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { user: AuthUser | null };
      setUser(data.user);
      if (data.user?.role === "ADMIN") void refresh();
      else setShowAuth(true);
    }).catch(() => setError("Authentication service is unavailable.")).finally(() => setChecking(false));
  }, [refresh]);

  async function request(url: string, method: string, body?: unknown) {
    setNotice(""); setError("");
    try {
      const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The change could not be saved.");
      setNotice("Saved successfully.");
      await refresh();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The change could not be saved.");
      return false;
    }
  }

  async function submitLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const success = await request("/api/admin/locations", "POST", {
      name: values.get("name"), description: values.get("description"), category: values.get("category"),
      longitude: Number(values.get("longitude")), latitude: Number(values.get("latitude")), sourceUrl: values.get("sourceUrl"),
      routeNodeId: values.get("routeNodeId") || null,
    });
    if (success) { setShowLocationForm(false); event.currentTarget.reset(); }
  }

  async function submitNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const success = await request("/api/admin/graph", "POST", { kind: "node", label: values.get("label"), longitude: Number(values.get("longitude")), latitude: Number(values.get("latitude")) });
    if (success) { setShowNodeForm(false); event.currentTarget.reset(); }
  }

  async function submitEdge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    let coordinates: unknown;
    try { coordinates = JSON.parse(String(values.get("coordinates"))); } catch { setError("Path coordinates must be valid JSON, for example [[longitude, latitude], [longitude, latitude]]."); return; }
    const success = await request("/api/admin/graph", "POST", { kind: "edge", fromNodeId: values.get("fromNodeId"), toNodeId: values.get("toNodeId"), distanceMeters: Number(values.get("distanceMeters")), instruction: values.get("instruction"), coordinates, isBidirectional: values.get("isBidirectional") === "on" });
    if (success) { setShowEdgeForm(false); event.currentTarget.reset(); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null); setShowAuth(true);
  }

  const totals = useMemo(() => analytics.reduce((sum, item) => sum + item.count, 0), [analytics]);
  const pending = locations.filter((location) => !location.isVerified || !location.coordinatesVerified).length;
  const published = locations.filter((location) => location.isVerified && location.isActive).length;

  return <main className="min-h-screen bg-paper">
    <header className="flex h-[68px] items-center justify-between border-b border-ink/10 px-5 md:px-9"><Link href="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-leaf text-white"><Compass size={19} /></span><span className="font-display text-sm font-semibold">PPSU <span className="text-leaf">CAMPUS 3D</span></span></Link><div className="flex items-center gap-2"><Link href="/" className="flex items-center gap-1.5 rounded-md border border-ink/10 px-3 py-2 text-[11px] font-semibold"><ArrowLeft size={13} /> Explorer</Link>{user && <button onClick={() => void signOut()} className="grid h-9 w-9 place-items-center rounded-md border border-ink/10 text-ink/55 hover:text-coral" aria-label="Sign out"><LogOut size={15} /></button>}</div></header>
    <div className="mx-auto max-w-[1380px] px-4 py-7 md:px-9 md:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-leaf">Campus operations</p><h1 className="mt-1 font-display text-[30px] font-semibold">Admin dashboard</h1><p className="mt-1 text-xs text-ink/55">Review published map data and maintain the surveyed walking network.</p></div><button onClick={() => void refresh()} disabled={loading} className="flex h-9 items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-xs font-semibold hover:border-leaf disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh data</button></div>
      {error && <div role="alert" className="mt-5 flex items-center gap-2 rounded-md border border-coral/20 bg-coral/10 px-4 py-3 text-xs text-[#944937]"><CircleAlert size={15} />{error}</div>}
      {notice && <div role="status" className="mt-5 flex items-center gap-2 rounded-md border border-leaf/20 bg-[#eaf2eb] px-4 py-3 text-xs text-leaf"><Check size={15} />{notice}</div>}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary icon={MapPin} label="Published places" value={published} accent="leaf" /><Summary icon={EyeOff} label="Awaiting review" value={pending} accent="coral" /><Summary icon={GitBranch} label="Walk segments" value={edges.length} accent="sun" /><Summary icon={Users} label="Events · 30 days" value={totals} accent="ink" /></div>

      <div className="mt-7 border-b border-ink/10"><div className="flex gap-5 overflow-x-auto">{([{ id: "locations", label: "Locations", icon: MapPin }, { id: "network", label: "Walking network", icon: Route }, { id: "analytics", label: "Analytics", icon: Database }] as const).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-3 text-xs font-semibold ${tab === item.id ? "border-leaf text-leaf" : "border-transparent text-ink/50 hover:text-ink"}`}><item.icon size={14} />{item.label}</button>)}</div></div>

      {tab === "locations" && <section className="pt-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Campus locations</h2><p className="mt-1 text-[11px] text-ink/50">Official-source listings may be public before their surveyed map pins are verified. Only verified pins can appear on the map.</p></div><button onClick={() => setShowLocationForm((value) => !value)} className="flex h-9 items-center gap-1.5 rounded-md bg-leaf px-3 text-xs font-semibold text-white hover:bg-[#24573f]"><Plus size={14} /> Add location</button></div>
        {showLocationForm && <form onSubmit={submitLocation} className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-ink/10 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Place name"><input name="name" required minLength={2} maxLength={120} className={inputClass} /></Field><Field label="Category"><select name="category" className={inputClass}>{CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label="Longitude"><input name="longitude" type="number" step="any" min="-180" max="180" required className={inputClass} /></Field><Field label="Latitude"><input name="latitude" type="number" step="any" min="-90" max="90" required className={inputClass} /></Field><Field label="Official PPSU source URL"><input name="sourceUrl" type="url" required placeholder="https://www.ppsu.ac.in/..." className={inputClass} /></Field><Field label="Walking node (optional)"><select name="routeNodeId" className={inputClass}><option value="">No routing connection</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></Field><Field label="Description"><input name="description" maxLength={500} className={inputClass} /></Field><div className="flex items-end gap-2"><button className="h-10 flex-1 rounded-md bg-leaf text-xs font-semibold text-white">Save as draft</button><button type="button" onClick={() => setShowLocationForm(false)} className="h-10 rounded-md border border-ink/15 px-3 text-xs font-semibold">Cancel</button></div><p className="md:col-span-2 xl:col-span-4 text-[10px] leading-4 text-ink/45">Coordinate entry is for surveyed campus points only. New places are private drafts until reviewed and published.</p></form>}
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-white"><div className="hidden grid-cols-[minmax(180px,1.4fr)_110px_minmax(140px,1fr)_120px_130px] gap-3 border-b border-ink/10 bg-[#f4f5f1] px-4 py-2.5 text-[9px] font-bold uppercase tracking-[.12em] text-ink/45 md:grid"><span>Location</span><span>Category</span><span>Coordinates</span><span>Status</span><span className="text-right">Actions</span></div>
          {loading ? <div className="grid place-items-center p-10 text-xs text-ink/50"><LoaderCircle size={17} className="mb-2 animate-spin" />Loading campus data…</div> : locations.length ? <ul>{locations.map((location) => <li key={location.id} className="grid grid-cols-1 gap-2 border-b border-ink/5 px-4 py-3 last:border-0 md:grid-cols-[minmax(180px,1.4fr)_110px_minmax(140px,1fr)_120px_130px] md:items-center md:gap-3"><div className="min-w-0"><div className="truncate text-xs font-semibold">{location.name}</div><a href={location.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 truncate text-[10px] text-leaf">Source <ExternalLink size={10} /></a></div><span className="text-[10px] capitalize text-ink/55">{location.category}</span><span className="font-mono text-[10px] text-ink/55">{location.coordinatesVerified && location.latitude !== null && location.longitude !== null ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : "Needs survey"}</span><span className={`flex flex-col gap-1 text-[10px] font-semibold ${location.isVerified && location.isActive ? "text-leaf" : "text-coral"}`}>{location.isVerified && location.isActive ? <><BadgeCheck size={13} /> Public listing</> : <><EyeOff size={12} /> Draft</>}<span className="font-normal text-ink/45">{location.coordinatesVerified ? "Pin verified" : "Coordinates need verification"}</span></span><div className="flex items-center justify-end gap-1">{!location.isVerified && <button onClick={() => void request(`/api/admin/locations/${location.id}`, "PATCH", { isVerified: true })} className="rounded border border-leaf/20 px-2 py-1.5 text-[10px] font-semibold text-leaf hover:bg-[#eaf2eb]">Publish</button>}{!location.coordinatesVerified && location.latitude !== null && location.longitude !== null && <button onClick={() => void request(`/api/admin/locations/${location.id}`, "PATCH", { coordinatesVerified: true })} className="rounded border border-ink/15 px-2 py-1.5 text-[10px] font-semibold hover:border-leaf">Verify pin</button>}{location.isVerified && location.isActive && <button onClick={() => void request(`/api/admin/locations/${location.id}`, "PATCH", { isActive: false })} className="grid h-7 w-7 place-items-center rounded text-ink/45 hover:bg-ink/5" aria-label={`Unpublish ${location.name}`}><EyeOff size={13} /></button>}<button onClick={() => { if (window.confirm(`Delete ${location.name}?`)) void request(`/api/admin/locations/${location.id}`, "DELETE"); }} className="grid h-7 w-7 place-items-center rounded text-ink/40 hover:bg-coral/10 hover:text-coral" aria-label={`Delete ${location.name}`}><Trash2 size={13} /></button></div></li>)}</ul> : <Empty icon={MapPin} title="No campus locations yet" text="Add source-backed facilities; surveyed coordinates are required for a map pin." />}
        </div>
      </section>}

      {tab === "network" && <section className="pt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Verified walking network</h2><p className="mt-1 text-[11px] text-ink/50">Only surveyed nodes and measured paths are used by route search.</p></div><div className="flex gap-2"><button onClick={() => setShowNodeForm((value) => !value)} className="flex h-9 items-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 text-xs font-semibold"><Plus size={14} /> Node</button><button disabled={nodes.length < 2} onClick={() => setShowEdgeForm((value) => !value)} className="flex h-9 items-center gap-1.5 rounded-md bg-leaf px-3 text-xs font-semibold text-white disabled:opacity-40"><Plus size={14} /> Walk segment</button></div></div>
        {showNodeForm && <form onSubmit={submitNode} className="mb-4 grid gap-3 rounded-lg border border-ink/10 bg-white p-4 md:grid-cols-4"><Field label="Node label"><input name="label" required minLength={2} maxLength={120} className={inputClass} placeholder="Surveyed path junction" /></Field><Field label="Longitude"><input name="longitude" type="number" step="any" min="-180" max="180" required className={inputClass} /></Field><Field label="Latitude"><input name="latitude" type="number" step="any" min="-90" max="90" required className={inputClass} /></Field><div className="flex items-end gap-2"><button className="h-10 flex-1 rounded-md bg-leaf text-xs font-semibold text-white">Save node</button><button type="button" onClick={() => setShowNodeForm(false)} className="h-10 rounded-md border border-ink/15 px-3 text-xs">Cancel</button></div></form>}
        {showEdgeForm && <form onSubmit={submitEdge} className="mb-4 grid gap-3 rounded-lg border border-ink/10 bg-white p-4 md:grid-cols-3"><Field label="From node"><select name="fromNodeId" required className={inputClass}>{nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></Field><Field label="To node"><select name="toNodeId" required className={inputClass}>{nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></Field><Field label="Measured distance (m)"><input name="distanceMeters" type="number" min="0.1" max="10000" step="any" required className={inputClass} /></Field><Field label="Direction guidance"><input name="instruction" required minLength={3} maxLength={180} placeholder="Continue along the west walkway" className={inputClass} /></Field><Field label="Path coordinates (JSON)"><input name="coordinates" required placeholder="[[fromLng,fromLat],[toLng,toLat]]" className={inputClass} /></Field><label className="flex items-center gap-2 self-end pb-3 text-xs text-ink/70"><input name="isBidirectional" type="checkbox" defaultChecked className="accent-leaf" /> Walkable both ways</label><div className="flex gap-2 md:col-span-3"><button className="h-9 rounded-md bg-leaf px-4 text-xs font-semibold text-white">Save surveyed segment</button><button type="button" onClick={() => setShowEdgeForm(false)} className="h-9 rounded-md border border-ink/15 px-3 text-xs">Cancel</button></div><p className="md:col-span-3 text-[10px] leading-4 text-ink/45">Use a measured path from trusted campus survey data. Coordinates must start and end at the selected nodes.</p></form>}
        <div className="grid gap-4 lg:grid-cols-2"><section className="overflow-hidden rounded-lg border border-ink/10 bg-white"><div className="border-b border-ink/10 px-4 py-3"><h3 className="text-xs font-semibold">Path nodes <span className="ml-1 text-ink/40">{nodes.length}</span></h3></div>{nodes.length ? <ul className="max-h-[420px] divide-y divide-ink/5 overflow-y-auto">{nodes.map((node) => <li key={node.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8eee6] text-leaf"><MapPin size={13} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{node.label}</span><span className="mt-0.5 block font-mono text-[9px] text-ink/45">{node.longitude.toFixed(6)}, {node.latitude.toFixed(6)}</span></span><button onClick={() => { if (window.confirm(`Delete node ${node.label} and connected segments?`)) void request(`/api/admin/graph?kind=node&id=${node.id}`, "DELETE"); }} className="grid h-7 w-7 place-items-center rounded text-ink/40 hover:bg-coral/10 hover:text-coral" aria-label={`Delete node ${node.label}`}><Trash2 size={13} /></button></li>)}</ul> : <p className="p-4 text-[11px] text-ink/50">No surveyed route nodes have been entered.</p>}</section>
          <section className="overflow-hidden rounded-lg border border-ink/10 bg-white"><div className="border-b border-ink/10 px-4 py-3"><h3 className="text-xs font-semibold">Walk segments <span className="ml-1 text-ink/40">{edges.length}</span></h3></div>{edges.length ? <ul className="max-h-[420px] divide-y divide-ink/5 overflow-y-auto">{edges.map((edge) => <li key={edge.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f9eadf] text-coral"><Route size={13} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{nodes.find((node) => node.id === edge.fromNodeId)?.label ?? "Unknown"} → {nodes.find((node) => node.id === edge.toNodeId)?.label ?? "Unknown"}</span><span className="mt-0.5 block truncate text-[9px] text-ink/45">{edge.distanceMeters} m · {edge.instruction}</span></span><button onClick={() => { if (window.confirm("Delete this walking segment?")) void request(`/api/admin/graph?kind=edge&id=${edge.id}`, "DELETE"); }} className="grid h-7 w-7 place-items-center rounded text-ink/40 hover:bg-coral/10 hover:text-coral" aria-label="Delete walking segment"><Trash2 size={13} /></button></li>)}</ul> : <p className="p-4 text-[11px] text-ink/50">No surveyed walk segments have been entered.</p>}</section></div>
      </section>}

      {tab === "analytics" && <section className="pt-5"><div className="mb-4"><h2 className="text-sm font-semibold">Privacy-conscious usage</h2><p className="mt-1 text-[11px] text-ink/50">Daily totals only. No IP addresses, names, or individual browsing histories are stored.</p></div><div className="rounded-lg border border-ink/10 bg-white p-4 md:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/45">Last 30 days</p><p className="mt-1 font-display text-3xl font-semibold">{totals.toLocaleString()}</p><p className="text-[10px] text-ink/50">recorded actions</p></div><div className="flex gap-3 text-[9px] text-ink/50"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-leaf" />Searches</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-coral" />Routes</span></div></div><div className="mt-6 flex h-40 items-end gap-1 border-b border-ink/10">{analytics.slice().reverse().slice(-30).map((item) => { const height = Math.max(4, Math.min(100, item.count / Math.max(1, ...analytics.map((entry) => entry.count)) * 100)); return <div key={`${item.date}-${item.type}`} title={`${item.date}: ${item.count} ${item.type}`} className={`min-w-1 flex-1 rounded-t-sm ${item.type === "route" ? "bg-coral/80" : "bg-leaf/75"}`} style={{ height: `${height}%` }} />; })}</div><p className="mt-3 text-[10px] text-ink/45">{analytics.length ? "Counts are grouped by UTC day and event type." : "No analytics have been collected yet."}</p></div></section>}
      {checking && <div className="fixed inset-0 z-30 grid place-items-center bg-paper/75"><LoaderCircle className="animate-spin text-leaf" size={22} /><span className="sr-only">Checking access</span></div>}
      <div className="mt-8 flex items-start gap-2 border-t border-ink/10 pt-4 text-[10px] leading-4 text-ink/45"><ShieldCheck size={13} className="mt-0.5 shrink-0" /><p>Admin changes are recorded with an authenticated account. Verify every source and survey point before publishing. Browser-visible values must never include server credentials.</p></div>
    </div>
    <AuthDialog open={showAuth} user={user} onClose={() => { setShowAuth(false); if (!user) window.location.assign("/"); }} onAuth={(value) => { setUser(value); if (value?.role === "ADMIN") void refresh(); else if (value) { setError("This account does not have administrator access."); setShowAuth(false); } }} />
  </main>;
}

function Summary({ icon: Icon, label, value, accent }: { icon: typeof MapPin; label: string; value: number; accent: "leaf" | "coral" | "sun" | "ink" }) {
  const colors = { leaf: "bg-[#e8eee6] text-leaf", coral: "bg-[#f9e9e4] text-coral", sun: "bg-[#fbf1d5] text-[#947114]", ink: "bg-[#e9ece8] text-ink/65" };
  return <div className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${colors[accent]}`}><Icon size={16} /></span><span className="min-w-0"><span className="block font-display text-xl font-semibold">{value}</span><span className="block truncate text-[9px] leading-4 text-ink/50">{label}</span></span></div>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof MapPin; title: string; text: string }) {
  return <div className="grid justify-items-center px-5 py-12 text-center"><span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e8eee6] text-leaf"><Icon size={20} /></span><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-ink/50">{text}</p></div>;
}