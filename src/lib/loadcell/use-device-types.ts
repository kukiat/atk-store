"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchDeviceTypes } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { DeviceTypeCatalog } from "@/lib/loadcell/types";
import { DEFAULT_DEVICE_TYPE, DEVICE_TYPE_OPTIONS, normalizeDeviceType } from "@/lib/loadcell/utils";

const FALLBACK_CATALOG: DeviceTypeCatalog[] = DEVICE_TYPE_OPTIONS.map((o, i) => ({
  id: `fallback-${o.value}`,
  slug: o.value,
  label: o.label,
  enabled: true,
  sort_order: (i + 1) * 10,
  device_count: 0,
  created_at: "",
  updated_at: "",
}));

export function useDeviceTypes() {
  const token = useAuthStore((s) => s.token);
  const [types, setTypes] = useState<DeviceTypeCatalog[]>(FALLBACK_CATALOG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) {
      setTypes(FALLBACK_CATALOG);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchDeviceTypes(token);
      if (rows.length > 0) {
        setTypes(rows);
      } else {
        setTypes(FALLBACK_CATALOG);
      }
    } catch {
      setTypes(FALLBACK_CATALOG);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const options = useMemo(
    () =>
      [...types]
        .filter((t) => t.enabled)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "th"))
        .map((t) => ({ value: t.slug, label: t.label })),
    [types],
  );

  const labelFor = useCallback(
    (slug?: string | null) => {
      const v = normalizeDeviceType(slug);
      return types.find((t) => t.slug === v)?.label ?? v;
    },
    [types],
  );

  const defaultType = useMemo(() => {
    const enabled = types.filter((t) => t.enabled).sort((a, b) => a.sort_order - b.sort_order);
    return enabled[0]?.slug ?? DEFAULT_DEVICE_TYPE;
  }, [types]);

  return { types, options, labelFor, defaultType, reload, loading };
}
