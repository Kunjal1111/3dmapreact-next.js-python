import assert from "node:assert/strict";
import test from "node:test";
import { findShortestWalkingRoute, type RouteEdge, type RouteNode } from "@/lib/routing";

const nodes: RouteNode[] = [
  { id: "a", label: "Gate", longitude: 72, latitude: 21 },
  { id: "b", label: "Junction", longitude: 72.001, latitude: 21 },
  { id: "c", label: "Library", longitude: 72.002, latitude: 21 },
  { id: "d", label: "Auditorium", longitude: 72.003, latitude: 21 },
];

function edge(fromNodeId: string, toNodeId: string, distanceMeters: number, isBidirectional = true): RouteEdge {
  const from = nodes.find((node) => node.id === fromNodeId)!;
  const to = nodes.find((node) => node.id === toNodeId)!;
  return { fromNodeId, toNodeId, distanceMeters, coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]], instruction: `Walk from ${from.label} to ${to.label}.`, isBidirectional };
}

test("chooses the lowest-distance path, not the fewest edges", () => {
  const route = findShortestWalkingRoute(nodes, [edge("a", "c", 120), edge("a", "b", 25), edge("b", "c", 30)], "a", "c");
  assert.equal(route?.distanceMeters, 55);
  assert.deepEqual(route?.instructions, ["Walk from Gate to Junction.", "Walk from Junction to Library."]);
});

test("respects one-way walk segments", () => {
  assert.equal(findShortestWalkingRoute(nodes, [edge("a", "b", 20, false)], "b", "a"), null);
  assert.equal(findShortestWalkingRoute(nodes, [edge("a", "b", 20, false)], "a", "b")?.distanceMeters, 20);
});

test("reverses route geometry and guidance for a bidirectional segment", () => {
  const route = findShortestWalkingRoute(nodes, [edge("a", "b", 20)], "b", "a");
  assert.equal(route?.instructions[0], "Continue along the verified path toward Gate.");
  assert.deepEqual(route?.coordinates, [[72.001, 21], [72, 21]]);
});

test("returns null for disconnected nodes", () => {
  assert.equal(findShortestWalkingRoute(nodes, [edge("a", "b", 20)], "a", "d"), null);
});