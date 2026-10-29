"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CalendarPlus, Check, Copy, Download, Eye, EyeOff, ListPlus, Lock, X } from "lucide-react";
import { ESSENTIALS } from "@/lib/essentials";
import { useStore } from "@/lib/store";
import { useSheetDrag, useSheetExit } from "@/lib/useSheetDrag";
import { logout } from "@/lib/api-client";
import { workerState } from "@/lib/worker-state";
import { timeAgo } from "@/lib/format";
import { Button, Field, Segmented, inputClass } from "@/components/ui";
import { NotificationsField } from "@/components/NotificationsField";
import type { Layout } from "@/lib/layout";
import { BinsField } from "@/components/Bins";

type Theme = "system" | "light" | "dark";

function readTheme(): Theme {
  try {
    const t = window.localStorage.getItem("house-list-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  try {
    if (theme === "system") {
      window.localStorage.removeItem("house-list-theme");
      delete document.documentElement.dataset.theme;
    } else {
      window.localStorage.setItem("house-list-theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {}
}

export function SettingsSheet({
  open,
  onClose,
  onSwitchUser,
  layout,
  onLayout,
}: {
  open: boolean;
  onClose: () => void;
  onSwitchUser: () => void;
  layout: Layout;
  onLayout: (layout: Layout) => void;
}) {
  const { me, settings, saveSettings, calendarPath, connectorPath, workerToken, openBulk } = useStore();
  const [copied, setCopied] = useState<"calendar" | "connector" | null>(null);
  const [origin, setOrigin] = useState("");
  // iPhones and Macs subscribe to a webcal:// link themselves; Android (and
  // Google Calendar anywhere) ignores one, so it gets Google's own add link.
  const [apple, setApple] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const worker = workerState(settings.workerSeenAt);
  const [theme, setTheme] = useState<Theme>("system");
  const [movedIn, setMovedIn] = useState(settings.movedInOn ?? "");
  const ref = useRef<HTMLDialogElement>(null);
  const dragHandlers = useSheetDrag(onClose);
  const { shown, leaving } = useSheetExit(open || null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (shown && !d.open) {
      setTheme(readTheme());
      setMovedIn(settings.movedInOn ?? "");
      setOrigin(window.location.origin);
      setApple(/iPhone|iPad|Macintosh/.test(navigator.userAgent));
      d.showModal();
    }
    if (!shown && d.open) d.close();
  }, [shown, settings.movedInOn]);

  async function copy(which: "calendar" | "connector", path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Escape closes the way the button does, so it slides away too.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="settings-title"
      className={clsx(leaving && "sheet-leaving", "sheet m-0 inset-x-0 top-auto bottom-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-sheet bg-surface p-0 text-ink shadow-sheet lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[420px] lg:rounded-none lg:rounded-l-sheet")}
    >
      <div {...dragHandlers} className="relative flex touch-none items-center justify-between px-5 pt-5">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        <h2 id="settings-title" className="text-sheet-title font-bold">
          Settings
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="hit grid h-9 w-9 place-items-center rounded-full hover:bg-sunken">
          <X size={19} />
        </button>
      </div>

      <div className="grid gap-6 px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Field label="You are">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span className="text-title font-semibold">{me}</span>
            <Button variant="ghost" onClick={onSwitchUser} className="px-3 py-1.5">
              Not you?
            </Button>
          </div>
        </Field>

        <Field label="We got the keys on" hint="Shows how many days you've been in the house.">
          <div className="flex gap-2">
            <input
              type="date"
              value={movedIn}
              onChange={(e) => setMovedIn(e.target.value)}
              aria-label="Moved-in date"
              className={inputClass}
            />
            <Button
              variant="secondary"
              disabled={movedIn === (settings.movedInOn ?? "")}
              onClick={() => saveSettings({ movedInOn: movedIn || null })}
            >
              Save
            </Button>
          </div>
        </Field>

        <BinsField />

        <Field
          label="This phone shows"
          hint={
            layout === "simple"
              ? "Just the checklist, with adding one question at a time. Money, plans and Claude are in the full app."
              : "Everything: money, plans, priorities and Claude. A simple list is just the checklist, on this phone only."
          }
        >
          <Segmented
            label="This phone shows"
            value={layout}
            onChange={(next) => {
              onLayout(next);
              onClose();
            }}
            options={[
              { value: "full", label: "The full app" },
              { value: "simple", label: "A simple list" },
            ]}
          />
        </Field>

        <Field label="Appearance">
          <Segmented
            label="Appearance"
            value={theme}
            onChange={(t) => {
              setTheme(t);
              applyTheme(t);
            }}
            options={[
              { value: "system", label: "Automatic" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Field>

        <NotificationsField me={me} />

        {settings.members.length > 0 && (
          <Field label="Household">
            <p className="text-body text-ink-2">{settings.members.join(", ")}</p>
          </Field>
        )}

        <Field
          label="In your phone’s calendar"
          hint={
            apple
              ? "Subscribe once on each phone and your events and everything with a due date show up, with a 9am reminder on a job’s day. Keep the link private."
              : "Opens Google Calendar: tap Add. If the Calendar app opens instead and does nothing, copy the link and add it in Google Calendar under Settings, Add calendar, From URL. Google picks up changes every few hours, not straight away. Keep the link private."
          }
        >
          <div className="flex flex-wrap gap-2">
            <a
              href={
                apple
                  ? `webcal://${origin.replace(/^https?:\/\//, "")}${calendarPath}`
                  : `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${origin.replace(/^https?:\/\//, "")}${calendarPath}`)}`
              }
              target={apple ? undefined : "_blank"}
              rel={apple ? undefined : "noopener noreferrer"}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              <CalendarPlus size={16} /> {apple ? "Subscribe" : "Add to Google Calendar"}
            </a>
            <Button variant="secondary" onClick={() => copy("calendar", calendarPath)}>
              {copied === "calendar" ? <Check size={16} /> : <Copy size={16} />} {copied === "calendar" ? "Copied" : "Copy link"}
            </Button>
          </div>
        </Field>

        <Field
          label="Use it from Claude"
          hint="In claude.ai, open Settings → Connectors → Add custom connector and paste this link. Claude can then research jobs and add them here from any Claude app. Keep the link private."
        >
          <div className="flex gap-2">
            <input
              readOnly
              value={`${origin}${connectorPath}`}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Claude connector link"
              className={`${inputClass} min-w-0 truncate`}
            />
            <Button variant="secondary" onClick={() => copy("connector", connectorPath)} className="shrink-0">
              {copied === "connector" ? <Check size={16} /> : <Copy size={16} />} {copied === "connector" ? "Copied" : "Copy"}
            </Button>
          </div>
        </Field>

        <Field
          label="Ask Claude"
          hint="A worker answers questions from the app: a small script running Claude Code on a computer signed in to a Claude subscription (see the README). It needs this token. Keep it private, like the calendar link."
        >
          <p className="text-supporting text-ink-2">
            {worker === "never"
              ? "No worker has checked in yet."
              : worker === "active"
                ? `The worker is running. Last checked in ${timeAgo(settings.workerSeenAt!)}.`
                : `The worker last checked in ${timeAgo(settings.workerSeenAt!)}. It runs when its computer is on.`}
          </p>
          <p
            aria-label={showToken ? "Worker token" : "Worker token, hidden"}
            className="rounded-control border border-line bg-sunken px-3 py-2.5 text-meta break-all text-ink tabular"
          >
            {showToken ? workerToken : `${"•".repeat(16)}${workerToken.slice(-4)}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(workerToken);
                  setTokenCopied(true);
                  window.setTimeout(() => setTokenCopied(false), 2000);
                } catch {}
              }}
            >
              {tokenCopied ? <Check size={16} /> : <Copy size={16} />} {tokenCopied ? "Copied" : "Copy token"}
            </Button>
            <Button variant="ghost" aria-pressed={showToken} onClick={() => setShowToken((v) => !v)}>
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />} {showToken ? "Hide" : "Show"}
            </Button>
          </div>
        </Field>

        <div className="grid gap-2 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => {
              onClose();
              openBulk({
                title: "New-home essentials",
                intro: "The jobs most people get round to in the first few months. Untick anything you've done or don't need.",
                candidates: ESSENTIALS,
              });
            }}
            className="inline-flex items-center gap-2 rounded-control px-1 py-2 text-left text-body font-semibold text-ink hover:text-accent-text"
          >
            <ListPlus size={17} /> New-home essentials checklist
          </button>
          <a
            href="/api/export"
            className="inline-flex items-center gap-2 rounded-control px-1 py-2 text-body font-semibold text-ink hover:text-accent-text"
          >
            <Download size={17} /> Download everything (CSV)
          </a>
          <button
            type="button"
            onClick={() => logout().then(() => window.location.replace("/login"))}
            className="inline-flex items-center gap-2 rounded-control px-1 py-2 text-left text-body font-semibold text-ink-2 hover:text-danger"
          >
            <Lock size={17} /> Lock this device
          </button>
        </div>
      </div>
    </dialog>
  );
}
