"use client";

import { useState } from "react";

import {
  createInventoryNavigationLocationAction,
  createNavigationAnchorAction,
  createNavigationPathAction,
  createNavigationRestrictedAreaAction,
  deleteNavigationFeatureAction,
  saveNavigationBoundaryAction,
  updateInventoryNavigationLocationAction,
  updateNavigationAnchorAction,
  updateNavigationFloorAction,
  updateNavigationPathAction,
  updateNavigationRestrictedAreaAction,
} from "@/app/admin/live-map/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { validateLiveMap } from "@/lib/live-map-validation";
import type { LiveMapData, MapPoint } from "@/services/live-map.service";

type Tool =
  | "select"
  | "boundary"
  | "path"
  | "restricted"
  | "anchor"
  | "product";

type SelectedFeature =
  | { type: "boundary" }
  | { type: "path"; id: string }
  | { type: "restrictedArea"; id: string }
  | { type: "anchor"; id: string }
  | { type: "location"; id: string };

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function formatCoordinate(value: number) {
  return value.toFixed(2);
}

function pointsToSvg(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.z}`).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ToolButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function LiveMapEditor({ data }: { data: LiveMapData }) {
  if (!data.floor) return null;
  return <LiveMapEditorContent data={data} floor={data.floor} />;
}

function LiveMapEditorContent({
  data,
  floor,
}: {
  data: LiveMapData;
  floor: NonNullable<LiveMapData["floor"]>;
}) {
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<MapPoint[]>([]);
  const [candidate, setCandidate] = useState<MapPoint | null>(null);
  const [anchorStart, setAnchorStart] = useState<{
    x: string;
    z: string;
  } | null>(null);
  const [selection, setSelection] = useState<SelectedFeature | null>(null);
  const [editPoints, setEditPoints] = useState<MapPoint[]>([]);
  const [editPosition, setEditPosition] = useState<MapPoint | null>(null);
  const [editAnchorStart, setEditAnchorStart] = useState<MapPoint | null>(null);
  const boundary = floor.boundary;
  const readinessIssues = validateLiveMap({
    boundary,
    paths: data.paths,
    anchors: data.anchors,
    locations: data.locations,
  });
  const readinessErrors = readinessIssues.filter(
    (issue) => issue.severity === "error",
  );

  function chooseTool(nextTool: Tool) {
    setTool(nextTool);
    setSelection(null);
    setEditPoints([]);
    setEditPosition(null);
    setEditAnchorStart(null);
    setCandidate(null);
    setAnchorStart(null);
    setDraft(nextTool === "boundary" ? floor.boundary : []);
  }

  function selectBoundary() {
    setTool("select");
    setSelection({ type: "boundary" });
    setEditPoints(boundary);
    setEditPosition(null);
    setEditAnchorStart(null);
    setCandidate(null);
    setDraft([]);
  }

  function selectPath(path: LiveMapData["paths"][number]) {
    setTool("select");
    setSelection({ type: "path", id: path.id });
    setEditPoints(path.points);
    setEditPosition(null);
    setEditAnchorStart(null);
    setCandidate(null);
    setDraft([]);
  }

  function selectRestrictedArea(area: LiveMapData["restrictedAreas"][number]) {
    setTool("select");
    setSelection({ type: "restrictedArea", id: area.id });
    setEditPoints(area.polygon);
    setEditPosition(null);
    setEditAnchorStart(null);
    setCandidate(null);
    setDraft([]);
  }

  function selectAnchor(anchor: LiveMapData["anchors"][number]) {
    setTool("select");
    setSelection({ type: "anchor", id: anchor.id });
    setEditPoints([]);
    setEditPosition({ x: anchor.x, z: anchor.z });
    setEditAnchorStart({ x: anchor.startX, z: anchor.startZ });
    setCandidate(null);
    setDraft([]);
  }

  function selectLocation(location: LiveMapData["locations"][number]) {
    setTool("select");
    setSelection({ type: "location", id: location.id });
    setEditPoints([]);
    setEditPosition({ x: location.x, z: location.z });
    setEditAnchorStart(null);
    setCandidate(null);
    setDraft([]);
  }

  function clearSelection() {
    setSelection(null);
    setEditPoints([]);
    setEditPosition(null);
    setEditAnchorStart(null);
  }

  function readCanvasPoint(event: React.MouseEvent<SVGSVGElement>): MapPoint {
    const svg = event.currentTarget;
    const screenMatrix = svg.getScreenCTM();

    if (screenMatrix) {
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = event.clientX;
      screenPoint.y = event.clientY;
      const mapPoint = screenPoint.matrixTransform(screenMatrix.inverse());

      return {
        x: clamp(mapPoint.x, 0, floor.widthMeters),
        z: clamp(mapPoint.y, 0, floor.lengthMeters),
      };
    }

    const bounds = svg.getBoundingClientRect();
    return {
      x: clamp(
        ((event.clientX - bounds.left) / bounds.width) * floor.widthMeters,
        0,
        floor.widthMeters,
      ),
      z: clamp(
        ((event.clientY - bounds.top) / bounds.height) * floor.lengthMeters,
        0,
        floor.lengthMeters,
      ),
    };
  }

  function addCanvasPoint(event: React.MouseEvent<SVGSVGElement>) {
    if (tool === "select") return;
    const point = readCanvasPoint(event);
    if (tool === "anchor") {
      setCandidate(point);
      setAnchorStart({
        x: formatCoordinate(point.x),
        z: formatCoordinate(point.z),
      });
      return;
    }
    if (tool === "product") {
      setCandidate(point);
      return;
    }
    setDraft((points) => [...points, point]);
  }

  const gridStep = floor.widthMeters > 30 || floor.lengthMeters > 30 ? 5 : 1;
  const verticalGrid = Array.from(
    { length: Math.floor(floor.widthMeters / gridStep) + 1 },
    (_, index) => index * gridStep,
  );
  const horizontalGrid = Array.from(
    { length: Math.floor(floor.lengthMeters / gridStep) + 1 },
    (_, index) => index * gridStep,
  );
  const draftIsPolygon = tool === "boundary" || tool === "restricted";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Live Map — {floor.name}</CardTitle>
          <CardDescription>
            Draw in metres. This map is independent from inventory QR and IoT
            shelf configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={updateNavigationFloorAction}
            className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end"
          >
            <input type="hidden" name="floorId" value={floor.id} />
            <label className="grid gap-1 text-sm font-medium">
              Floor name
              <input
                className={inputClass}
                name="name"
                defaultValue={floor.name}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Width (m)
              <input
                className={inputClass}
                name="widthMeters"
                type="number"
                min="1"
                step="0.1"
                defaultValue={floor.widthMeters}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Length (m)
              <input
                className={inputClass}
                name="lengthMeters"
                type="number"
                min="1"
                step="0.1"
                defaultValue={floor.lengthMeters}
                required
              />
            </label>
            <Button type="submit" variant="outline">
              Save size
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card
        className={
          readinessErrors.length === 0
            ? "border-green-500/40"
            : "border-amber-500/50"
        }
      >
        <CardHeader>
          <CardTitle className="text-base">
            {readinessErrors.length === 0
              ? "Map ready for navigation"
              : "Map needs attention"}
          </CardTitle>
          <CardDescription>
            {readinessErrors.length === 0
              ? "Boundary, QR Anchor, Walk path และตำแหน่งสินค้าพร้อมคำนวณเส้นทาง"
              : "แก้รายการด้านล่างก่อนนำ QR ไปให้ลูกค้าใช้งาน"}
          </CardDescription>
        </CardHeader>
        {readinessIssues.length > 0 && (
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {readinessIssues.map((issue) => (
                <li
                  key={issue.code}
                  className={
                    issue.severity === "error"
                      ? "text-destructive"
                      : "text-amber-700 dark:text-amber-300"
                  }
                >
                  {issue.severity === "error" ? "Error" : "Warning"}:{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Floor canvas</CardTitle>
            <CardDescription>
              Use Select to click and update existing objects. Drawing tools
              create new objects. Grey is the boundary, red is not walkable, and
              blue is a customer path.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              <ToolButton
                active={tool === "select"}
                onClick={() => chooseTool("select")}
              >
                Select
              </ToolButton>
              <ToolButton
                active={tool === "boundary"}
                onClick={() => chooseTool("boundary")}
              >
                Draw boundary
              </ToolButton>
              <ToolButton
                active={tool === "restricted"}
                onClick={() => chooseTool("restricted")}
              >
                Draw new no-walk
              </ToolButton>
              <ToolButton
                active={tool === "path"}
                onClick={() => chooseTool("path")}
              >
                Draw new path
              </ToolButton>
              <ToolButton
                active={tool === "anchor"}
                onClick={() => chooseTool("anchor")}
              >
                Place new QR Anchor
              </ToolButton>
              <ToolButton
                active={tool === "product"}
                onClick={() => chooseTool("product")}
              >
                Place new product
              </ToolButton>
            </div>

            <svg
              viewBox={`0 0 ${floor.widthMeters} ${floor.lengthMeters}`}
              role="application"
              aria-label="Live map editor"
              onClick={addCanvasPoint}
              className="h-[32rem] w-full rounded-lg border bg-slate-950 shadow-inner touch-none"
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            >
              <rect
                width={floor.widthMeters}
                height={floor.lengthMeters}
                fill="#0f172a"
              />
              {verticalGrid.map((x) => (
                <line
                  key={`vx-${x}`}
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={floor.lengthMeters}
                  stroke="#334155"
                  strokeWidth="0.025"
                />
              ))}
              {horizontalGrid.map((z) => (
                <line
                  key={`hz-${z}`}
                  x1={0}
                  x2={floor.widthMeters}
                  y1={z}
                  y2={z}
                  stroke="#334155"
                  strokeWidth="0.025"
                />
              ))}
              <polygon
                data-testid="map-boundary"
                points={pointsToSvg(boundary)}
                fill="rgba(148,163,184,.08)"
                stroke={selection?.type === "boundary" ? "#c084fc" : "#cbd5e1"}
                strokeWidth={selection?.type === "boundary" ? "0.22" : "0.12"}
                pointerEvents="stroke"
                onClick={(event) => {
                  event.stopPropagation();
                  selectBoundary();
                }}
              />
              {data.restrictedAreas.map((area) => (
                <polygon
                  key={area.id}
                  data-testid={`map-restricted-${area.id}`}
                  points={pointsToSvg(area.polygon)}
                  fill="rgba(239,68,68,.34)"
                  stroke={
                    selection?.type === "restrictedArea" &&
                    selection.id === area.id
                      ? "#c084fc"
                      : "#f87171"
                  }
                  strokeWidth={
                    selection?.type === "restrictedArea" &&
                    selection.id === area.id
                      ? "0.22"
                      : "0.1"
                  }
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectRestrictedArea(area);
                  }}
                >
                  <title>{area.name}</title>
                </polygon>
              ))}
              {data.paths.map((path) => (
                <g key={path.id}>
                  <polyline
                    data-testid={`map-path-${path.id}`}
                    points={pointsToSvg(path.points)}
                    fill="none"
                    stroke={
                      selection?.type === "path" && selection.id === path.id
                        ? "#c084fc"
                        : "#38bdf8"
                    }
                    strokeWidth={
                      selection?.type === "path" && selection.id === path.id
                        ? "0.28"
                        : "0.18"
                    }
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                  <polyline
                    points={pointsToSvg(path.points)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="0.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectPath(path);
                    }}
                  >
                    <title>{path.name}</title>
                  </polyline>
                </g>
              ))}
              {data.anchors.map((anchor) => (
                <g
                  key={anchor.id}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectAnchor(anchor);
                  }}
                >
                  <line
                    x1={anchor.x}
                    y1={anchor.z}
                    x2={anchor.startX}
                    y2={anchor.startZ}
                    stroke="#fbbf24"
                    strokeWidth="0.08"
                    strokeDasharray="0.15 0.15"
                  />
                  <circle
                    data-testid={`map-anchor-${anchor.id}`}
                    cx={anchor.x}
                    cy={anchor.z}
                    r="0.28"
                    fill="#fbbf24"
                    stroke={
                      selection?.type === "anchor" && selection.id === anchor.id
                        ? "#c084fc"
                        : "#fff"
                    }
                    strokeWidth={
                      selection?.type === "anchor" && selection.id === anchor.id
                        ? "0.16"
                        : "0.06"
                    }
                  >
                    <title>{`${anchor.code}: ${anchor.name}`}</title>
                  </circle>
                  <text
                    x={anchor.x + 0.34}
                    y={anchor.z - 0.34}
                    fill="#fde68a"
                    fontSize="0.52"
                  >
                    {anchor.code}
                  </text>
                </g>
              ))}
              {data.locations.map((location) => (
                <g
                  key={location.id}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectLocation(location);
                  }}
                >
                  <rect
                    data-testid={`map-location-${location.id}`}
                    x={location.x - 0.19}
                    y={location.z - 0.19}
                    width="0.38"
                    height="0.38"
                    fill="#4ade80"
                    stroke={
                      selection?.type === "location" &&
                      selection.id === location.id
                        ? "#c084fc"
                        : "none"
                    }
                    strokeWidth="0.14"
                    transform={`rotate(45 ${location.x} ${location.z})`}
                  >
                    <title>{`${location.inventoryName}: ${location.label}`}</title>
                  </rect>
                </g>
              ))}
              {selection &&
                (selection.type === "boundary" ||
                  selection.type === "path" ||
                  selection.type === "restrictedArea") && (
                  <g pointerEvents="none">
                    {selection.type === "path" ? (
                      <polyline
                        points={pointsToSvg(editPoints)}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="0.22"
                        strokeDasharray="0.18 0.1"
                      />
                    ) : (
                      <polygon
                        points={pointsToSvg(editPoints)}
                        fill="rgba(168,85,247,.16)"
                        stroke="#c084fc"
                        strokeWidth="0.16"
                        strokeDasharray="0.18 0.1"
                      />
                    )}
                    {editPoints.map((point, index) => (
                      <circle
                        key={`edit-${index}`}
                        cx={point.x}
                        cy={point.z}
                        r="0.18"
                        fill="#e9d5ff"
                        stroke="#7e22ce"
                        strokeWidth="0.06"
                      />
                    ))}
                  </g>
                )}
              {selection?.type === "anchor" &&
                editPosition &&
                editAnchorStart && (
                  <g pointerEvents="none">
                    <line
                      x1={editPosition.x}
                      y1={editPosition.z}
                      x2={editAnchorStart.x}
                      y2={editAnchorStart.z}
                      stroke="#c084fc"
                      strokeWidth="0.11"
                      strokeDasharray="0.15 0.12"
                    />
                    <circle
                      cx={editPosition.x}
                      cy={editPosition.z}
                      r="0.22"
                      fill="#c084fc"
                      stroke="#fff"
                      strokeWidth="0.06"
                    />
                    <circle
                      cx={editAnchorStart.x}
                      cy={editAnchorStart.z}
                      r="0.19"
                      fill="#f9a8d4"
                      stroke="#fff"
                      strokeWidth="0.06"
                    />
                  </g>
                )}
              {selection?.type === "location" && editPosition && (
                <circle
                  cx={editPosition.x}
                  cy={editPosition.z}
                  r="0.23"
                  fill="#c084fc"
                  stroke="#fff"
                  strokeWidth="0.06"
                  pointerEvents="none"
                />
              )}
              {draft.length > 0 && (
                <>
                  {draftIsPolygon ? (
                    <polygon
                      points={pointsToSvg(draft)}
                      fill="rgba(168,85,247,.25)"
                      stroke="#c084fc"
                      strokeWidth="0.12"
                      strokeDasharray="0.18 0.1"
                    />
                  ) : (
                    <polyline
                      points={pointsToSvg(draft)}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="0.18"
                      strokeDasharray="0.2 0.12"
                    />
                  )}
                  {draft.map((point, index) => (
                    <circle
                      key={`${point.x}-${point.z}-${index}`}
                      cx={point.x}
                      cy={point.z}
                      r="0.14"
                      fill="#e9d5ff"
                    />
                  ))}
                </>
              )}
              {candidate && (
                <circle
                  cx={candidate.x}
                  cy={candidate.z}
                  r="0.27"
                  fill="#c084fc"
                  stroke="#fff"
                  strokeWidth="0.06"
                />
              )}
            </svg>
            <p className="mt-2 text-xs text-muted-foreground">
              Active tool:{" "}
              <span className="font-medium text-foreground">{tool}</span>
              {candidate &&
                ` · selected (${formatCoordinate(candidate.x)}, ${formatCoordinate(candidate.z)}) m`}
              {draft.length > 0 &&
                ` · ${draft.length} draft point${draft.length === 1 ? "" : "s"}`}
            </p>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          {selection && (
            <SelectedFeatureEditor
              data={data}
              floor={floor}
              selection={selection}
              editPoints={editPoints}
              setEditPoints={setEditPoints}
              editPosition={editPosition}
              setEditPosition={setEditPosition}
              editAnchorStart={editAnchorStart}
              setEditAnchorStart={setEditAnchorStart}
              onCancel={clearSelection}
            />
          )}

          {tool === "select" && !selection && (
            <HelpCard text="Click an existing boundary line, no-walk area, walk path, QR Anchor, or product point to edit it." />
          )}

          {tool === "boundary" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save store boundary</CardTitle>
                <CardDescription>
                  Use at least three points to create a new store outline.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <form
                  action={saveNavigationBoundaryAction}
                  className="grid gap-3"
                >
                  <input type="hidden" name="floorId" value={floor.id} />
                  <input
                    type="hidden"
                    name="points"
                    value={JSON.stringify(draft)}
                  />
                  <Button type="submit" disabled={draft.length < 3}>
                    Save boundary
                  </Button>
                </form>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft([])}
                >
                  Clear draft
                </Button>
              </CardContent>
            </Card>
          )}

          {tool === "path" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save walk path</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={createNavigationPathAction}
                  className="grid gap-3"
                >
                  <input type="hidden" name="floorId" value={floor.id} />
                  <input
                    type="hidden"
                    name="points"
                    value={JSON.stringify(draft)}
                  />
                  <label className="grid gap-1 text-sm font-medium">
                    Path name
                    <input
                      className={inputClass}
                      name="name"
                      placeholder="Aisle 1"
                      required
                    />
                  </label>
                  <Button type="submit" disabled={draft.length < 2}>
                    Save path
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {tool === "restricted" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save no-walk area</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={createNavigationRestrictedAreaAction}
                  className="grid gap-3"
                >
                  <input type="hidden" name="floorId" value={floor.id} />
                  <input
                    type="hidden"
                    name="polygon"
                    value={JSON.stringify(draft)}
                  />
                  <label className="grid gap-1 text-sm font-medium">
                    Area name
                    <input
                      className={inputClass}
                      name="name"
                      placeholder="Staff counter"
                      required
                    />
                  </label>
                  <Button type="submit" disabled={draft.length < 3}>
                    Save area
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {tool === "anchor" && candidate && anchorStart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add QR Anchor</CardTitle>
                <CardDescription>
                  Position is the centre of the physical sign.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={createNavigationAnchorAction}
                  className="grid gap-3"
                >
                  <input type="hidden" name="floorId" value={floor.id} />
                  <input type="hidden" name="x" value={candidate.x} />
                  <input type="hidden" name="z" value={candidate.z} />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Code
                      <input
                        className={inputClass}
                        name="code"
                        placeholder="ENTRANCE-01"
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Name
                      <input
                        className={inputClass}
                        name="name"
                        placeholder="Front door"
                        required
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Sign width (m)
                      <input
                        className={inputClass}
                        name="widthMeters"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue="0.2"
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Sign height (m)
                      <input
                        className={inputClass}
                        name="signHeightMeters"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue="0.2"
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Mount height (m)
                      <input
                        className={inputClass}
                        name="heightMeters"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue="1.4"
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Sign yaw (°)
                      <input
                        className={inputClass}
                        name="yawDegrees"
                        type="number"
                        step="1"
                        defaultValue="0"
                        required
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm font-medium">
                    Customer start point X (m)
                    <input
                      className={inputClass}
                      name="startX"
                      type="number"
                      step="0.01"
                      value={anchorStart.x}
                      onChange={(event) =>
                        setAnchorStart((current) =>
                          current
                            ? { ...current, x: event.target.value }
                            : current,
                        )
                      }
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Customer start point Z (m)
                    <input
                      className={inputClass}
                      name="startZ"
                      type="number"
                      step="0.01"
                      value={anchorStart.z}
                      onChange={(event) =>
                        setAnchorStart((current) =>
                          current
                            ? { ...current, z: event.target.value }
                            : current,
                        )
                      }
                      required
                    />
                  </label>
                  <Button type="submit">Save QR Anchor</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {tool === "product" && candidate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Add product destination
                </CardTitle>
                <CardDescription>
                  Place the point where the customer should stand, not at an IoT
                  shelf centre.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={createInventoryNavigationLocationAction}
                  className="grid gap-3"
                >
                  <input type="hidden" name="floorId" value={floor.id} />
                  <input type="hidden" name="x" value={candidate.x} />
                  <input type="hidden" name="z" value={candidate.z} />
                  <label className="grid gap-1 text-sm font-medium">
                    Product
                    <select
                      className={inputClass}
                      name="inventoryId"
                      required
                      defaultValue=""
                    >
                      {" "}
                      <option value="" disabled>
                        Select inventory
                      </option>
                      {data.inventories.map((inventory) => (
                        <option key={inventory.id} value={inventory.id}>
                          {inventory.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Customer-facing label
                    <input
                      className={inputClass}
                      name="label"
                      placeholder="Aisle 2, left side"
                      required
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={data.inventories.length === 0}
                  >
                    Save destination
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {tool === "anchor" && !candidate && (
            <HelpCard text="Click the physical sign position, then enter its real dimensions and the expected customer start point." />
          )}
          {tool === "product" && !candidate && (
            <HelpCard text="Click the walkable destination point for a product. A single inventory can have more than one destination." />
          )}
          {tool === "path" && (
            <HelpCard text="Click points along a safe walkable route, then save the polyline." />
          )}
          {tool === "restricted" && (
            <HelpCard text="Click around furniture or staff-only areas, then save the closed polygon." />
          )}
        </div>
      </div>

      <AnchorList anchors={data.anchors} />
      <FeatureList
        title="Walk paths"
        items={data.paths.map((path) => ({
          id: path.id,
          label: `${path.name} — ${path.points.length} points`,
        }))}
        type="path"
      />
      <FeatureList
        title="No-walk areas"
        items={data.restrictedAreas.map((area) => ({
          id: area.id,
          label: `${area.name} — ${area.polygon.length} points`,
        }))}
        type="restrictedArea"
      />
      <FeatureList
        title="Product destinations"
        items={data.locations.map((location) => ({
          id: location.id,
          label: `${location.inventoryName} — ${location.label} (${formatCoordinate(location.x)}, ${formatCoordinate(location.z)})`,
        }))}
        type="location"
      />
    </div>
  );
}

function PointListEditor({
  points,
  setPoints,
  minimum,
  floor,
}: {
  points: MapPoint[];
  setPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
  minimum: number;
  floor: NonNullable<LiveMapData["floor"]>;
}) {
  function updatePoint(index: number, key: keyof MapPoint, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setPoints((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index
          ? {
              ...point,
              [key]: clamp(
                value,
                0,
                key === "x" ? floor.widthMeters : floor.lengthMeters,
              ),
            }
          : point,
      ),
    );
  }

  function addPoint() {
    setPoints((current) => {
      const last = current.at(-1) ?? { x: 0, z: 0 };
      return [
        ...current,
        {
          x: clamp(last.x + 0.5, 0, floor.widthMeters),
          z: clamp(last.z + 0.5, 0, floor.lengthMeters),
        },
      ];
    });
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Points</p>
      {points.map((point, index) => (
        <div
          key={index}
          className="grid grid-cols-[2rem_1fr_1fr_auto] items-end gap-2"
        >
          <span className="pb-2 text-xs text-muted-foreground">
            {index + 1}
          </span>
          <label className="grid gap-1 text-xs">
            X (m)
            <input
              className={inputClass}
              type="number"
              min="0"
              max={floor.widthMeters}
              step="0.01"
              value={point.x}
              onChange={(event) => updatePoint(index, "x", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Z (m)
            <input
              className={inputClass}
              type="number"
              min="0"
              max={floor.lengthMeters}
              step="0.01"
              value={point.z}
              onChange={(event) => updatePoint(index, "z", event.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={points.length <= minimum}
            onClick={() =>
              setPoints((current) =>
                current.filter((_, pointIndex) => pointIndex !== index),
              )
            }
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addPoint}>
        Add point
      </Button>
    </div>
  );
}

function PositionEditor({
  title,
  position,
  setPosition,
  floor,
}: {
  title: string;
  position: MapPoint;
  setPosition: React.Dispatch<React.SetStateAction<MapPoint | null>>;
  floor: NonNullable<LiveMapData["floor"]>;
}) {
  function updatePosition(key: keyof MapPoint, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setPosition((current) =>
      current
        ? {
            ...current,
            [key]: clamp(
              value,
              0,
              key === "x" ? floor.widthMeters : floor.lengthMeters,
            ),
          }
        : current,
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <p className="col-span-2 text-sm font-medium">{title}</p>
      <label className="grid gap-1 text-xs">
        X (m)
        <input
          className={inputClass}
          type="number"
          min="0"
          max={floor.widthMeters}
          step="0.01"
          value={position.x}
          onChange={(event) => updatePosition("x", event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs">
        Z (m)
        <input
          className={inputClass}
          type="number"
          min="0"
          max={floor.lengthMeters}
          step="0.01"
          value={position.z}
          onChange={(event) => updatePosition("z", event.target.value)}
        />
      </label>
    </div>
  );
}

function DeleteFeatureForm({
  type,
  id,
  label,
  onDelete,
}: {
  type: "boundary" | "anchor" | "path" | "restrictedArea" | "location";
  id: string;
  label: string;
  onDelete: () => void;
}) {
  return (
    <form
      action={deleteNavigationFeatureAction}
      className="border-t pt-3"
      onSubmit={(event) => {
        if (!window.confirm(`Delete this ${label}?`)) {
          event.preventDefault();
          return;
        }
        onDelete();
      }}
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive">
        Delete {label}
      </Button>
    </form>
  );
}

function SelectedFeatureEditor({
  data,
  floor,
  selection,
  editPoints,
  setEditPoints,
  editPosition,
  setEditPosition,
  editAnchorStart,
  setEditAnchorStart,
  onCancel,
}: {
  data: LiveMapData;
  floor: NonNullable<LiveMapData["floor"]>;
  selection: SelectedFeature;
  editPoints: MapPoint[];
  setEditPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
  editPosition: MapPoint | null;
  setEditPosition: React.Dispatch<React.SetStateAction<MapPoint | null>>;
  editAnchorStart: MapPoint | null;
  setEditAnchorStart: React.Dispatch<React.SetStateAction<MapPoint | null>>;
  onCancel: () => void;
}) {
  const selectedPath =
    selection.type === "path"
      ? data.paths.find((path) => path.id === selection.id)
      : null;
  const selectedArea =
    selection.type === "restrictedArea"
      ? data.restrictedAreas.find((area) => area.id === selection.id)
      : null;
  const selectedAnchor =
    selection.type === "anchor"
      ? data.anchors.find((anchor) => anchor.id === selection.id)
      : null;
  const selectedLocation =
    selection.type === "location"
      ? data.locations.find((location) => location.id === selection.id)
      : null;

  if (selection.type === "boundary") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit store boundary</CardTitle>
          <CardDescription>
            Update the existing outline. This replaces the current boundary.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form action={saveNavigationBoundaryAction} className="grid gap-3">
            <input type="hidden" name="floorId" value={floor.id} />
            <input
              type="hidden"
              name="points"
              value={JSON.stringify(editPoints)}
            />
            <PointListEditor
              points={editPoints}
              setPoints={setEditPoints}
              minimum={3}
              floor={floor}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={editPoints.length < 3}>
                Update boundary
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
          <DeleteFeatureForm
            type="boundary"
            id={floor.id}
            label="boundary"
            onDelete={onCancel}
          />
        </CardContent>
      </Card>
    );
  }

  if (selection.type === "path" && selectedPath) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit walk path</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form action={updateNavigationPathAction} className="grid gap-3">
            <input type="hidden" name="id" value={selectedPath.id} />
            <input
              type="hidden"
              name="points"
              value={JSON.stringify(editPoints)}
            />
            <label className="grid gap-1 text-sm font-medium">
              Path name
              <input
                className={inputClass}
                name="name"
                defaultValue={selectedPath.name}
                required
              />
            </label>
            <PointListEditor
              points={editPoints}
              setPoints={setEditPoints}
              minimum={2}
              floor={floor}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={editPoints.length < 2}>
                Update path
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
          <DeleteFeatureForm
            type="path"
            id={selectedPath.id}
            label="walk path"
            onDelete={onCancel}
          />
        </CardContent>
      </Card>
    );
  }

  if (selection.type === "restrictedArea" && selectedArea) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit no-walk area</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form
            action={updateNavigationRestrictedAreaAction}
            className="grid gap-3"
          >
            <input type="hidden" name="id" value={selectedArea.id} />
            <input
              type="hidden"
              name="polygon"
              value={JSON.stringify(editPoints)}
            />
            <label className="grid gap-1 text-sm font-medium">
              Area name
              <input
                className={inputClass}
                name="name"
                defaultValue={selectedArea.name}
                required
              />
            </label>
            <PointListEditor
              points={editPoints}
              setPoints={setEditPoints}
              minimum={3}
              floor={floor}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={editPoints.length < 3}>
                Update area
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
          <DeleteFeatureForm
            type="restrictedArea"
            id={selectedArea.id}
            label="no-walk area"
            onDelete={onCancel}
          />
        </CardContent>
      </Card>
    );
  }

  if (
    selection.type === "anchor" &&
    selectedAnchor &&
    editPosition &&
    editAnchorStart
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit QR Anchor</CardTitle>
          <CardDescription>
            Updating this Anchor does not change its QR URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form action={updateNavigationAnchorAction} className="grid gap-3">
            <input type="hidden" name="id" value={selectedAnchor.id} />
            <input type="hidden" name="x" value={editPosition.x} />
            <input type="hidden" name="z" value={editPosition.z} />
            <input type="hidden" name="startX" value={editAnchorStart.x} />
            <input type="hidden" name="startZ" value={editAnchorStart.z} />
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Code
                <input
                  className={inputClass}
                  name="code"
                  defaultValue={selectedAnchor.code}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Name
                <input
                  className={inputClass}
                  name="name"
                  defaultValue={selectedAnchor.name}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Sign width (m)
                <input
                  className={inputClass}
                  name="widthMeters"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedAnchor.widthMeters}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Sign height (m)
                <input
                  className={inputClass}
                  name="signHeightMeters"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedAnchor.signHeightMeters}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Mount height (m)
                <input
                  className={inputClass}
                  name="heightMeters"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedAnchor.heightMeters}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Sign yaw (°)
                <input
                  className={inputClass}
                  name="yawDegrees"
                  type="number"
                  step="0.1"
                  defaultValue={selectedAnchor.yawDegrees}
                  required
                />
              </label>
            </div>
            <PositionEditor
              title="Physical sign position"
              position={editPosition}
              setPosition={setEditPosition}
              floor={floor}
            />
            <PositionEditor
              title="Customer start point"
              position={editAnchorStart}
              setPosition={setEditAnchorStart}
              floor={floor}
            />
            <div className="flex gap-2">
              <Button type="submit">Update QR Anchor</Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
          <DeleteFeatureForm
            type="anchor"
            id={selectedAnchor.id}
            label="QR Anchor"
            onDelete={onCancel}
          />
        </CardContent>
      </Card>
    );
  }

  if (selection.type === "location" && selectedLocation && editPosition) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit product destination</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form
            action={updateInventoryNavigationLocationAction}
            className="grid gap-3"
          >
            <input type="hidden" name="id" value={selectedLocation.id} />
            <input type="hidden" name="x" value={editPosition.x} />
            <input type="hidden" name="z" value={editPosition.z} />
            <label className="grid gap-1 text-sm font-medium">
              Product
              <select
                className={inputClass}
                name="inventoryId"
                defaultValue={selectedLocation.inventoryId}
                required
              >
                {data.inventories.map((inventory) => (
                  <option key={inventory.id} value={inventory.id}>
                    {inventory.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Customer-facing label
              <input
                className={inputClass}
                name="label"
                defaultValue={selectedLocation.label}
                required
              />
            </label>
            <PositionEditor
              title="Customer destination"
              position={editPosition}
              setPosition={setEditPosition}
              floor={floor}
            />
            <div className="flex gap-2">
              <Button type="submit">Update destination</Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
          <DeleteFeatureForm
            type="location"
            id={selectedLocation.id}
            label="product destination"
            onDelete={onCancel}
          />
        </CardContent>
      </Card>
    );
  }

  return <HelpCard text="This item is no longer available. Select it again." />;
}

function HelpCard({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function AnchorList({ anchors }: { anchors: LiveMapData["anchors"] }) {
  const [editingAnchorId, setEditingAnchorId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">QR Anchors</CardTitle>
        <CardDescription>
          Download, print, or edit an Anchor after saving it. Editing keeps the
          existing QR URL valid.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {anchors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No QR anchors yet.</p>
        ) : (
          <ul className="grid gap-3">
            {anchors.map((anchor) => (
              <li
                key={anchor.id}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[7rem_1fr_auto]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={anchor.qrImageUrl}
                  alt={`QR code for ${anchor.code}`}
                  width={112}
                  height={112}
                  className="size-28 rounded-md border bg-white p-1"
                />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {anchor.code} — {anchor.name}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Sign: {anchor.widthMeters} × {anchor.signHeightMeters} m ·
                    mount {anchor.heightMeters} m · yaw {anchor.yawDegrees}°
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {anchor.qrUrl}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={anchor.qrImageUrl}
                      download={`live-map-${anchor.code}.png`}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Download QR
                    </a>
                    <a
                      href={anchor.qrImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Open / Print
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditingAnchorId((current) =>
                        current === anchor.id ? null : anchor.id,
                      )
                    }
                  >
                    {editingAnchorId === anchor.id ? "Cancel" : "Edit"}
                  </Button>
                  <form action={deleteNavigationFeatureAction}>
                    <input type="hidden" name="type" value="anchor" />
                    <input type="hidden" name="id" value={anchor.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Remove
                    </Button>
                  </form>
                </div>
                {editingAnchorId === anchor.id ? (
                  <form
                    action={updateNavigationAnchorAction}
                    className="grid gap-3 border-t pt-3 sm:col-span-3 sm:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={anchor.id} />
                    <label className="grid gap-1 text-xs">
                      Code
                      <input
                        className={inputClass}
                        name="code"
                        defaultValue={anchor.code}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Name
                      <input
                        className={inputClass}
                        name="name"
                        defaultValue={anchor.name}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Sign X (m)
                      <input
                        className={inputClass}
                        name="x"
                        type="number"
                        step="0.01"
                        defaultValue={anchor.x}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Sign Z (m)
                      <input
                        className={inputClass}
                        name="z"
                        type="number"
                        step="0.01"
                        defaultValue={anchor.z}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Sign width (m)
                      <input
                        className={inputClass}
                        name="widthMeters"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={anchor.widthMeters}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Sign height (m)
                      <input
                        className={inputClass}
                        name="signHeightMeters"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={anchor.signHeightMeters}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Mount height (m)
                      <input
                        className={inputClass}
                        name="heightMeters"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={anchor.heightMeters}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Sign yaw (°)
                      <input
                        className={inputClass}
                        name="yawDegrees"
                        type="number"
                        step="0.1"
                        defaultValue={anchor.yawDegrees}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Customer start X (m)
                      <input
                        className={inputClass}
                        name="startX"
                        type="number"
                        step="0.01"
                        defaultValue={anchor.startX}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Customer start Z (m)
                      <input
                        className={inputClass}
                        name="startZ"
                        type="number"
                        step="0.01"
                        defaultValue={anchor.startZ}
                        required
                      />
                    </label>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Button type="submit" size="sm">
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingAnchorId(null)}
                      >
                        Cancel
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        The printed QR remains unchanged.
                      </span>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureList({
  title,
  items,
  type,
}: {
  title: string;
  items: Array<{ id: string; label: string }>;
  type: "anchor" | "path" | "restrictedArea" | "location";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {title.toLowerCase()} yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span>{item.label}</span>
                <form action={deleteNavigationFeatureAction}>
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
