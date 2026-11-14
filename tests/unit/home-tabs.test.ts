import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/posts", () => ({ listPosts: async () => ({ items: [], nextCursor: null }) }));
import Home from "../../src/app/page";

it.each([
  { tab: undefined, active: "베스트", inactive: "최신" },
  { tab: "best", active: "베스트", inactive: "최신" },
  { tab: "new", active: "최신", inactive: "베스트" },
  { tab: "unknown", active: "베스트", inactive: "최신" },
])("marks and visually emphasizes $active for tab=$tab", async ({ tab, active, inactive }) => {
  const html = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({ tab }) } as never));
  const activeLink = html.match(new RegExp(`<a\\b[^>]*>${active}</a>`))?.[0];
  const inactiveLink = html.match(new RegExp(`<a\\b[^>]*>${inactive}</a>`))?.[0];
  expect(activeLink).toContain('aria-current="page"');
  expect(inactiveLink).toBeDefined();
  expect(inactiveLink).not.toContain("aria-current");
  expect(activeLink).toContain("font-bold");
  expect(activeLink).toContain("underline");
  expect(inactiveLink).not.toContain("font-bold");
  expect(inactiveLink).not.toContain("underline");
});
