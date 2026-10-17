import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";

// Fetching a page someone pasted, from inside our own network, is how SSRF
// happens: a link to 169.254.169.254 or localhost would have the server read
// itself. So: web ports only, every address checked as the connection is made
// (not just beforehand, or a DNS answer could change in between), redirects
// followed by hand and checked again, and a short leash on time and size.

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 6_000;
const MAX_BYTES = 1_500_000;
// A product photo for a board is shrunk on the phone; this only bounds the download.
const MAX_IMAGE_BYTES = 8_000_000;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, including the cloud metadata service
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  // (IPv4-mapped addresses are unwrapped and checked as IPv4 below; a
  // ::ffff:0:0/96 rule here would match every IPv4 address.)
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4, which can wrap a private IPv4 address
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // old site-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** Whether an address is somewhere a public web page can't be. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "");
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family !== 6) return true;
  // ::ffff:10.0.0.1 (or ::ffff:a00:1) is 10.0.0.1 in disguise.
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) return blocked.check(dotted[1], "ipv4");
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
    return blocked.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, "ipv4");
  }
  return blocked.check(ip, "ipv6");
}

export class UnreadablePage extends Error {
  /** True when the link itself was refused, rather than the page failing to load. */
  refused: boolean;
  constructor(message: string, refused = false) {
    super(message);
    this.refused = refused;
  }
}

/** A link we're willing to fetch: http(s) on the usual port, to a name or a public address. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnreadablePage("That isn't a web address", true);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnreadablePage("Only web links can be read", true);
  // URL drops a default port, so anything left is a non-standard one.
  if (url.port) throw new UnreadablePage("Only ordinary web links can be read", true);
  if (url.username || url.password) throw new UnreadablePage("Links with passwords can't be read", true);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) ? isPrivateAddress(host) : !host.includes(".") || /\.(local|localhost|internal)$/i.test(host)) {
    throw new UnreadablePage("That address is private", true);
  }
  return url;
}

// Resolves as Node would, then refuses the connection if any answer is private.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error(`Refused private address for ${hostname}`), { code: "EPRIVATE" }), "", 0);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  "Accept-Language": "en-GB,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

type Hop = { status: number; location: string | null; contentType: string; body: Buffer };

/** What a request will take: a page (its head is enough, so it's cut short) or a whole image. */
type Want = { accept: RegExp; header: string; max: number; whole: boolean };
const PAGE: Want = { accept: /^(text\/html|application\/xhtml\+xml)/i, header: HEADERS.Accept, max: MAX_BYTES, whole: false };
const IMAGE: Want = { accept: /^image\/(jpeg|png|webp|gif|avif)/i, header: "image/avif,image/webp,image/*;q=0.8", max: MAX_IMAGE_BYTES, whole: true };

function request(url: URL, signal: AbortSignal, want: Want = PAGE): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      { method: "GET", headers: { ...HEADERS, Accept: want.header }, lookup: safeLookup, signal, agent: false },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = String(res.headers["content-type"] ?? "");
        if ((status >= 300 && status < 400) || status >= 400 || !want.accept.test(contentType)) {
          res.resume();
          return resolve({ status, location, contentType, body: Buffer.alloc(0) });
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "br"
            ? res.pipe(zlib.createBrotliDecompress())
            : encoding === "gzip" || encoding === "x-gzip"
              ? res.pipe(zlib.createGunzip())
              : encoding === "deflate"
                ? res.pipe(zlib.createInflate())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        const done = () => resolve({ status, location, contentType, body: Buffer.concat(chunks) });
        stream.on("data", (chunk: Buffer) => {
          // An image cut short is broken, so one that's too big is refused.
          if (want.whole && size + chunk.length > want.max) {
            req.destroy();
            return reject(new UnreadablePage("That picture is too big"));
          }
          // Enough for the <head> and any product data; stop reading the rest.
          const room = want.max - size;
          chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
          size += Math.min(chunk.length, room);
          if (size >= want.max) {
            done();
            req.destroy();
          }
        });
        // A connection cut short still leaves whatever <head> arrived.
        const cut = (err: Error) => (size && !want.whole ? done() : reject(err));
        stream.on("end", done);
        stream.on("error", cut);
        res.on("error", cut);
        res.on("close", () => !res.complete && cut(new Error("Connection closed early")));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function decode(body: Buffer, contentType: string): string {
  const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? body.subarray(0, 2048).toString("latin1").match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** One request and its redirects, each hop checked like the first, ending at a 2xx. */
async function fetchChecked(raw: string, want: Want): Promise<{ res: Hop; url: URL }> {
  let url = checkUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Hop;
    try {
      res = await request(url, signal, want);
    } catch (err) {
      if (err instanceof UnreadablePage) throw err;
      const refused = (err as { code?: string }).code === "EPRIVATE";
      throw new UnreadablePage(refused ? "That address is private" : "Couldn't reach that page", refused);
    }
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new UnreadablePage("That page went nowhere");
      // Every hop gets the same checks as the first link.
      url = checkUrl(new URL(res.location, url).href);
      continue;
    }
    if (res.status >= 400) throw new UnreadablePage(`That shop said no (${res.status})`);
    return { res, url };
  }
  throw new UnreadablePage("Too many redirects");
}

/** The page's HTML and the address it finally came from, or UnreadablePage. */
export async function fetchPage(raw: string): Promise<{ html: string; url: string }> {
  const { res, url } = await fetchChecked(raw, PAGE);
  if (!res.body.length) throw new UnreadablePage("That link isn't a web page");
  return { html: decode(res.body, res.contentType), url: url.href };
}

/** A picture from a product page, whole, or UnreadablePage. */
export async function fetchImage(raw: string): Promise<{ bytes: Buffer; contentType: string }> {
  const { res } = await fetchChecked(raw, IMAGE);
  if (!res.body.length) throw new UnreadablePage("That link isn't a picture");
  return { bytes: res.body, contentType: res.contentType.split(";")[0].trim() };
}

/**
 * Where a share link (amzn.eu/d/…) leads: its redirects followed, with the
 * same checks, until `arrived` says this is the place. That last address is
 * never requested, so a shop that turns servers away doesn't matter.
 */
export async function followRedirects(raw: string, arrived: (url: URL) => boolean): Promise<string> {
  let url = checkUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (arrived(url)) return url.href;
    let res: Hop;
    try {
      res = await request(url, signal);
    } catch (err) {
      const refused = (err as { code?: string }).code === "EPRIVATE";
      throw new UnreadablePage(refused ? "That address is private" : "Couldn't reach that page", refused);
    }
    if (res.status < 300 || res.status >= 400 || !res.location) return url.href;
    url = checkUrl(new URL(res.location, url).href);
  }
  throw new UnreadablePage("Too many redirects");
}
