import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  putFile,
  takeFile,
  HANDOFF_EXPIRY_MS,
  _clearMemoryStore,
  _getMemoryStoreSize,
} from "./handoff";

describe("Landing handoff storage (in-memory path)", () => {
  beforeEach(() => {
    _clearMemoryStore();
    vi.useRealTimers();
  });

  it("stores a file and retrieves it via takeFile", async () => {
    const file = new File(["burger content"], "sample.png", {
      type: "image/png",
      lastModified: 1700000000000,
    });

    const id = await putFile(file);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(_getMemoryStoreSize()).toBe(1);

    const retrieved = await takeFile(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe("sample.png");
    expect(retrieved?.type).toBe("image/png");

    // Verify content
    const text = await retrieved!.text();
    expect(text).toBe("burger content");
  });

  it("deletes the entry after it is taken (one-time consumption)", async () => {
    const file = new File(["crispy fries"], "fries.jpg", {
      type: "image/jpeg",
    });

    const id = await putFile(file);
    const firstTake = await takeFile(id);
    expect(firstTake).not.toBeNull();

    // Second take should be null because it was consumed
    const secondTake = await takeFile(id);
    expect(secondTake).toBeNull();
    expect(_getMemoryStoreSize()).toBe(0);
  });

  it("returns null for unknown IDs", async () => {
    const res = await takeFile("non_existent_id");
    expect(res).toBeNull();
  });

  it("expires entries after 10 minutes", async () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    const file = new File(["patty"], "patty.png", { type: "image/png" });
    const id = await putFile(file);

    // Fast forward 9 minutes -> still valid
    vi.setSystemTime(now + 9 * 60 * 1000);
    // Don't take yet; verify expiry calculation
    expect(HANDOFF_EXPIRY_MS).toBe(600000);

    // Fast forward to 10 minutes + 1 second
    vi.setSystemTime(now + 10 * 60 * 1000 + 1000);

    const expired = await takeFile(id);
    expect(expired).toBeNull();
    expect(_getMemoryStoreSize()).toBe(0);
  });

  it("stores and retrieves multiple files independently", async () => {
    const file1 = new File(["file1"], "1.png", { type: "image/png" });
    const file2 = new File(["file2"], "2.png", { type: "image/png" });

    const id1 = await putFile(file1);
    const id2 = await putFile(file2);

    expect(id1).not.toBe(id2);
    expect(_getMemoryStoreSize()).toBe(2);

    const taken1 = await takeFile(id1);
    expect(taken1?.name).toBe("1.png");
    expect(_getMemoryStoreSize()).toBe(1);

    const taken2 = await takeFile(id2);
    expect(taken2?.name).toBe("2.png");
    expect(_getMemoryStoreSize()).toBe(0);
  });
});
