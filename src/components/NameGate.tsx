"use client";

import { FormEvent, useState } from "react";
import { ROOM_PAINT } from "@/lib/rooms";
import { Button, inputClass } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";

export function NameGate({ members, onSubmit }: { members: string[]; onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(members.length === 0);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Pop your name in so we know who added what");
      return;
    }
    // "connor" typed on a new phone is the Connor already here, not a third person.
    onSubmit(members.find((m) => m.toLowerCase() === trimmed.toLowerCase()) ?? trimmed);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[380px]">
        <Wordmark className="mb-8" />
        <h1 className="text-headline leading-tight font-bold tracking-[-0.02em]">Who&apos;s this?</h1>
        <p className="mt-1 text-body text-ink-2">
          So the list knows who added, bought and finished what. Remembered on this device.
        </p>

        {members.length > 0 && (
          <div className="mt-6 grid gap-2">
            {members.map((m, i) => {
              const room = (["KITCHEN", "SPARE_ROOM_2", "BATHROOM_2", "SITTING_ROOM"] as const)[i % 4];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSubmit(m)}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left text-title font-semibold transition-colors hover:border-accent"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 place-items-center rounded-control text-title font-bold"
                    style={{ background: ROOM_PAINT[room].hex, color: ROOM_PAINT[room].ink }}
                  >
                    {m.charAt(0).toUpperCase()}
                  </span>
                  {m}
                </button>
              );
            })}
            {!typing && (
              <button
                type="button"
                onClick={() => setTyping(true)}
                className="rounded-2xl border border-dashed border-line-strong p-3.5 text-body font-semibold text-ink-2 hover:text-ink"
              >
                Someone new
              </button>
            )}
          </div>
        )}

        {typing && (
          <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-3">
            <label htmlFor="name" className="text-meta font-semibold text-ink-2">
              Your name
            </label>
            <input
              id="name"
              maxLength={60}
              autoFocus
              autoComplete="given-name"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "name-error" : undefined}
              className={inputClass}
            />
            {error && (
              <p id="name-error" role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" className="mt-1 py-3">
              Let&apos;s go
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
