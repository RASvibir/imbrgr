import { describe, expect, it } from "vitest";
import { fetchRemoteFile, isPublicIp, RemoteFetchError } from "@/lib/safe-remote-fetch";

const opts = { allowMime: () => true, maxBytesFor: () => 1024 };

describe("isPublicIp", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "172.15.255.255",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows public address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::7f00:1",
    "2001:db8::1",
    "2002:7f00:1::1",
    "not-an-ip",
  ])("blocks non-public address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });
});

describe("fetchRemoteFile rejects unsafe targets before connecting", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/a.png",
    "http://user:pass@example.com/a.png",
    "http://example.com:22/a.png",
    "http://127.0.0.1/a.png",
    "http://127.0.0.1:80/a.png",
    "http://[::1]/a.png",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/a.png",
    "http://2130706433/a.png",
    "http://localhost/a.png",
  ])("%s", async (url) => {
    const err = await fetchRemoteFile(url, opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RemoteFetchError);
    // Must be rejected as disallowed, not as a generic network failure.
    expect((err as RemoteFetchError).message).toBe("That URL isn't allowed");
  });

  it("rejects malformed URLs", async () => {
    await expect(fetchRemoteFile("not a url", opts)).rejects.toThrow("Invalid URL");
  });
});
