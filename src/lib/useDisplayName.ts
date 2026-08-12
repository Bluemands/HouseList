"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "house-list-name";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, value.trim());
    notify();
  }, []);

  const clearName = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    notify();
  }, []);

  return { name, setName, clearName };
}
