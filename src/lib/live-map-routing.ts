export type RoutePoint = { x: number; z: number };

export type WalkPath = { points: RoutePoint[] };

export type CalculatedRoute = {
  points: RoutePoint[];
  distanceMeters: number;
};

type Segment = {
  start: RoutePoint;
  end: RoutePoint;
};

type Edge = { to: number; distance: number };

const EPSILON = 1e-7;
const JOIN_TOLERANCE_METERS = 0.08;

function distance(a: RoutePoint, b: RoutePoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function projectPointToSegment(point: RoutePoint, segment: Segment) {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= EPSILON) {
    return { point: segment.start, distance: distance(point, segment.start) };
  }

  const raw =
    ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) /
    lengthSquared;
  const t = Math.max(0, Math.min(1, raw));
  const projected = {
    x: segment.start.x + dx * t,
    z: segment.start.z + dz * t,
  };
  return { point: projected, distance: distance(point, projected) };
}

function pointOnSegment(point: RoutePoint, segment: Segment) {
  const projection = projectPointToSegment(point, segment);
  return projection.distance <= JOIN_TOLERANCE_METERS;
}

function parameterOnSegment(point: RoutePoint, segment: Segment) {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= EPSILON) return 0;
  return (
    ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) /
    lengthSquared
  );
}

function segmentIntersection(a: Segment, b: Segment): RoutePoint | null {
  const r = { x: a.end.x - a.start.x, z: a.end.z - a.start.z };
  const s = { x: b.end.x - b.start.x, z: b.end.z - b.start.z };
  const cross = r.x * s.z - r.z * s.x;
  if (Math.abs(cross) <= EPSILON) return null;

  const offset = { x: b.start.x - a.start.x, z: b.start.z - a.start.z };
  const t = (offset.x * s.z - offset.z * s.x) / cross;
  const u = (offset.x * r.z - offset.z * r.x) / cross;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null;
  }

  return {
    x: a.start.x + t * r.x,
    z: a.start.z + t * r.z,
  };
}

function buildSegments(paths: WalkPath[]) {
  return paths.flatMap((path) =>
    path.points.slice(0, -1).flatMap((point, index) => {
      const next = path.points[index + 1];
      if (!next || distance(point, next) <= EPSILON) return [];
      return [{ start: point, end: next }];
    }),
  );
}

function closestProjection(point: RoutePoint, segments: Segment[]) {
  let best: { point: RoutePoint; distance: number } | null = null;
  for (const segment of segments) {
    const projection = projectPointToSegment(point, segment);
    if (!best || projection.distance < best.distance) best = projection;
  }
  return best;
}

function simplifyRoute(points: RoutePoint[]) {
  const deduplicated = points.filter(
    (point, index) =>
      index === 0 || distance(point, points[index - 1]!) > EPSILON,
  );
  if (deduplicated.length <= 2) return deduplicated;

  return deduplicated.filter((point, index) => {
    if (index === 0 || index === deduplicated.length - 1) return true;
    const previous = deduplicated[index - 1]!;
    const next = deduplicated[index + 1]!;
    const cross =
      (point.x - previous.x) * (next.z - point.z) -
      (point.z - previous.z) * (next.x - point.x);
    return Math.abs(cross) > EPSILON;
  });
}

export function calculateWalkRoute(
  paths: WalkPath[],
  start: RoutePoint,
  target: RoutePoint,
): CalculatedRoute | null {
  const segments = buildSegments(paths);
  if (segments.length === 0) return null;

  const startProjection = closestProjection(start, segments);
  const targetProjection = closestProjection(target, segments);
  if (!startProjection || !targetProjection) return null;

  const splitPoints: RoutePoint[] = [
    ...segments.flatMap((segment) => [segment.start, segment.end]),
    startProjection.point,
    targetProjection.point,
  ];

  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      const intersection = segmentIntersection(
        segments[first]!,
        segments[second]!,
      );
      if (intersection) splitPoints.push(intersection);
    }
  }

  const nodes: RoutePoint[] = [];
  const adjacency: Edge[][] = [];

  function nodeId(point: RoutePoint) {
    const existing = nodes.findIndex(
      (node) => distance(node, point) <= JOIN_TOLERANCE_METERS,
    );
    if (existing >= 0) return existing;
    nodes.push(point);
    adjacency.push([]);
    return nodes.length - 1;
  }

  function addEdge(from: number, to: number) {
    if (from === to) return;
    const edgeDistance = distance(nodes[from]!, nodes[to]!);
    if (edgeDistance <= EPSILON) return;
    if (!adjacency[from]!.some((edge) => edge.to === to)) {
      adjacency[from]!.push({ to, distance: edgeDistance });
    }
    if (!adjacency[to]!.some((edge) => edge.to === from)) {
      adjacency[to]!.push({ to: from, distance: edgeDistance });
    }
  }

  for (const segment of segments) {
    const points = splitPoints
      .filter((point) => pointOnSegment(point, segment))
      .sort(
        (first, second) =>
          parameterOnSegment(first, segment) -
          parameterOnSegment(second, segment),
      );
    for (let index = 0; index < points.length - 1; index += 1) {
      addEdge(nodeId(points[index]!), nodeId(points[index + 1]!));
    }
  }

  const startProjectionId = nodeId(startProjection.point);
  const targetProjectionId = nodeId(targetProjection.point);
  const startId = nodeId(start);
  const targetId = nodeId(target);
  addEdge(startId, startProjectionId);
  addEdge(targetProjectionId, targetId);

  const costs = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = nodes.map(() => false);
  costs[startId] = 0;

  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let current = -1;
    for (let node = 0; node < nodes.length; node += 1) {
      if (!visited[node] && (current < 0 || costs[node]! < costs[current]!)) {
        current = node;
      }
    }
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === targetId) break;
    visited[current] = true;

    for (const edge of adjacency[current]!) {
      const nextCost = costs[current]! + edge.distance;
      if (nextCost < costs[edge.to]!) {
        costs[edge.to] = nextCost;
        previous[edge.to] = current;
      }
    }
  }

  if (!Number.isFinite(costs[targetId])) return null;

  const routeNodeIds: number[] = [];
  for (let current = targetId; current >= 0; current = previous[current]!) {
    routeNodeIds.push(current);
    if (current === startId) break;
  }
  if (routeNodeIds.at(-1) !== startId) return null;
  routeNodeIds.reverse();

  return {
    points: simplifyRoute(routeNodeIds.map((id) => nodes[id]!)),
    distanceMeters: costs[targetId]!,
  };
}
