import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/** Error whose message is safe to show to the end user. */
export class RemoteFetchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RemoteFetchError";
    this.status = status;
  }
}

const BLOCKED_MESSAGE = "That URL isn't allowed";

function parseIpv4(input: string): number[] | null {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN));
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return null;
  return nums;
}

function isPublicIpv4Octets(o: number[]): boolean {
  const [a, b, c] = o;
  if (a === 0) return false; // "this" network
  if (a === 10) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 0 && c === 0) return false; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return false; // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay
  if (a === 192 && b === 168) return false; // private
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

function parseIpv6(input: string): number[] | null {
  let s = input.split("%")[0]!.toLowerCase();
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const rest = halves[1] ? halves[1].split(":") : [];
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...Array<string>(fill).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : Number.NaN));
  return nums.some((n) => Number.isNaN(n)) ? null : nums;
}

function ipv4FromGroups(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 255, lo >> 8, lo & 255];
}

/** True only for globally routable unicast addresses. Anything unparseable is rejected. */
export function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const o = parseIpv4(address);
    return o ? isPublicIpv4Octets(o) : false;
  }
  if (family === 6) {
    const g = parseIpv6(address);
    if (!g) return false;
    // IPv4-mapped (::ffff:a.b.c.d)
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
      return isPublicIpv4Octets(ipv4FromGroups(g[6]!, g[7]!));
    }
    // NAT64 well-known prefix (64:ff9b::/96): judge the embedded IPv4
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
      return isPublicIpv4Octets(ipv4FromGroups(g[6]!, g[7]!));
    }
    // Only global unicast 2000::/3 is public (excludes ::, ::1, fc00::/7, fe80::/10, ff00::/8, ...)
    if ((g[0]! & 0xe000) !== 0x2000) return false;
    if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
    if (g[0] === 0x2001 && g[1] === 0) return false; // Teredo
    if (g[0] === 0x2002) return isPublicIpv4Octets(ipv4FromGroups(g[1]!, g[2]!)); // 6to4
    return true;
  }
  return false;
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const literal = net.isIP(host);
  if (literal) {
    if (!isPublicIp(host)) throw new RemoteFetchError(BLOCKED_MESSAGE);
    return { address: host, family: literal as 4 | 6 };
  }
  let results: { address: string; family: number }[];
  try {
    results = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new RemoteFetchError("Could not fetch URL");
  }
  if (results.length === 0) throw new RemoteFetchError("Could not fetch URL");
  // Reject if ANY answer is non-public, so a mixed answer can't be used to reach an internal host.
  if (results.some((r) => !isPublicIp(r.address))) throw new RemoteFetchError(BLOCKED_MESSAGE);
  return { address: results[0]!.address, family: results[0]!.family as 4 | 6 };
}

function assertAllowedUrlShape(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new RemoteFetchError(BLOCKED_MESSAGE);
  if (url.username || url.password) throw new RemoteFetchError(BLOCKED_MESSAGE);
  if (url.port && url.port !== "80" && url.port !== "443") throw new RemoteFetchError(BLOCKED_MESSAGE);
}

function requestPinned(
  url: URL,
  pinned: { address: string; family: 4 | 6 },
  signal: AbortSignal,
): Promise<http.IncomingMessage> {
  const lib = url.protocol === "https:" ? https : http;
  // Connect to the already-validated IP so a second DNS answer (rebinding) can't change the target.
  const lookup = ((_host: string, options: { all?: boolean }, cb: (...args: unknown[]) => void) => {
    if (options?.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
    else cb(null, pinned.address, pinned.family);
  }) as unknown as net.LookupFunction;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: "GET",
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          "user-agent": "imbrgr-import/1.0",
          accept: "image/*,video/*",
          "accept-encoding": "identity",
        },
        lookup,
        signal,
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

export type RemoteFile = { buffer: Buffer; mime: string; filename: string; finalUrl: string };

export async function fetchRemoteFile(
  rawUrl: string,
  opts: {
    /** Return false for content types that must not be imported. */
    allowMime: (mime: string) => boolean;
    /** Max bytes allowed for a given content type. */
    maxBytesFor: (mime: string) => number;
    timeoutMs?: number;
    maxRedirects?: number;
  },
): Promise<RemoteFile> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000);
  const maxRedirects = opts.maxRedirects ?? 3;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new RemoteFetchError("Invalid URL");
  }

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      assertAllowedUrlShape(current);
      const pinned = await resolvePublicAddress(current.hostname);
      const res = await requestPinned(current, pinned, signal);
      const status = res.statusCode ?? 0;

      if ([301, 302, 303, 307, 308].includes(status)) {
        res.resume();
        const location = res.headers.location;
        if (!location) throw new RemoteFetchError("Could not fetch URL");
        try {
          current = new URL(location, current);
        } catch {
          throw new RemoteFetchError("Could not fetch URL");
        }
        continue;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        throw new RemoteFetchError("Could not fetch URL");
      }

      const mime = (res.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
      if (!opts.allowMime(mime)) {
        res.resume();
        throw new RemoteFetchError(`Unsupported type: ${mime || "unknown"}`);
      }
      const limit = opts.maxBytesFor(mime);
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > limit) {
        res.destroy();
        throw new RemoteFetchError("File too large");
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of res) {
        const buf = chunk as Buffer;
        total += buf.byteLength;
        if (total > limit) {
          res.destroy();
          throw new RemoteFetchError("File too large");
        }
        chunks.push(buf);
      }

      const last = decodeURIComponentSafe(current.pathname.split("/").pop() ?? "");
      const filename = last.replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "remote";
      return { buffer: Buffer.concat(chunks), mime, filename, finalUrl: current.toString() };
    }
    throw new RemoteFetchError("Too many redirects");
  } catch (e) {
    if (e instanceof RemoteFetchError) throw e;
    if (signal.aborted) throw new RemoteFetchError("The remote server took too long", 504);
    throw new RemoteFetchError("Could not fetch URL");
  }
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
