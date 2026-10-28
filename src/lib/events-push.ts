import { clip, notifyLater } from "@/lib/push";
import { EVENT_REPEAT_LABELS, formatTime, type EventDTO } from "@/lib/events";

const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const showDay = (day: string) => dayLabel.format(new Date(`${day}T12:00:00Z`));

/** "/?day=…": the app opens the calendar on that day. */
export const dayUrl = (day: string) => `/?day=${day}`;

/** The other phone hears what's been put on the calendar. */
export function notifyEventAdded(event: EventDTO) {
  const when = [
    event.endDate && event.endDate > event.date ? `${showDay(event.date)} to ${showDay(event.endDate)}` : showDay(event.date),
    event.time && formatTime(event.time),
    event.repeat && EVENT_REPEAT_LABELS[event.repeat].toLowerCase(),
  ]
    .filter(Boolean)
    .join(", ");
  notifyLater(
    { title: `${event.addedBy} added ${clip(event.title, 60)}`, body: when, url: dayUrl(event.date), tag: `event-${event.id}` },
    { except: event.addedBy },
  );
}
