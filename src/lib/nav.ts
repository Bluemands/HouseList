"use client";

import { addTransitionType, startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

export type Direction = "nav-forward" | "nav-back" | "nav-tab";

/** How a move reads on screen: into a room, back out to the rooms, or across. */
export function direction(from: Route, to: Route): Direction {
  if (to.room && !from.room) return "nav-forward";
  if (from.room && !to.room && to.view === "rooms") return "nav-back";
  return "nav-tab";
}

/**
 * Tab + room selection, kept in the URL so back/forward and refresh work.
 * Each move is a transition tagged with its direction, which FullLayout's
 * view transition reads.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined" ? { view: "home" } : read(),
  );
  const current = useRef(route);
  const toTop = useRef(false);

  const move = useCallback((next: Route) => {
    const type = direction(current.current, next);
    current.current = next;
    startTransition(() => {
      addTransitionType(type);
      setRoute(next);
    });
  }, []);

  useEffect(() => {
    const onPop = () => move(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [move]);

  // Scrolled in the same commit as the new view, so it arrives at the top
  // rather than the old view jumping up first. Back and forward keep the
  // browser's own scroll.
  useLayoutEffect(() => {
    if (!toTop.current) return;
    toTop.current = false;
    window.scrollTo({ top: 0 });
  }, [route]);

  const go = useCallback(
    (next: Route) => {
      window.history.pushState(null, "", write(next));
      toTop.current = true;
      move(next);
    },
    [move],
  );

  return { route, go };
}
