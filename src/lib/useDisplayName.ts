"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "house-list-name";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Storage can be blocked (some private modes); then the name lasts this visit.
let fallback: string | null = null;

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

function getServerSnapshot() {
  return null;
}

function notify() {
  for (const listener of listeners) listener();
}

export function useDisplayName() {
  const name = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setName = useCallback((value: string) => {
    fallback = value.trim();
    try {
      window.localStorage.setItem(STORAGE_KEY, fallback);
    } catch {}
    notify();
  }, []);

  const clearName = useCallback(() => {
    fallback = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    notify();
  }, []);

  return { name, setName, clearName };
}
