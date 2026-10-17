"use client";

import { createContext, useContext } from "react";
import type { Room } from "@/lib/types";

/**
 * Opens the boards over whichever layout this phone shows: all of them, or
 * one board, or "new" to start one. Provided by the app shell.
 */
export const BoardNavContext = createContext<(target: { board?: string | "new"; room?: Room | null }) => void>(() => {});

export const useOpenBoards = () => useContext(BoardNavContext);
