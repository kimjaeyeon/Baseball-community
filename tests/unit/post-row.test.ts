import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import PostRow from "../../src/components/PostRow";
import { readPost, markPostRead } from "../../src/lib/read-posts";
import type { PostListItem } from "../../src/lib/posts";

const post: PostListItem = { id: 7, board: { slug: "kbo", name: "KBO" }, kind: "text", title: "제목", url: null, thumb_path: null, like_count: 2, comment_count: 0, view_count: 12, is_best: false, created_at: new Date().toISOString(), author: { nickname: "팬" } };
afterEach(() => vi.unstubAllGlobals());
it("renders a fixed 64px thumbnail instead of the board block", () => {
  const html = renderToStaticMarkup(createElement(PostRow, { post: { ...post, thumb_path: "fan/x_t.webp" } }));
  expect(html).toContain("/post-images/fan/x_t.webp");
  expect(html).toContain('width="64"');
  expect(html).toContain('height="64"');
  expect(html).not.toContain("[0]");
});
it("renders board and link fallbacks and positive comment count", () => {
  expect(renderToStaticMarkup(createElement(PostRow, { post }))).toContain("KBO</span>");
  const html = renderToStaticMarkup(createElement(PostRow, { post: { ...post, kind: "link", url: "https://example.com/story", comment_count: 3 } }));
  expect(html).toContain("example.com");
  expect(html).toContain("[3]");
});
it("records reading without duplicates and tolerates storage errors", () => {
  let value: string | null = null;
  vi.stubGlobal("localStorage", { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } });
  markPostRead(7); markPostRead(7);
  expect(value).toBe("[7]");
  expect(readPost(7)).toBe(true);
  expect(readPost(8)).toBe(false);
  value = "invalid JSON";
  expect(readPost(7)).toBe(false);
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  expect(() => markPostRead(7)).not.toThrow();
  expect(readPost(7)).toBe(false);
});
