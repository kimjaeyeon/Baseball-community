import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../src/lib/cursor";

describe("post cursors", () => {
  it("preserves timestamp microseconds and id for tied posts", () => {
    const at = "2026-11-14T00:00:00.123456+00:00";
    expect(decodeCursor(encodeCursor(at, 7))).toEqual({ at, id: 7 });
  });
  it.each(["garbage", "", Buffer.from('{"at":"bad","id":7}').toString("base64url"),
    Buffer.from('{"at":"2026-11-14T00:00:00Z","id":"7"}').toString("base64url"),
    Buffer.from('{"at":"2026-11-14T00:00:00Z","id":-1}').toString("base64url")])("rejects invalid cursor %s", (s) => {
    expect(decodeCursor(s)).toBeNull();
  });
});
