import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api-route";
import { amazonEnabled, looksLikeAmazon, lookupAmazon } from "@/lib/amazon";
import { UnreadablePage, fetchPage } from "@/lib/fetch-page";
import { parseProductPage, siteOf, type Unfurled } from "@/lib/unfurl";

// A pasted product link → its name and price, read from the page. Shops often
// turn servers away (Amazon nearly always), so "couldn't read it" is an
// ordinary answer, not an error: the app falls back to the link alone.
// Amazon links go to the price service instead, when there is one (lib/amazon).

export const runtime = "nodejs";

const bodySchema = z.object({ url: z.string().trim().min(1).max(2000) });

// The same link pasted twice (preview, then add) shouldn't fetch twice.
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; result: Unfurled }>();

function remember(url: string, result: Unfurled) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(url, { at: Date.now(), result });
}

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { url } = parsed.data;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, ...hit.result });

  // If the price service fails, the page itself is still worth a try.
  if (amazonEnabled() && looksLikeAmazon(url)) {
    try {
      const product = await lookupAmazon(url);
      if (product) {
        const result: Unfurled = {
          title: product.title,
          price: product.currency === "GBP" ? product.price : null,
          currency: product.currency,
          siteName: siteOf(product.url),
          url: product.url,
          ...(product.image ? { image: product.image } : {}),
        };
        remember(url, result);
        return NextResponse.json({ ok: true, ...result });
      }
    } catch (err) {
      console.warn("Amazon lookup failed:", err instanceof Error ? err.message : err);
    }
  }

  try {
    const page = await fetchPage(url);
    const result = parseProductPage(page.html, page.url);
    remember(url, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof UnreadablePage ? err.message : "Couldn't read that page";
    const refused = err instanceof UnreadablePage && err.refused;
    return NextResponse.json({ ok: false, error: message, url }, { status: refused ? 400 : 200 });
  }
}
