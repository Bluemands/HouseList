// Paste a product link, get its name and price — read from the page itself,
// no AI. This file is pure (HTML and URL in, result out) so the client can
// share its link helpers and the tests need no network; the fetching, with
// its SSRF guards, lives in fetch-page.ts.

export type Unfurled = {
  title: string | null;
  /** In pounds; only when the page prices in GBP (or plainly a UK site with no currency given). */
  price: number | null;
  currency: string | null;
  siteName: string | null;
  /** The page's canonical address, or where the redirects ended. */
  url: string;
  image?: string;
};

// ---- Links in typed text (shared with the quick-add box) ----

const URL_IN_TEXT = /(?:^|\s)((?:https?:\/\/|www\.)[^\s<>"]+)/i;

/** The first web link in a line of text, and the text without it. */
export function splitLink(text: string): { url: string | null; rest: string } {
  const m = text.match(URL_IN_TEXT);
  if (!m) return { url: null, rest: text };
  // Trailing punctuation belongs to the sentence, not the link.
  const raw = m[1].replace(/[),.!?;:'’]+$/, "");
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) return { url: null, rest: text };
  } catch {
    return { url: null, rest: text };
  }
  const at = text.indexOf(m[1]);
  const rest = (text.slice(0, at) + text.slice(at + m[1].length)).replace(/\s+/g, " ").trim();
  return { url, rest };
}

/** A whole link, typed or pasted on its own, that's worth reading: "https://…" or "www.…". */
export function readableLink(raw: string): string | null {
  const { url, rest } = splitLink(raw.trim());
  return url && !rest ? url : null;
}

/** The site a link is on, as people say it: "screwfix.com". */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A name to fall back on when the page can't be read: the product slug most
 * shops put in their URLs ("/p/mira-sport-electric-shower/8455J" → "Mira
 * sport electric shower"), or failing that, the site.
 */
export function titleFromUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const words = (seg: string) =>
    decodeURIComponent(seg)
      .replace(/\.(html?|prd|aspx?|php)$/i, "")
      .split(/[-_+\s]+/)
      .filter(Boolean);
  const best = u.pathname
    .split("/")
    .map((seg) => {
      try {
        return words(seg);
      } catch {
        return [];
      }
    })
    // A slug is several words, mostly letters; ids and short codes aren't.
    .filter((w) => w.length >= 2 && w.filter((x) => /[a-z]{2}/i.test(x)).length >= 2)
    .sort((a, b) => b.length - a.length)[0];
  if (!best) return `Something from ${siteOf(url)}`;
  // Drop a trailing product number ("…-white-80412962").
  if (best.length > 2 && /^\d{5,}$/.test(best[best.length - 1])) best.pop();
  const title = best.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// ---- Reading the page ----

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  pound: "£",
  euro: "€",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  trade: "™",
  reg: "®",
  copy: "©",
  times: "×",
  frac12: "½",
  deg: "°",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const clean = (s: string | null | undefined) =>
  s ? decodeEntities(decodeEntities(s)).replace(/\s+/g, " ").trim() || null : null;

/** A tag's attributes, lower-cased names: `<meta property="og:title" content="…">`. */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-z_:][-a-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

type Price = { amount: number; currency: string | null };

/** "£1,299.00", "1299", 24.5 → a number (and GBP if it carried a £). */
function readPrice(raw: unknown, currency?: unknown): Price | null {
  if (raw == null) return null;
  let cur = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : null;
  if (cur === "£") cur = "GBP";
  let amount: number;
  if (typeof raw === "number") amount = raw;
  else if (typeof raw === "string") {
    const s = decodeEntities(raw);
    if (s.includes("£")) cur ??= "GBP";
    else if (s.includes("€")) cur ??= "EUR";
    else if (s.includes("$")) cur ??= "USD";
    const m = s.replace(/,(?=\d{3}\b)/g, "").match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    amount = Number(m[0]);
  } else return null;
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000) return null;
  return { amount: Math.round(amount * 100) / 100, currency: cur };
}

// ---- JSON-LD ----

type Json = Record<string, unknown>;

function isType(node: Json, ...types: string[]) {
  const t = node["@type"];
  const list = Array.isArray(t) ? t : [t];
  return list.some((x) => typeof x === "string" && types.includes(x.replace(/^https?:\/\/schema\.org\//, "")));
}

/** Every object in a JSON-LD tree: arrays, @graph and nesting included. */
function* walk(node: unknown, depth = 0): Generator<Json> {
  if (depth > 12 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n, depth + 1);
    return;
  }
  const obj = node as Json;
  yield obj;
  for (const v of Object.values(obj)) if (v && typeof v === "object") yield* walk(v, depth + 1);
}

function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = firstString(x);
      if (s) return s;
    }
  }
  if (v && typeof v === "object") return firstString((v as Json).url ?? (v as Json).contentUrl);
  return null;
}

/** The offers' prices, cheapest first: Offer, AggregateOffer (lowPrice), priceSpecification. */
function offerPrices(offers: unknown): Price[] {
  const out: Price[] = [];
  for (const o of walk(offers)) {
    // "£2.50 per litre" isn't the price of the tin.
    if (o.referenceQuantity) continue;
    const currency = o.priceCurrency;
    for (const key of ["price", "lowPrice"]) {
      const p = readPrice(o[key], currency);
      if (p) out.push(p);
    }
  }
  return out;
}

function fromJsonLd(html: string): { title: string | null; prices: Price[]; image: string | null } {
  const products: Json[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].replace(/^\s*(?:<!--|<!\[CDATA\[)|(?:-->|\]\]>)\s*$/g, "").trim());
    } catch {
      continue;
    }
    for (const node of walk(data)) if (isType(node, "Product", "ProductGroup", "IndividualProduct")) products.push(node);
  }
  // The page's own product is the first with a price; "related products"
  // nested inside it come later and mustn't lend it theirs. A ProductGroup's
  // variants carry their own offers.
  const pricesOf = (node: Json) => [...offerPrices(node.offers), ...offerPrices(node.hasVariant)];
  const main = products.find((p) => pricesOf(p).length) ?? products.find((p) => typeof p.name === "string");
  if (!main) return { title: null, prices: [], image: null };
  return {
    title: typeof main.name === "string" ? main.name : null,
    prices: pricesOf(main).sort((a, b) => a.amount - b.amount),
    image: firstString(main.image),
  };
}

// ---- Titles ----

const brandOf = (s: string) => s.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9&]/g, "");

/** The shop's own name from its address: "screwfix" for www.screwfix.com, "argos" for m.argos.co.uk. */
function hostBrand(url: string): string {
  const host = siteOf(url).toLowerCase();
  const parts = host.split(".");
  return parts[Math.max(0, parts.length - (/\.(co|org|ltd|me|net)\.uk$/.test(host) ? 3 : 2))] ?? host;
}

/**
 * The product name without the shop wrapped round it: " | Screwfix.com",
 * " - B&Q", "| Electric Showers |" categories, Amazon's ": Amazon.co.uk: DIY".
 */
export function cleanTitle(raw: string, url: string, siteName?: string | null): string {
  let t = clean(raw) ?? "";
  t = t.replace(/^amazon\.co\.uk\s*:\s*/i, "").replace(/\s*:\s*amazon\.co\.uk\b.*$/i, "");
  t = t.replace(/^buy\s+/i, "");
  const brands = [hostBrand(url), siteName ? brandOf(siteName) : ""].filter((b) => b.length >= 2);
  const domainish = (seg: string) => /\.(com|co\.uk|uk)$/i.test(seg.trim());
  // A trailing "DIY at B&Q" or "Screwfix.com" mentions the shop; a leading
  // segment must be the shop's name and nothing else, or "Wickes Vinyl Silk
  // Paint - Magnolia" would lose the product.
  const endsWithSite = (seg: string) =>
    seg.split(/\s+/).length <= 4 && (domainish(seg) || brands.some((b) => brandOf(seg).includes(b)));
  const isSite = (seg: string) => domainish(seg) || brands.includes(brandOf(seg));
  for (let i = 0; i < 3; i++) {
    const tail = t.match(/^(.*\S)\s+[|\-–—:·]\s+(.+)$/);
    if (tail && endsWithSite(tail[2])) {
      t = tail[1];
      continue;
    }
    const lead = t.match(/^(.+?)\s+[|\-–—:·]\s+(.*\S)$/);
    if (lead && isSite(lead[1])) {
      t = lead[2];
      continue;
    }
    break;
  }
  // "Product | Category" — a pipe never appears in a product name, but a dash can.
  if (t.includes(" | ")) t = t.split(" | ")[0];
  return t.trim();
}

// ---- The whole page ----

/** Whether a price can be trusted as pounds: GBP, or no currency at all on a UK site. */
function isPounds(price: Price, url: string) {
  if (price.currency) return price.currency === "GBP";
  return /\.uk$/i.test(new URL(url).hostname);
}

function absolute(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function parseProductPage(html: string, pageUrl: string): Unfurled {
  const meta: Record<string, string> = {};
  let canonical: string | null = null;
  const itemprop: Record<string, string> = {};

  for (const m of html.matchAll(/<(meta|link|[a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase();
    if (tag !== "meta" && tag !== "link" && !m[2].includes("itemprop")) continue;
    const a = attrs(m[2]);
    if (tag === "meta") {
      const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
      if (key && a.content != null && !(key in meta)) meta[key] = a.content;
    } else if (tag === "link") {
      if ((a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical")) canonical ??= a.href ?? null;
    }
    // Microdata on any element: <span itemprop="price" content="12.99">.
    const prop = a.itemprop?.toLowerCase();
    if (prop && !(prop in itemprop)) {
      if (a.content != null) itemprop[prop] = a.content;
      else if (tag !== "meta" && tag !== "link") {
        const text = html.slice(m.index! + m[0].length).match(/^([^<]{1,80})</);
        if (text) itemprop[prop] = text[1];
      }
    }
  }

  const ld = fromJsonLd(html);
  const docTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  // Amazon's own markup, for when it serves the real page at all.
  const amazonTitle = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? null;
  const amazonPrice = (() => {
    const at = html.search(/id=["'](?:corePrice(?:Display)?_[a-z_]*feature_div|corePrice_feature_div|apex_desktop)/i);
    if (at < 0) return null;
    return html.slice(at, at + 20_000).match(/class=["']a-offscreen["'][^>]*>([^<]+)</i)?.[1] ?? null;
  })();

  const siteName = clean(meta["og:site_name"]) ?? siteOf(pageUrl);

  const url =
    [absolute(meta["og:url"], pageUrl), absolute(canonical, pageUrl)].find(
      // Only a canonical on the same site; some point at another country's shop.
      (u) => u && siteOf(u) === siteOf(pageUrl),
    ) ?? pageUrl;

  const rawTitle = ld.title ?? meta["og:title"] ?? meta["twitter:title"] ?? amazonTitle ?? docTitle;
  const title = rawTitle ? cleanTitle(rawTitle, pageUrl, siteName) || null : null;

  const candidates: Price[] = [
    ...ld.prices,
    readPrice(meta["product:price:amount"], meta["product:price:currency"]),
    readPrice(meta["og:price:amount"], meta["og:price:currency"]),
    readPrice(itemprop.price, itemprop.pricecurrency),
    readPrice(amazonPrice),
  ].filter((p): p is Price => !!p);
  const price = candidates.find((p) => isPounds(p, pageUrl)) ?? null;
  const currency = price ? "GBP" : (candidates[0]?.currency ?? null);

  const image = absolute(ld.image ?? meta["og:image"] ?? meta["twitter:image"], pageUrl);
  return {
    title,
    price: price?.amount ?? null,
    currency,
    siteName,
    url,
    ...(image ? { image } : {}),
  };
}
