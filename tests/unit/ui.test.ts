import { describe, expect, it } from "vitest";
import { likeChipTone, timeAgo } from "../../src/lib/ui";

describe("likeChipTone", () => {
  it.each([
    [4, false, 5, "gray"],
    [7, false, 10, "orange"],
    [4, false, 10, "gray"],
    [1, true, 5, "red"],
  ] as const)("returns %s/%s/%s as %s", (count, isBest, threshold, expected) => {
    expect(likeChipTone(count, isBest, threshold)).toBe(expected);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  it.each([
    [59, "방금"], [60, "1분 전"], [840, "14분 전"], [3600, "1시간 전"],
    [10800, "3시간 전"], [172800, "2일 전"], [604800, "7일 전"], [691200, "2026.11.06"],
  ])("formats %s seconds ago", (seconds, expected) => {
    expect(timeAgo(new Date(now.getTime() - seconds * 1000).toISOString(), now)).toBe(expected);
  });
});
