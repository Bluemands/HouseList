"use client";

import { createContext, useContext } from "react";

/** Opens the calendar over whichever layout this phone shows, on a day (today by default). Provided by the app shell. */
export const CalendarNavContext = createContext<(day?: string) => void>(() => {});

export const useOpenCalendar = () => useContext(CalendarNavContext);
