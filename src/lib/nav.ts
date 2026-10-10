"use client";

import { useCallback, useEffect, useState } from "react";
import { ROOMS, type Room } from "@/lib/types";

export type View = "home" | "list" | "rooms" | "money";
export type Route = { view: View; room?: Room };

const VIEWS: View[] = ["home", "list", "rooms", "money"];

function read(): Route {
  const params = new URLSearchParams(window.location.search);
  const view = VIEWS.includes(params.get("v") as View) ? (params.get("v") as View) : "home";
  const room = params.get("room");
  return { view, room: ROOMS.includes(room as Room) ? (room as Room) : undefined };
}

function write(route: Route) {
  const params = new URLSearchParams();
  if (route.view !== "home") params.set("v", route.view);
  if (route.room) params.set("room", route.room);
  const qs = params.toString();
  return qs ? `?${qs}` : window.location.pathname;
}

/** Tab + room selection, kept in the URL so back/forward and refresh work. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined" ? { view: "home" } : read(),
  );

  useEffect(() => {
    const onPop = () => setRoute(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((next: Route) => {
    window.history.pushState(null, "", write(next));
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  return { route, go };
}
