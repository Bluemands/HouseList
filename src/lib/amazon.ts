import { followRedirects } from "@/lib/fetch-page";

// Amazon turns servers away, so its prices come through Rainforest API
// (rainforestapi.com), which reads the page for us. Set RAINFOREST_API_KEY to
// turn it on: a pasted Amazon link then fills in its real price, and Claude
// can look up and search Amazon UK. Every request spends a credit, so
// answers are kept for a few hours.

const API = "https://api.rainforestapi.com/request";
const TIMEOUT_MS = 20_000;
const CACHE_MS = 6 * 60 * 60_000;
const CACHE_MAX = 300;
export const SEARCH_RESULTS_MAX = 5;

/** Where the household shops, unless a link says otherwise. */
export const DEFAULT_DOMAIN = "amazon.co.uk";

export type AmazonProduct = {
  asin: string;
  title: string;
  url: string;
  /** In the listing's currency (pounds on amazon.co.uk); null when it isn't on sale. */
  price: number | null;
  currency: string | null;
  /** The "RRP" or "Was" price Amazon shows next to it. */
  wasPrice?: number;
  inStock?: boolean;
  availability?: string;
  soldBy?: string;
  rating?: number;
  ratings?: number;
  image?: string;
};

export class AmazonUnavailable extends Error {}

export const amazonEnabled = () => !!process.env.RAINFOREST_API_KEY;

// ---- Links ----

// amazon.co.uk, amazon.com, amazon.com.au…, and the share links that lead there.
const AMAZON_HOST = /(^|\.)amazon\.(?:(?:co|com)\.)?[a-z]{2,3}$/i;
const SHORT_HOSTS = new Set(["amzn.to", "amzn.eu", "amzn.com", "a.co"]);

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

export const isAmazonUrl = (url: string) => AMAZON_HOST.test(hostOf(url));
export const isAmazonShortLink = (url: string) => SHORT_HOSTS.has(hostOf(url).replace(/^www\./, ""));
export const looksLikeAmazon = (url: string) => isAmazonUrl(url) || isAmazonShortLink(url);

/** "amazon.co.uk" for www.amazon.co.uk or smile.amazon.co.uk: the marketplace, as Rainforest names it. */
export function amazonDomain(url: string): string {
  return hostOf(url).match(AMAZON_HOST) ? hostOf(url).replace(/^(?:www|smile|m)\./, "") : DEFAULT_DOMAIN;
}

/** The product's ASIN from any of the shapes Amazon links come in, or null. */
export function asinFromUrl(url: string): string | null {
  if (!isAmazonUrl(url)) return null;
  const u = new URL(url);
  const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin|d)\/([a-z0-9]{10})(?=[/?]|$)/i);
  const asin = m?.[1] ?? u.searchParams.get("asin");
  return asin && /^[a-z0-9]{10}$/i.test(asin) ? asin.toUpperCase() : null;
}

export const productUrl = (asin: string, domain = DEFAULT_DOMAIN) => `https://www.${domain}/dp/${asin}`;

// ---- Reading Rainforest's answers ----

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (v: unknown): Json => (isObject(v) ? v : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Drops the keys with nothing in them, so Claude isn't sent nulls. */
const compact = <T extends Json>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** A `type=product` answer, or null when Amazon has no such product. */
export function fromProduct(data: unknown, domain = DEFAULT_DOMAIN): AmazonProduct | null {
  const p = obj(obj(data).product);
  const asin = str(p.asin);
  const title = str(p.title);
  if (!asin || !title) return null;
  const buybox = obj(p.buybox_winner);
  const price = obj(buybox.price);
  const availability = obj(buybox.availability);
  const fulfillment = obj(buybox.fulfillment);
  const seller = obj(fulfillment.third_party_seller);
  const stock = str(availability.type);
  return compact({
    asin,
    title,
    url: productUrl(asin, domain),
    price: num(price.value) ?? null,
    currency: str(price.currency) ?? null,
    wasPrice: num(obj(buybox.rrp).value),
    inStock: stock ? stock === "in_stock" : undefined,
    availability: str(availability.raw),
    soldBy: str(seller.name) ?? (fulfillment.is_sold_by_amazon ? "Amazon" : str(fulfillment.sold_by)),
    rating: num(p.rating),
    ratings: num(p.ratings_total),
    image: str(obj(p.main_image).link),
  });
}

/** A `type=search` answer: the first few that have a price (within budget), ads after the rest. */
export function fromSearch(
  data: unknown,
  domain = DEFAULT_DOMAIN,
  { maxPrice, limit = SEARCH_RESULTS_MAX }: { maxPrice?: number; limit?: number } = {},
): AmazonProduct[] {
  const results = Array.isArray(obj(data).search_results) ? (obj(data).search_results as unknown[]) : [];
  return results
    .map(obj)
    .sort((a, b) => Number(!!a.sponsored) - Number(!!b.sponsored))
    .flatMap((r) => {
      const asin = str(r.asin);
      const title = str(r.title);
      const price = obj(r.price);
      const value = num(price.value);
      if (!asin || !title || value == null) return [];
      if (maxPrice != null && value > maxPrice) return [];
      const wasPrice = (Array.isArray(r.prices) ? r.prices : []).map(obj).find((p) => p.is_rrp);
      return [
        compact({
          asin,
          title,
          url: productUrl(asin, domain),
          price: value,
          currency: str(price.currency) ?? null,
          wasPrice: num(wasPrice?.value),
          rating: num(r.rating),
          ratings: num(r.ratings_total),
          image: str(r.image),
        }),
      ];
    })
    .slice(0, limit);
}

// ---- Asking Rainforest ----

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function rainforest(params: Record<string, string>): Promise<unknown> {
  const key = process.env.RAINFOREST_API_KEY;
  if (!key) throw new AmazonUnavailable("Amazon prices aren't set up on this app.");
  let res: Response;
  try {
    res = await fetch(`${API}?${new URLSearchParams({ api_key: key, ...params })}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new AmazonUnavailable("Couldn't reach the Amazon price service.");
  }
  const data = obj(await res.json().catch(() => null));
  const info = obj(data.request_info);
  if (!res.ok || info.success !== true) {
    // Out of credits, a bad key, or their side failing: say which, briefly.
    const why = str(info.message) ?? str(data.message) ?? `status ${res.status}`;
    throw new AmazonUnavailable(`The Amazon price service said no (${why.slice(0, 200)}).`);
  }
  return data;
}

/** An Amazon link or bare ASIN → the product page it means: { domain, asin }, or null if it isn't one. */
export async function resolveAmazonLink(link: string): Promise<{ domain: string; asin: string } | null> {
  const raw = link.trim();
  if (/^[a-z0-9]{10}$/i.test(raw)) return { domain: DEFAULT_DOMAIN, asin: raw.toUpperCase() };
  let url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (isAmazonShortLink(url)) {
    // Share links redirect to the product; follow them only as far as Amazon.
    url = await followRedirects(url, (u) => isAmazonUrl(u.href)).catch(() => url);
  }
  const asin = asinFromUrl(url);
  return asin ? { domain: amazonDomain(url), asin } : null;
}

/** The product an Amazon link points at, with its price now; null if Amazon doesn't have it. */
export async function lookupAmazon(link: string): Promise<AmazonProduct | null> {
  const target = await resolveAmazonLink(link);
  if (!target) return null;
  const { domain, asin } = target;
  return cached(`product:${domain}:${asin}`, async () =>
    fromProduct(await rainforest({ type: "product", amazon_domain: domain, asin }), domain),
  );
}

/** Amazon UK's top few results for a search, with prices. */
export async function searchAmazon(query: string, maxPrice?: number): Promise<AmazonProduct[]> {
  const q = query.trim().replace(/\s+/g, " ");
  // Kept whole, so the same search with another budget shares the credit.
  const data = await cached(`search:${DEFAULT_DOMAIN}:${q.toLowerCase()}`, async () =>
    fromSearch(await rainforest({ type: "search", amazon_domain: DEFAULT_DOMAIN, search_term: q }), DEFAULT_DOMAIN, {
      limit: 50,
    }),
  );
  return data.filter((r) => maxPrice == null || (r.price != null && r.price <= maxPrice)).slice(0, SEARCH_RESULTS_MAX);
}
