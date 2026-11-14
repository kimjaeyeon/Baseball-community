import { expect, it, vi } from "vitest";
const { listPosts } = vi.hoisted(() => ({ listPosts: vi.fn() }));
vi.mock("@/lib/posts", () => ({ listPosts }));
import { loadMorePosts } from "../../src/app/actions";
it("returns the public list page through an explicit action boundary", async () => {
  const page = { items: [], nextCursor: null };
  listPosts.mockResolvedValue(page);
  expect(await loadMorePosts({ board: "kbo", cursor: "next" })).toEqual(page);
});
