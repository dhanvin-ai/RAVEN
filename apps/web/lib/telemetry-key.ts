"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "raven-telemetry-key";

export function getStoredTelemetryKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) || "";
}

export function useTelemetryKey() {
  const [apiKey, setApiKeyState] = useState<string>(() => getStoredTelemetryKey());
  const setApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    setApiKeyState(trimmed);
    try {
      if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — key stays in memory */
    }
  }, []);
  return { apiKey, setApiKey };
}
