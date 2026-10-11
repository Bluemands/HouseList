import { describe, expect, it } from "vitest";
import { cleanTitle, decodeEntities, parseProductPage, splitLink, titleFromUrl } from "@/lib/unfurl";
import { checkUrl, isPrivateAddress } from "@/lib/fetch-page";

// Small, cut-down copies of how each shop marks up a product page.
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

const SCREWFIX = `<!DOCTYPE html><html lang="en-GB"><head>
<title>Mira Sport Max 9.8kW Electric Shower White / Chrome | Electric Showers | Screwfix.com</title>
<meta property="og:title" content="Mira Sport Max 9.8kW Electric Shower White / Chrome | Screwfix.com">
<meta property="og:site_name" content="Screwfix">
<link rel="canonical" href="https://www.screwfix.com/p/mira-sport-max-9-8kw-electric-shower-white-chrome/8455J">
${ld({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Mira Sport Max 9.8kW Electric Shower White &amp; Chrome",
  sku: "8455J",
  image: ["https://media.screwfix.com/is/image/ae235/8455J_P"],
  offers: { "@type": "Offer", price: "229.99", priceCurrency: "GBP", availability: "https://schema.org/InStock" },
})}
</head><body><h1>Mira Sport Max</h1></body></html>`;

const BQ = `<html><head>
<title>GoodHome Cavally Ceramic Close-coupled Toilet with Soft close seat | DIY at B&amp;Q</title>
<meta property="og:title" content="GoodHome Cavally Ceramic Close-coupled Toilet with Soft close seat | DIY at B&amp;Q" />
<meta property="og:url" content="https://www.diy.com/departments/goodhome-cavally-toilet/5059340092133_BQ.prd" />
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"BreadcrumbList","itemListElement":[]},
  {"@type":"Product","name":"GoodHome Cavally Ceramic Close-coupled Toilet with Soft close seat",
   "offers":[{"@type":"Offer","price":179,"priceCurrency":"GBP"}],
   "isRelatedTo":[{"@type":"Product","name":"Toilet brush","offers":{"@type":"Offer","price":4,"priceCurrency":"GBP"}}]}
]}
</script></head><body></body></html>`;

const ARGOS = `<html><head>
<title>Buy Argos Home Ava Fabric 3 Seater Sofa - Grey | Sofas | Argos</title>
<meta property="og:site_name" content="Argos">
<meta name="twitter:title" content="Argos Home Ava Fabric 3 Seater Sofa - Grey">
<script type="application/ld+json">[{"@type":"WebSite","name":"Argos"},[{"@type":"Product","name":"Argos Home Ava Fabric 3 Seater Sofa - Grey","offers":{"@type":"AggregateOffer","lowPrice":"£349.00","highPrice":"£399.00","offerCount":2}}]]</script>
</head><body></body></html>`;

const IKEA = `<html><head>
<title>MALM Chest of 6 drawers, white, 80x123 cm - IKEA</title>
<meta property="og:title" content="MALM Chest of 6 drawers, white, 80x123 cm - IKEA" />
<meta property="og:image" content="/images/products/malm-chest.jpg" />
<meta property="product:price:amount" content="150" />
<meta property="product:price:currency" content="GBP" />
</head><body></body></html>`;

const AMAZON = `<html><head>
<title>Bosch Cordless Lawnmower CityMower 18V-32-300 : Amazon.co.uk: Garden</title>
<meta name="title" content="Bosch Cordless Lawnmower CityMower 18V-32-300 : Amazon.co.uk: Garden">
</head><body>
<span id="productTitle" class="a-size-large">   Bosch Cordless Lawnmower CityMower 18V-32-300   </span>
<div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">£189.99</span></span></div>
<div id="similar"><span class="a-offscreen">£9.99</span></div>
</body></html>`;

const AMAZON_BLOCKED = `<html><head><title>Amazon.co.uk</title></head><body>
<h4>Enter the characters you see below</h4></body></html>`;

const WICKES = `<html><head>
<title>Wickes Vinyl Silk Emulsion Paint - Magnolia 5L | Wickes.co.uk</title>
<meta property="og:title" content="Wickes Vinyl Silk Emulsion Paint - Magnolia 5L | Wickes.co.uk">
</head><body>
<div itemscope itemtype="https://schema.org/Product">
<span itemprop="price" content="22.00">£22</span>
<meta itemprop="priceCurrency" content="GBP">
</div></body></html>`;

const TOOLSTATION = `<html><head>
<title>Dewalt DCD796 18V XR Brushless Combi Drill | Toolstation</title>
${ld({
  "@context": "http://schema.org",
  "@type": ["Product"],
  name: "Dewalt DCD796 18V XR Brushless Combi Drill",
  offers: [
    {
      "@type": "Offer",
      priceSpecification: [
        { "@type": "UnitPriceSpecification", price: 119.98, priceCurrency: "GBP" },
        { "@type": "UnitPriceSpecification", price: 99.98, priceCurrency: "GBP", priceType: "https://schema.org/SalePrice" },
      ],
    },
  ],
})}
</head><body></body></html>`;

const NOTHING = `<html><head><meta charset="utf-8"></head><body><p>Hello</p></body></html>`;

describe("shop pages", () => {
  it("reads Screwfix's JSON-LD and decodes its entities", () => {
    expect(parseProductPage(SCREWFIX, "https://www.screwfix.com/p/mira/8455J?utm_source=x")).toEqual({
      title: "Mira Sport Max 9.8kW Electric Shower White & Chrome",
      price: 229.99,
      currency: "GBP",
      siteName: "Screwfix",
      url: "https://www.screwfix.com/p/mira-sport-max-9-8kw-electric-shower-white-chrome/8455J",
      image: "https://media.screwfix.com/is/image/ae235/8455J_P",
    });
  });

  it("finds B&Q's product in an @graph, ignoring related products' prices", () => {
    const r = parseProductPage(BQ, "https://www.diy.com/departments/x/5059340092133_BQ.prd");
    expect(r).toMatchObject({
      title: "GoodHome Cavally Ceramic Close-coupled Toilet with Soft close seat",
      price: 179,
      url: "https://www.diy.com/departments/goodhome-cavally-toilet/5059340092133_BQ.prd",
    });
  });

  it("takes an AggregateOffer's low price from nested arrays (Argos)", () => {
    expect(parseProductPage(ARGOS, "https://www.argos.co.uk/product/9461052")).toMatchObject({
      title: "Argos Home Ava Fabric 3 Seater Sofa - Grey",
      price: 349,
      currency: "GBP",
      siteName: "Argos",
    });
  });

  it("falls back to product meta tags and resolves a relative image (IKEA)", () => {
    expect(parseProductPage(IKEA, "https://www.ikea.com/gb/en/p/malm-chest-of-6-drawers-white-80403555/")).toMatchObject({
      title: "MALM Chest of 6 drawers, white, 80x123 cm",
      price: 150,
      siteName: "ikea.com",
      image: "https://www.ikea.com/images/products/malm-chest.jpg",
    });
  });

  it("reads Amazon's own markup when it serves the page", () => {
    expect(parseProductPage(AMAZON, "https://www.amazon.co.uk/dp/B08XYZ")).toMatchObject({
      title: "Bosch Cordless Lawnmower CityMower 18V-32-300",
      price: 189.99,
    });
  });

  it("returns nothing useful from Amazon's robot check", () => {
    expect(parseProductPage(AMAZON_BLOCKED, "https://www.amazon.co.uk/dp/B08XYZ")).toMatchObject({
      title: "Amazon.co.uk",
      price: null,
    });
  });

  it("reads microdata and strips the domain suffix (Wickes)", () => {
    expect(parseProductPage(WICKES, "https://www.wickes.co.uk/Wickes-Vinyl-Silk-Magnolia-5L/p/123")).toMatchObject({
      title: "Wickes Vinyl Silk Emulsion Paint - Magnolia 5L",
      price: 22,
    });
  });

  it("reads priceSpecification and takes the sale price (Toolstation)", () => {
    expect(parseProductPage(TOOLSTATION, "https://www.toolstation.com/dewalt-drill/p12345")).toMatchObject({
      title: "Dewalt DCD796 18V XR Brushless Combi Drill",
      price: 99.98,
    });
  });

  it("copes with a page that has nothing", () => {
    expect(parseProductPage(NOTHING, "https://example.com/")).toEqual({
      title: null,
      price: null,
      currency: null,
      siteName: "example.com",
      url: "https://example.com/",
    });
  });

  it("survives broken JSON-LD and uses the meta tags instead", () => {
    const html = `<script type="application/ld+json">{"@type":"Product", oops</script><meta property="og:title" content="Kettle"><meta property="og:price:amount" content="29.99"><meta property="og:price:currency" content="GBP">`;
    expect(parseProductPage(html, "https://shop.example.com/kettle")).toMatchObject({ title: "Kettle", price: 29.99 });
  });
});

describe("currency", () => {
  const page = (price: string, currency?: string) =>
    ld({ "@type": "Product", name: "Thing", offers: { price, ...(currency ? { priceCurrency: currency } : {}) } });

  it("ignores prices in other currencies, without converting", () => {
    expect(parseProductPage(page("49.99", "EUR"), "https://www.ikea.com/ie/en/p/x")).toMatchObject({ price: null, currency: "EUR" });
    expect(parseProductPage(page("$49.99"), "https://www.example.com/x").price).toBeNull();
  });
  it("trusts an unmarked price only on a UK site", () => {
    expect(parseProductPage(page("49.99"), "https://www.example.co.uk/x").price).toBe(49.99);
    expect(parseProductPage(page("49.99"), "https://www.example.com/x").price).toBeNull();
  });
  it("reads thousands separators and a £ sign", () => {
    expect(parseProductPage(page("£1,299.00"), "https://www.example.com/x").price).toBe(1299);
  });
  it("skips per-unit prices and zero prices", () => {
    const html = ld({
      "@type": "Product",
      name: "Paint",
      offers: [
        { price: 0, priceCurrency: "GBP" },
        { price: 30, priceCurrency: "GBP", priceSpecification: { price: 6, priceCurrency: "GBP", referenceQuantity: { value: 1, unitCode: "LTR" } } },
      ],
    });
    expect(parseProductPage(html, "https://x.co.uk/").price).toBe(30);
  });
});

describe("titles", () => {
  it("strips shop names at either end, but not a product's own dash", () => {
    expect(cleanTitle("Kettle | Screwfix.com", "https://www.screwfix.com/p/1")).toBe("Kettle");
    expect(cleanTitle("Garden hose - B&amp;Q", "https://www.diy.com/x", "B&Q")).toBe("Garden hose");
    expect(cleanTitle("IKEA - KALLAX Shelving unit", "https://www.ikea.com/gb/en/p/x")).toBe("KALLAX Shelving unit");
    expect(cleanTitle("Wickes Vinyl Silk Paint - Magnolia", "https://www.wickes.co.uk/x")).toBe("Wickes Vinyl Silk Paint - Magnolia");
  });
  it("decodes HTML entities", () => {
    expect(decodeEntities("Tom &amp; Jerry&#39;s &pound;5 &#x2014; &quot;ok&quot;")).toBe("Tom & Jerry's £5 — \"ok\"");
  });
});

describe("links in quick add", () => {
  it("pulls a link out of a line and leaves the rest", () => {
    expect(splitLink("Shower https://www.screwfix.com/p/x/8455J !must")).toEqual({
      url: "https://www.screwfix.com/p/x/8455J",
      rest: "Shower !must",
    });
    expect(splitLink("www.argos.co.uk/product/123.")).toEqual({ url: "https://www.argos.co.uk/product/123", rest: "" });
    expect(splitLink("Fix tap £40")).toEqual({ url: null, rest: "Fix tap £40" });
  });
  it("makes a title from the link when the page can't be read", () => {
    expect(titleFromUrl("https://www.screwfix.com/p/mira-sport-max-electric-shower/8455J")).toBe("Mira sport max electric shower");
    expect(titleFromUrl("https://www.ikea.com/gb/en/p/malm-chest-of-6-drawers-white-80403555/")).toBe("Malm chest of 6 drawers white");
    expect(titleFromUrl("https://www.amazon.co.uk/Bosch-Cordless-Lawnmower-CityMower/dp/B08XYZ")).toBe("Bosch Cordless Lawnmower CityMower");
    expect(titleFromUrl("https://www.diy.com/departments/goodhome-cavally-toilet/5059340092133_BQ.prd")).toBe("Goodhome cavally toilet");
    expect(titleFromUrl("https://www.argos.co.uk/product/9461052")).toBe("Something from argos.co.uk");
  });
});

describe("SSRF guards", () => {
  it("refuses private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["151.101.1.1", "8.8.8.8", "23.45.67.89", "104.16.0.1", "2a00:1450:4009:81f::200e", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
  it("refuses other schemes, ports and private hosts before fetching", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/",
      "http://localhost/",
      "http://[::1]/",
      "http://2130706433/",
      "file:///etc/passwd",
      "ftp://example.com/",
      "javascript:alert(1)",
      "https://example.com:8443/",
      "https://user:pw@example.com/",
      "http://printer.local/",
    ]) {
      expect(() => checkUrl(url), url).toThrow();
    }
    expect(checkUrl("https://www.screwfix.com:443/p/x").href).toBe("https://www.screwfix.com/p/x");
  });
});
