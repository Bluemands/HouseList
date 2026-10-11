import { ROOMS, type Kind, type Priority, type Repeat, type Room } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { addDays, toDayString, today } from "@/lib/format";

// The quick-add box: one line of plain English becomes a filed item.
//   "Fix bathroom tap £40 tomorrow !must @Sam"
// Money, dates, priority and people are pulled out of the title; a room
// mentioned in passing ("bathroom") is recognised but left in the title,
// while an explicit "#kitchen" is removed.

export type Parsed = {
  title: string;
  kind: Kind;
  room: Room | null;
  priority: Priority | null;
  estimatedPrice: number | null;
  estimateMax: number | null;
  dueDate: string | null;
  assignee: string | null;
  repeat: Repeat | null;
};

function parseRepeat(text: string): { repeat: Repeat; match: RegExpMatchArray } | null {
  const m = text.match(
    /(?:^|\s)(every\s+(?:(\d+|other|two|three|six|twelve)\s+)?(week|month|year)s?|weekly|monthly|quarterly|yearly|annually|twice\s+a\s+year)(?=\s|$)/i,
  );
  if (!m) return null;
  const phrase = m[1].toLowerCase();
  const words: Record<string, number> = { other: 2, two: 2, three: 3, six: 6, twelve: 12 };
  const n = m[2] ? (words[m[2].toLowerCase()] ?? Number(m[2])) : 1;
  const unit = m[3]?.toLowerCase();
  let repeat: Repeat = "MONTHLY";
  if (phrase === "weekly" || unit === "week") repeat = "WEEKLY";
  else if (phrase === "quarterly" || (unit === "month" && n === 3)) repeat = "QUARTERLY";
  else if (phrase.startsWith("twice") || (unit === "month" && n === 6)) repeat = "TWICE_YEARLY";
  else if (phrase === "yearly" || phrase === "annually" || unit === "year" || (unit === "month" && n === 12))
    repeat = "YEARLY";
  return { repeat, match: m };
}

const BUY_WORDS = /^(buy|get|order|pick up|grab)\b/i;

/** A step that's really shopping: "Buy faceplates", or a product link with a price. */
export function isShoppingStep(step: { text: string; link: string | null; cost: number | null }): boolean {
  return BUY_WORDS.test(step.text.trim()) || (!!step.link && step.cost != null);
}
const TASK_WORDS =
  /^(fix|paint|repair|install|fit|clean|call|book|sort|clear|remove|replace|hang|build|assemble|measure|tidy|empty|organise|organize|decorate|service|sand|seal|tile|plaster|rewire|treat|bleed|move|change|check|ring|email|find|research|plan)\b/i;
// Work someone does, wherever it falls: "Boiler service", "Chimney sweep".
const JOB_NOUNS =
  /\b(service|servicing|repairs?|installation|fitting|survey|inspection|cleaning|sweep|quote|visit|check-?up|callout|call-out)\b/i;

/** Typed as a job ("Install fire alarms"), even if a product link comes with it. */
export function startsWithJobWord(title: string): boolean {
  return TASK_WORDS.test(title.trim());
}

const WEEKDAYS =["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// A month's name or its usual short form, and nothing longer: "2 decking
// boards" and "20 marble tiles" aren't dates.
const MONTH_NAME = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const monthIndex = (name: string) => MONTHS.indexOf(name.toLowerCase().slice(0, 3));

function money(raw: string, k?: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return k ? n * 1000 : n;
}

function nextWeekday(target: number, base = new Date()): string {
  const diff = (target - base.getDay() + 7) % 7 || 7;
  return toDayString(new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff));
}

function parseDue(text: string): { day: string; match: RegExpMatchArray } | null {
  const now = today();
  const pre = String.raw`(?:^|\s)(?:(?:by|on|due|before|for)\s+)?`;

  let m = text.match(new RegExp(pre + String.raw`(today|tonight)\b`, "i"));
  if (m) return { day: now, match: m };
  m = text.match(new RegExp(pre + String.raw`(tomorrow|tmrw|tmw)\b`, "i"));
  if (m) return { day: addDays(now, 1), match: m };
  m = text.match(new RegExp(pre + String.raw`(?:this\s+)?weekend\b`, "i"));
  if (m) return { day: nextWeekday(6, new Date(Date.now() - 86_400_000)), match: m };
  m = text.match(new RegExp(pre + String.raw`next\s+week\b`, "i"));
  if (m) return { day: nextWeekday(1), match: m };
  m = text.match(new RegExp(pre + String.raw`(?:next|end of( the)?)\s+month\b`, "i"));
  if (m) {
    const d = new Date();
    const end = /end/i.test(m[0]);
    return {
      day: toDayString(end ? new Date(d.getFullYear(), d.getMonth() + 1, 0) : new Date(d.getFullYear(), d.getMonth() + 1, 1)),
      match: m,
    };
  }
  m = text.match(new RegExp(pre + String.raw`end\s+of\s+(?:the\s+)?week\b`, "i"));
  if (m) return { day: nextWeekday(0, new Date(Date.now() - 86_400_000)), match: m };
  // "in 3 days", "in a week", "in a fortnight", "in 2 months"
  m = text.match(/(?:^|\s)in\s+(\d{1,2}|a|an|one|two|three|four|six)\s+(days?|weeks?|fortnights?|months?)\b/i);
  if (m) {
    const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, six: 6 };
    const n = words[m[1].toLowerCase()] ?? Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.startsWith("month")) {
      const d = new Date();
      const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
      return { day: toDayString(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))), match: m };
    }
    return { day: addDays(now, n * (unit.startsWith("fortnight") ? 14 : unit.startsWith("week") ? 7 : 1)), match: m };
  }

  // "next friday" is the Friday of next week; "this friday" is the coming one.
  const day = String.raw`(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*`;
  m = text.match(new RegExp(pre + String.raw`(next|this)\s+` + day + String.raw`\b`, "i"));
  if (m) {
    const target = WEEKDAYS.findIndex((w) => w.startsWith(m![2].toLowerCase().slice(0, 3)));
    if (m[1].toLowerCase() === "this") return { day: target === new Date().getDay() ? now : nextWeekday(target), match: m };
    const base = new Date();
    const nextMonday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (((8 - base.getDay()) % 7) || 7));
    return { day: toDayString(new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + ((target + 6) % 7))), match: m };
  }
  // Weekdays need a preposition unless spelled out in full, so "Sat nav" or
  // "Sun lounger" don't get a due date.
  m = text.match(new RegExp(String.raw`(?:^|\s)(?:by|on|due|before)\s+` + day + String.raw`\b`, "i"));
  if (m) return { day: nextWeekday(WEEKDAYS.findIndex((w) => w.startsWith(m![1].toLowerCase().slice(0, 3)))), match: m };
  m = text.match(new RegExp(String.raw`(?:^|\s)(?:(?:by|on|due|before)\s+)?(${WEEKDAYS.join("|")})\b`, "i"));
  if (m) return { day: nextWeekday(WEEKDAYS.indexOf(m[1].toLowerCase())), match: m };

  // "12 oct", "oct 12", "12/10"
  m = text.match(new RegExp(pre + String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+` + MONTH_NAME + String.raw`\b`, "i"));
  if (m) return { day: futureDate(Number(m[1]), monthIndex(m[2])), match: m };
  m = text.match(new RegExp(pre + MONTH_NAME + String.raw`\s+(\d{1,2})(?:st|nd|rd|th)?\b`, "i"));
  if (m) return { day: futureDate(Number(m[2]), monthIndex(m[1])), match: m };
  // "12/11" — but not "1/2 inch" or "3/4 in".
  m = text.match(
    new RegExp(pre + String.raw`(\d{1,2})/(\d{1,2})\b(?!/)(?!\s*(?:inch|in\b|"|mm|cm|m\b|ft|metre|meter))`, "i"),
  );
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { day: futureDate(Number(m[1]), Number(m[2]) - 1), match: m };
  }
  // "on the 15th" — the next time that day of the month comes round.
  m = text.match(/(?:^|\s)(?:(?:by|on|due|before)\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
    const d = new Date();
    const n = Number(m[1]);
    const inMonth = (offset: number) => {
      const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).getDate();
      return toDayString(new Date(d.getFullYear(), d.getMonth() + offset, Math.min(n, last)));
    };
    const thisMonth = inMonth(0);
    return { day: thisMonth >= now ? thisMonth : inMonth(1), match: m };
  }
  return null;
}

/** The next occurrence of a day/month, rolling into next year if it's passed. */
function futureDate(day: number, month: number): string {
  const now = new Date();
  let d = new Date(now.getFullYear(), month, day);
  if (toDayString(d) < today()) d = new Date(now.getFullYear() + 1, month, day);
  return toDayString(d);
}

const ROOM_MATCHERS = ROOMS.flatMap((room) =>
  ROOM_PAINT[room].aliases.map((alias) => ({ room, alias })),
).sort((a, b) => b.alias.length - a.alias.length);

function findRoom(text: string): { room: Room; explicit: RegExpMatchArray | null } | null {
  // Explicit tag: "#kitchen", "#bathroom2", "#spare-room-1", "#sitting room"
  const tag = text.match(/(?:^|\s)#([a-z0-9-]+)((?:\s+[a-z0-9]+){0,2})/i);
  if (tag) {
    const words = [tag[1], ...tag[2].trim().split(/\s+/).filter(Boolean)];
    const norm = (s: string) => s.toLowerCase().replace(/-/g, " ").replace(/([a-z])(\d)$/, "$1 $2");
    // Take as many following words as complete a room's name, so none are
    // left behind in the title; failing that, the tag alone may be a prefix.
    for (let n = words.length; n >= 1; n--) {
      const wanted = norm(words.slice(0, n).join(" "));
      const hit = ROOM_MATCHERS.find((r) => r.alias === wanted || (n === 1 && r.alias.startsWith(wanted)));
      if (hit) {
        const explicit = text.match(new RegExp(String.raw`(?:^|\s)#${words.slice(0, n).join(String.raw`\s+`)}(?=\s|$)`, "i"));
        return { room: hit.room, explicit };
      }
    }
  }
  // Rooms named in passing. Longest names first, each blanked out once found,
  // so "bathroom 2" isn't also read as "bathroom". A job that names more than
  // one ("alarms in the hallway, landing and kitchen") is for the whole house.
  let lower = text.toLowerCase();
  const named = new Set<Room>();
  for (const { room, alias } of ROOM_MATCHERS) {
    const re = new RegExp(String.raw`(^|[^a-z])${alias}(?=[^a-z0-9]|$)`, "g");
    if (!re.test(lower)) continue;
    named.add(room);
    lower = lower.replace(re, (_, before: string) => before + " ".repeat(alias.length));
  }
  if (named.size > 1) return { room: "WHOLE_HOUSE", explicit: null };
  return named.size ? { room: [...named][0], explicit: null } : null;
}

// Products that say which room they're for when their name doesn't mention
// one: "Mira Sport electric shower" goes in the bathroom.
const PRODUCT_ROOMS: [RegExp, Room][] = [
  [/\b(shower|toilet|basin|bathtub|towel rail|cistern|vanity unit|bath mat)s?\b/i, "BATHROOM_1"],
  [/\b(oven|hob|cooker|cooker hood|extractor|dishwasher|fridge|freezer|kettle|toaster|microwave|worktop)s?\b/i, "KITCHEN"],
  [/\b(lawn ?mower|strimmer|hedge trimmer|hosepipe|garden hose|patio|decking|shed|planter|bird feeder)s?\b/i, "BACK_GARDEN"],
  [/\b(mattress|bed frame|bedside table|wardrobe|duvet)s?\b/i, "MASTER_BEDROOM"],
  [/\b(sofa|armchair|coffee table|tv stand)s?\b/i, "SITTING_ROOM"],
  [/\b(doormat|shoe rack|coat rack|coat hooks?)\b/i, "HALLWAY"],
];

/** The room a product's name points to, if any — for things added from a link. */
export function guessRoom(text: string): Room | null {
  return findRoom(text)?.room ?? PRODUCT_ROOMS.find(([re]) => re.test(text))?.[1] ?? null;
}

// Money: "£40", "£1.2k", "£100-150", "£100 to £150", "40 quid"
function findPrice(text: string) {
  return (
    text.match(/(?:^|\s)£\s?(\d[\d,]*(?:\.\d{1,2})?)(k)?(?:\s?(?:-|–|to)\s?£?(\d[\d,]*(?:\.\d{1,2})?)(k)?)?(?=\s|$)/i) ??
    text.match(/(?:^|\s)(\d[\d,]*(?:\.\d{1,2})?)(k)?\s?(?:quid|pounds|gbp)\b()()/i)
  );
}

/** Pasted text as one line per entry, without bullets, numbers or checkboxes. */
export function pastedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)]|\[[ xX]?\])\s*/, "").trim())
    .filter(Boolean);
}

/** A step as typed: "Deposit £200" is the step "Deposit" costing £200 (a range counts at its top). */
export function parseStep(line: string): { text: string; cost: number | null } {
  const text = ` ${line} `;
  const price = findPrice(text);
  if (!price) return { text: line.trim(), cost: null };
  const low = money(price[1], price[2]);
  const high = price[3] ? money(price[3], price[4] ?? price[2]) : low;
  const rest = text.replace(price[0], " ").replace(/\s+/g, " ").trim();
  // A step that's only a price keeps its words as typed.
  return rest ? { text: rest, cost: Math.max(low, high) } : { text: line.trim(), cost: null };
}

export function parseQuickAdd(input: string, members: string[] = []): Parsed {
  let text = ` ${input} `;
  const strip = (m: RegExpMatchArray | null) => {
    if (m) text = text.replace(m[0], " ");
  };

  // Money: "£40", "£1.2k", "£100-150", "£100 to £150", "40 quid"
  let estimatedPrice: number | null = null;
  let estimateMax: number | null = null;
  const price = findPrice(text);
  if (price) {
    estimatedPrice = money(price[1], price[2]);
    if (price[3]) estimateMax = money(price[3], price[4] ?? price[2]);
    if (estimateMax != null && estimateMax < estimatedPrice) [estimatedPrice, estimateMax] = [estimateMax, estimatedPrice];
    strip(price);
  }

  // Priority: "!" or "!!" or "!must", "!want", "!someday"
  let priority: Priority | null = null;
  const bang = text.match(/(?:^|\s)!(!|must|urgent|want|like|would|nice|someday|later|maybe)?(?=\s|$)/i);
  if (bang) {
    const word = (bang[1] ?? "").toLowerCase();
    priority = /^(someday|later|maybe)$/.test(word)
      ? "SOMEDAY"
      : /^(want|like|would|nice)$/.test(word)
        ? "WOULD_LIKE"
        : "MUST_HAVE";
    strip(bang);
  }
  const asap = text.match(/(?:^|\s)asap(?=[\s!.]|$)/i);
  if (asap) {
    priority ??= "MUST_HAVE";
    strip(asap);
  }

  // Person: "@Sam", "@both", "@electrician"
  let assignee: string | null = null;
  const at = text.match(/(?:^|\s)@([\p{L}][\p{L}'-]*)/u);
  if (at) {
    const raw = at[1];
    const member = members.find((m) => m.toLowerCase() === raw.toLowerCase());
    assignee = member ?? (raw.toLowerCase() === "both" ? "Both" : raw[0].toUpperCase() + raw.slice(1));
    strip(at);
  }

  // Before dates, so "every week" isn't half-read as "next week".
  const every = parseRepeat(text);
  if (every) strip(every.match);

  let dueDate: string | null = null;
  const due = parseDue(text);
  if (due) {
    dueDate = due.day;
    strip(due.match);
  }

  const roomHit = findRoom(text);
  if (roomHit?.explicit) strip(roomHit.explicit);

  let title = text.replace(/\s+/g, " ").trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const kind: Kind = BUY_WORDS.test(title)
    ? "BUY"
    : TASK_WORDS.test(title) || JOB_NOUNS.test(title)
      ? "TASK"
      : estimatedPrice != null
        ? "BUY"
        : "TASK";

  return {
    title,
    kind,
    room: roomHit?.room ?? null,
    priority,
    estimatedPrice,
    estimateMax,
    dueDate,
    assignee,
    repeat: every?.repeat ?? null,
  };
}

const FILLER = new Set(["the", "and", "for", "with", "from", "into", "our", "new", "some"]);

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !FILLER.has(w))
      .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)),
  );
}

/**
 * Whether two titles are the same thing worded differently: "Install fire
 * alarms, 1 in office, 1 in hallway" and "Install fire alarms, 1 office,
 * 1 hallway". Most of their words must be shared, so "Paint hallway" and
 * "Paint hallway ceiling" stay two jobs.
 */
export function sameThing(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const x = titleWords(a);
  const y = titleWords(b);
  if (x.size < 2 || y.size < 2) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (x.size + y.size - shared) >= 0.75;
}
