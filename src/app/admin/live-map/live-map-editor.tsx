"use client";

import { useMemo, useState } from "react";

import Image from "next/image";

import {
  createInventoryNavigationLocationAction,
  createNavigationAnchorAction,
  createNavigationPathAction,
  createNavigationRestrictedAreaAction,
  deleteNavigationFeatureAction,
  saveNavigationBoundaryAction,
  updateNavigationFloorAction,
} from "@/app/admin/live-map/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LiveMapData, MapPoint } from "@/services/live-map.service";

type Tool =
  | "select"
  | "boundary"
  | "path"
  | "restricted"
  | "anchor"
  | "product";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function formatCoordinate(value: number) {
  return value.toFixed(2);
}

function pointsToSvg(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.z}`).join(" ");
}

function rectangle(width: number, length: number): MapPoint[] {
  return [
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: length },
    { x: 0, z: length },
  ];
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
  const boundary = useMemo(
    () =>
      floor.boundary.length >= 3
        ? floor.boundary
        : rectangle(floor.widthMeters, floor.lengthMeters),
    [floor],
  );

  function chooseTool(nextTool: Tool) {
    setTool(nextTool);
    setCandidate(null);
    setAnchorStart(null);
    setDraft(nextTool === "boundary" ? floor.boundary : []);
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Floor canvas</CardTitle>
            <CardDescription>
              Select a tool, then click the canvas to place a point. Grey is
              store boundary; red areas are not walkable; blue lines are
              customer paths.
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
                No-walk area
              </ToolButton>
              <ToolButton
                active={tool === "path"}
                onClick={() => chooseTool("path")}
              >
                Walk path
              </ToolButton>
              <ToolButton
                active={tool === "anchor"}
                onClick={() => chooseTool("anchor")}
              >
                Place QR Anchor
              </ToolButton>
              <ToolButton
                active={tool === "product"}
                onClick={() => chooseTool("product")}
              >
                Place product
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
                points={pointsToSvg(boundary)}
                fill="rgba(148,163,184,.08)"
                stroke="#cbd5e1"
                strokeWidth="0.12"
              />
              {data.restrictedAreas.map((area) => (
                <polygon
                  key={area.id}
                  points={pointsToSvg(area.polygon)}
                  fill="rgba(239,68,68,.34)"
                  stroke="#f87171"
                  strokeWidth="0.1"
                >
                  <title>{area.name}</title>
                </polygon>
              ))}
              {data.paths.map((path) => (
                <polyline
                  key={path.id}
                  points={pointsToSvg(path.points)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <title>{path.name}</title>
                </polyline>
              ))}
              {data.anchors.map((anchor) => (
                <g key={anchor.id}>
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
                    cx={anchor.x}
                    cy={anchor.z}
                    r="0.28"
                    fill="#fbbf24"
                    stroke="#fff"
                    strokeWidth="0.06"
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
                <g key={location.id}>
                  <rect
                    x={location.x - 0.19}
                    y={location.z - 0.19}
                    width="0.38"
                    height="0.38"
                    fill="#4ade80"
                    transform={`rotate(45 ${location.x} ${location.z})`}
                  >
                    <title>{`${location.inventoryName}: ${location.label}`}</title>
                  </rect>
                </g>
              ))}
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
          {tool === "boundary" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save store boundary</CardTitle>
                <CardDescription>
                  Use at least three points. The default rectangular boundary
                  remains until saved.
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

function HelpCard({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function AnchorList({ anchors }: { anchors: LiveMapData["anchors"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">QR Anchors</CardTitle>
        <CardDescription>
          Download or print the QR after saving an Anchor. Each QR opens only
          its own Live Map start point.
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
                <Image
                  src={anchor.qrImageDataUrl}
                  alt={`QR code for ${anchor.code}`}
                  width={112}
                  height={112}
                  unoptimized
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
                      href={anchor.qrImageDataUrl}
                      download={`live-map-${anchor.code}.png`}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Download QR
                    </a>
                    <a
                      href={anchor.qrImageDataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Open / Print
                    </a>
                  </div>
                </div>
                <form action={deleteNavigationFeatureAction}>
                  <input type="hidden" name="type" value="anchor" />
                  <input type="hidden" name="id" value={anchor.id} />
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
