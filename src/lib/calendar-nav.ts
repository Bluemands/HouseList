"use client";

import { createContext, useContext } from "react";

export type CalendarOpen = { day: string; add?: boolean };

/** Opens the calendar over whichever layout this phone shows, on a day (today by default), or straight into adding an event. Provided by the app shell. */
export const CalendarNavContext = createContext<(day?: string, add?: boolean) => void>(() => {});

export const useOpenCalendar = () => useContext(CalendarNavContext);
