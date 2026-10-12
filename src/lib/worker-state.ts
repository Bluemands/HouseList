/**
 * Whether a worker is listening, from when it last asked for work. Workers
 * check in every minute or so while running, so a few minutes' silence means
 * the computer it's on is off or asleep.
 */
export function workerState(seenAt: string | null, now = Date.now()): "never" | "active" | "away" {
  if (!seenAt) return "never";
  return now - new Date(seenAt).getTime() < 5 * 60_000 ? "active" : "away";
}
