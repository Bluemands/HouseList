import { describe, expect, it } from "vitest";
import {
  amazonDomain,
  asinFromUrl,
  fromProduct,
  fromSearch,
  isAmazonShortLink,
  looksLikeAmazon,
  resolveAmazonLink,
} from "@/lib/amazon";

describe("Amazon links", () => {
  it("finds the ASIN in the shapes Amazon links come in", () => {
    expect(asinFromUrl("https://www.amazon.co.uk/X-Sense-Interlinked-Detectors/dp/B0CCD8Y929/ref=sr_1_1?keywords=x")).toBe(
      "B0CCD8Y929",
    );
    expect(asinFromUrl("https://www.amazon.co.uk/dp/b0ccd8y929")).toBe("B0CCD8Y929");
    expect(asinFromUrl("https://www.amazon.co.uk/gp/product/B0CCD8Y929?psc=1")).toBe("B0CCD8Y929");
    expect(asinFromUrl("https://www.amazon.co.uk/gp/aw/d/B0CCD8Y929")).toBe("B0CCD8Y929");
    expect(asinFromUrl("https://smile.amazon.com/dp/B0CCD8Y929")).toBe("B0CCD8Y929");
  });

  it("finds nothing in other pages or other sites", () => {
    expect(asinFromUrl("https://www.amazon.co.uk/s?k=smoke+alarm")).toBeNull();
    expect(asinFromUrl("https://www.screwfix.com/dp/B0CCD8Y929")).toBeNull();
    expect(asinFromUrl("https://www.amazon.co.uk/dp/B0CCD8Y92")).toBeNull();
    expect(asinFromUrl("not a link")).toBeNull();
  });

  it("names the marketplace, defaulting to the UK", () => {
    expect(amazonDomain("https://www.amazon.co.uk/dp/B0CCD8Y929")).toBe("amazon.co.uk");
    expect(amazonDomain("https://smile.amazon.com/dp/B0CCD8Y929")).toBe("amazon.com");
    expect(amazonDomain("https://amzn.eu/d/abc1234")).toBe("amazon.co.uk");
  });

  it("knows share links, and isn't fooled by look-alikes", () => {
    expect(isAmazonShortLink("https://amzn.eu/d/abc1234")).toBe(true);
    expect(looksLikeAmazon("https://amzn.to/3xyz")).toBe(true);
    expect(looksLikeAmazon("https://www.amazon.co.uk.evil.example/dp/B0CCD8Y929")).toBe(false);
    expect(looksLikeAmazon("https://notamazon.co.uk/dp/B0CCD8Y929")).toBe(false);
  });

  it("takes a bare ASIN or a link without https://, no network needed", async () => {
    expect(await resolveAmazonLink("b0ccd8y929")).toEqual({ domain: "amazon.co.uk", asin: "B0CCD8Y929" });
    expect(await resolveAmazonLink("www.amazon.co.uk/dp/B0CCD8Y929")).toEqual({ domain: "amazon.co.uk", asin: "B0CCD8Y929" });
    expect(await resolveAmazonLink("https://www.screwfix.com/p/x/123")).toBeNull();
  });
});

describe("fromProduct", () => {
  // Trimmed from a real amazon.co.uk answer.
  const answer = {
    request_info: { success: true },
    product: {
      title: "X-Sense Interlinked Smoke and Heat Alarm Bundle, 10-Year Battery",
      asin: "B0CCD8Y929",
      link: "https://www.amazon.co.uk/X-Sense-Interlinked-Detectors-Compliant-HS21/dp/B0CCD8Y929",
      rating: 4.4,
      ratings_total: 766,
      main_image: { link: "https://m.media-amazon.com/images/I/61lDrWGx9IL.jpg" },
      buybox_winner: {
        price: { symbol: "£", value: 47.99, currency: "GBP", raw: "£47.99" },
        rrp: { symbol: "£", value: 59.99, currency: "GBP", raw: "£59.99" },
        availability: { type: "in_stock", raw: "In stock", dispatch_days: 1 },
        fulfillment: { type: "p2", third_party_seller: { name: "X-SENSE-UK" } },
      },
    },
  };

  it("reads the price, stock and seller, with a clean link", () => {
    expect(fromProduct(answer)).toEqual({
      asin: "B0CCD8Y929",
      title: "X-Sense Interlinked Smoke and Heat Alarm Bundle, 10-Year Battery",
      url: "https://www.amazon.co.uk/dp/B0CCD8Y929",
      price: 47.99,
      currency: "GBP",
      wasPrice: 59.99,
      inStock: true,
      availability: "In stock",
      soldBy: "X-SENSE-UK",
      rating: 4.4,
      ratings: 766,
      image: "https://m.media-amazon.com/images/I/61lDrWGx9IL.jpg",
    });
  });

  it("gives a product with no offer a null price, and nothing for a missing product", () => {
    const unavailable = { product: { ...answer.product, buybox_winner: undefined } };
    expect(fromProduct(unavailable)).toMatchObject({ price: null, currency: null });
    expect(fromProduct({ request_info: { success: true }, message: "Product not found." })).toBeNull();
    expect(fromProduct(null)).toBeNull();
  });
});

describe("fromSearch", () => {
  const result = (asin: string, value: number | null, extra: Record<string, unknown> = {}) => ({
    asin,
    title: `Thing ${asin}`,
    link: `https://www.amazon.co.uk/thing/dp/${asin}/ref=sr_1_1?dib=long`,
    ...(value == null ? {} : { price: { value, currency: "GBP" } }),
    prices: value == null ? [] : [{ value, currency: "GBP" }, { value: value + 10, is_rrp: true }],
    rating: 4.5,
    ...extra,
  });
  const answer = {
    search_results: [
      result("AD00000001", 10, { sponsored: true }),
      result("A000000001", 47.99),
      result("A000000002", null),
      result("A000000003", 115.99),
      result("A000000004", 30.99),
    ],
  };

  it("keeps priced results, ads last, with clean links", () => {
    const found = fromSearch(answer);
    expect(found.map((r) => r.asin)).toEqual(["A000000001", "A000000003", "A000000004", "AD00000001"]);
    expect(found[0]).toMatchObject({ url: "https://www.amazon.co.uk/dp/A000000001", price: 47.99, wasPrice: 57.99 });
  });

  it("leaves out anything over budget, and stops at the limit", () => {
    expect(fromSearch(answer, "amazon.co.uk", { maxPrice: 50 }).map((r) => r.asin)).toEqual([
      "A000000001",
      "A000000004",
      "AD00000001",
    ]);
    expect(fromSearch(answer, "amazon.co.uk", { limit: 2 })).toHaveLength(2);
    expect(fromSearch({})).toEqual([]);
  });
});
