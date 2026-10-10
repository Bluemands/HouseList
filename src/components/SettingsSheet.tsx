"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Check, Copy, Download, ListPlus, Lock, X } from "lucide-react";
import { ESSENTIALS } from "@/lib/essentials";
import { useStore } from "@/lib/store";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { logout } from "@/lib/api-client";
import { Button, Field, Segmented, inputClass } from "@/components/ui";

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

export function SettingsSheet({ open, onClose, onSwitchUser }: { open: boolean; onClose: () => void; onSwitchUser: () => void }) {
  const { me, settings, saveSettings, calendarPath, openBulk } = useStore();
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [movedIn, setMovedIn] = useState(settings.movedInOn ?? "");
  const ref = useRef<HTMLDialogElement>(null);
  const dragHandlers = useSheetDrag(onClose);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setTheme(readTheme());
      setMovedIn(settings.movedInOn ?? "");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, settings.movedInOn]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="settings-title"
      className="sheet m-0 inset-x-0 top-auto bottom-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-[22px] bg-surface p-0 text-ink shadow-sheet lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[420px] lg:rounded-none lg:rounded-l-[22px]"
    >
      <div {...dragHandlers} className="relative flex touch-none items-center justify-between px-5 pt-5">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        <h2 id="settings-title" className="text-[20px] font-bold">
          Settings
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-sunken">
          <X size={19} />
        </button>
      </div>

      <div className="grid gap-6 px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Field label="You are">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span className="text-[16px] font-semibold">{me}</span>
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

        {settings.members.length > 0 && (
          <Field label="Household">
            <p className="text-[15px] text-ink-2">{settings.members.join(", ")}</p>
          </Field>
        )}

        <Field
          label="Due dates in your calendar"
          hint="Subscribe once on each phone and everything with a due date shows up, with a 9am reminder on the day. Keep the link private."
        >
          <div className="flex flex-wrap gap-2">
            <a
              href={`webcal://${typeof window === "undefined" ? "" : window.location.host}${calendarPath}`}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              <CalendarPlus size={16} /> Subscribe
            </a>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}${calendarPath}`);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}
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
            className="inline-flex items-center gap-2 rounded-[10px] px-1 py-2 text-left text-[15px] font-semibold text-ink hover:text-accent-text"
          >
            <ListPlus size={17} /> New-home essentials checklist
          </button>
          <a
            href="/api/export"
            className="inline-flex items-center gap-2 rounded-[10px] px-1 py-2 text-[15px] font-semibold text-ink hover:text-accent-text"
          >
            <Download size={17} /> Download everything (CSV)
          </a>
          <button
            type="button"
            onClick={() => logout().then(() => window.location.replace("/login"))}
            className="inline-flex items-center gap-2 rounded-[10px] px-1 py-2 text-left text-[15px] font-semibold text-ink-2 hover:text-danger"
          >
            <Lock size={17} /> Lock this device
          </button>
        </div>
      </div>
    </dialog>
  );
}
