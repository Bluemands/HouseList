"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { isIphoneInBrowser, pushState, turnOffPush, turnOnPush, type PushState } from "@/lib/push-client";
import { Button, Field } from "@/components/ui";

const WHAT =
  "When the other of you adds, finishes or posts an update on something, when Claude answers a question you asked, and each morning when something's due. Just this phone; turn it on on each.";

/** Notifications on this phone: on, off, or why they can't be. */
export function NotificationsField({ me }: { me: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  async function change(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      setState(await (on ? turnOnPush(me) : turnOffPush()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return null;

  if (state === "unsupported") {
    return (
      <Field label="Notifications">
        <p className="text-[14px] text-ink-2">
          {isIphoneInBrowser()
            ? "On iPhone, add the app to your home screen first (Share, then Add to Home Screen), and turn them on from there."
            : "This browser can't show notifications."}
        </p>
      </Field>
    );
  }

  if (state === "blocked") {
    return (
      <Field label="Notifications">
        <p className="text-[14px] text-ink-2">
          They&apos;re blocked for this app. Allow notifications for it in your phone&apos;s or browser&apos;s site settings,
          then come back here.
        </p>
      </Field>
    );
  }

  return (
    <Field label="Notifications" hint={WHAT}>
      <div className="flex flex-wrap items-center gap-3">
        {state === "on" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-text">
              <Bell size={16} aria-hidden="true" /> On for this phone
            </span>
            <Button variant="ghost" disabled={busy} onClick={() => change(false)} className="px-3 py-1.5">
              <BellOff size={15} aria-hidden="true" /> Turn off
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => change(true)}>
            <Bell size={16} aria-hidden="true" /> {busy ? "Turning on…" : "Turn on notifications"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </Field>
  );
}
