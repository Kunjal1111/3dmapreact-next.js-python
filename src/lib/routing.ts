export type RouteNode = { id: string; label: string; longitude: number; latitude: number };
export type RouteEdge = {
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  coordinates: [number, number][];
  instruction: string;
  isBidirectional: boolean;
};
export type RouteResult = { distanceMeters: number; durationSeconds: number; coordinates: [number, number][]; instructions: string[] };

export function findShortestWalkingRoute(nodes: RouteNode[], edges: RouteEdge[], startId: string, endId: string): RouteResult | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (!nodeById.has(startId) || !nodeById.has(endId)) return null;
  if (startId === endId) return { distanceMeters: 0, durationSeconds: 0, coordinates: [[nodeById.get(startId)!.longitude, nodeById.get(startId)!.latitude]], instructions: [] };

  const adjacency = new Map<string, { edge: RouteEdge; reverse: boolean; next: string }[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (!adjacency.has(edge.fromNodeId) || !adjacency.has(edge.toNodeId) || edge.distanceMeters <= 0 || edge.coordinates.length < 2) continue;
    adjacency.get(edge.fromNodeId)!.push({ edge, reverse: false, next: edge.toNodeId });
    if (edge.isBidirectional) adjacency.get(edge.toNodeId)!.push({ edge, reverse: true, next: edge.fromNodeId });
  }

  const distances = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: RouteEdge; reverse: boolean }>();
  const pending = new Set(nodes.map((node) => node.id));

  while (pending.size) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of pending) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) { currentDistance = distance; currentId = nodeId; }
    }
    if (currentId === null || !Number.isFinite(currentDistance)) break;
    pending.delete(currentId);
    if (currentId === endId) break;
    for (const connection of adjacency.get(currentId) ?? []) {
      if (!pending.has(connection.next)) continue;
      const candidate = currentDistance + connection.edge.distanceMeters;
      if (candidate < (distances.get(connection.next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(connection.next, candidate);
        previous.set(connection.next, { nodeId: currentId, edge: connection.edge, reverse: connection.reverse });
      }
    }
  }

  const totalDistance = distances.get(endId);
  if (totalDistance === undefined) return null;
  const path: { fromNodeId: string; toNodeId: string; edge: RouteEdge; reverse: boolean }[] = [];
  let cursor = endId;
  while (cursor !== startId) {
    const step = previous.get(cursor);
    if (!step) return null;
    path.push({ fromNodeId: step.nodeId, toNodeId: cursor, edge: step.edge, reverse: step.reverse });
    cursor = step.nodeId;
  }
  path.reverse();

  const coordinates: [number, number][] = [];
  const instructions: string[] = [];
  for (const step of path) {
    const edgeCoordinates = step.reverse ? [...step.edge.coordinates].reverse() : step.edge.coordinates;
    coordinates.push(...(coordinates.length ? edgeCoordinates.slice(1) : edgeCoordinates));
    instructions.push(step.reverse ? `Continue along the verified path toward ${nodeById.get(step.toNodeId)?.label ?? "your destination"}.` : step.edge.instruction);
  }
  return { distanceMeters: totalDistance, durationSeconds: Math.ceil(totalDistance / 1.25), coordinates, instructions };
}