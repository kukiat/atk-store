import type { ParserConfig } from "@/lib/loadcell/types";

export type PayloadTemplate = {
  id: string;
  name: string;
  desc: string;
  parser: ParserConfig;
  buildPayload: (deviceId: string) => Record<string, unknown>;
};

export const DEFAULT_PARSER: ParserConfig = {
  deviceIdPath: "$.deviceId",
  weightPath: "$.weight",
  unitPath: "$.unit",
  stablePath: "$.stable",
  rawValuePath: "$.rawValue",
  timestampPath: "$.timestamp",
  overloadPath: "$.overload",
  defaultUnit: "kg",
};

export const PAYLOAD_TEMPLATES: PayloadTemplate[] = [
  {
    id: "standard",
    name: "Standard flat",
    desc: "deviceId, weight, unit — gateway default",
    parser: DEFAULT_PARSER,
    buildPayload: (deviceId) => ({
      deviceId,
      weight: 12.485,
      unit: "kg",
      stable: true,
      overload: false,
      rawValue: 124850,
      timestamp: new Date().toISOString(),
    }),
  },
  {
    id: "custom",
    name: "Short keys",
    desc: "id / value / u — compact ESP firmware",
    parser: {
      deviceIdPath: "$.id",
      weightPath: "$.value",
      unitPath: "$.u",
      stablePath: "$.stable",
      rawValuePath: "$.raw",
      timestampPath: "$.timestamp",
      overloadPath: "$.overload",
      defaultUnit: "kg",
    },
    buildPayload: (deviceId) => ({
      id: deviceId,
      value: 12.485,
      u: "kg",
      stable: true,
      raw: 124850,
      timestamp: new Date().toISOString(),
    }),
  },
  {
    id: "nested",
    name: "Nested object",
    desc: "meta + reading groups — common IoT shape",
    parser: {
      deviceIdPath: "$.meta.id",
      weightPath: "$.reading.w",
      unitPath: "$.unit",
      stablePath: "$.reading.stable",
      overloadPath: "$.reading.overload",
      timestampPath: "$.meta.ts",
      defaultUnit: "kg",
    },
    buildPayload: (deviceId) => ({
      meta: { id: deviceId, ts: new Date().toISOString() },
      reading: { w: 8.75, stable: true, overload: false },
      unit: "kg",
    }),
  },
  {
    id: "hexdas",
    name: "HEX / DAS style",
    desc: "data.weight nested under sensor block",
    parser: {
      deviceIdPath: "$.device",
      weightPath: "$.data.weight",
      unitPath: "$.data.unit",
      stablePath: "$.data.stable",
      timestampPath: "$.data.time",
      defaultUnit: "kg",
    },
    buildPayload: (deviceId) => ({
      device: deviceId,
      data: {
        weight: 45.2,
        unit: "kg",
        stable: true,
        time: new Date().toISOString(),
      },
    }),
  },
  {
    id: "minimal",
    name: "Weight only",
    desc: "single field — uses default unit",
    parser: {
      weightPath: "$.w",
      defaultUnit: "kg",
    },
    buildPayload: () => ({
      w: 3.14,
    }),
  },
];
