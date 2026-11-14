import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const { getPost, rpc, from, getUser, getCookie } = vi.hoisted(() => ({ getPost: vi.fn(), rpc: vi.fn(), from: vi.fn(), getUser: vi.fn(), getCookie: vi.fn() }));
vi.mock("@/lib/posts", () => ({ getPost }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from, auth: { getUser } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import PostPage from "../../src/app/[board]/[id]/page";

beforeEach(() => {
  vi.resetAllMocks();
  getPost.mockResolvedValue({ id: 7, board: { slug: "kbo", name: "KBO" }, author: { nickname: "작성자" }, author_id: "a", title: "테스트 글", body: "본문", kind: "text", like_count: 0, view_count: 42, created_at: "2026-11-14T01:00:00Z" });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  getCookie.mockReturnValue({ value: "guest-key" });
  rpc.mockResolvedValue({ error: null });
  from.mockImplementation((table: string) => {
    const query = {
      select: () => query, eq: () => query, order: () => query,
      maybeSingle: async () => ({ data: { view_count: 43 }, error: null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: table === "posts" ? { view_count: 43 } : [], error: null })),
    };
    return query;
  });
});

it("counts with the visitor cookie and displays the fresh counter in the same render", async () => {
  const html = renderToStaticMarkup(await PostPage({ params: Promise.resolve({ board: "kbo", id: "7" }) } as never));
  expect(rpc).toHaveBeenCalledWith("increment_view", { p_post_id: 7, p_viewer_key: "guest-key" });
  expect(html).toContain("조회 43");
});

it("does not count an invalid board or missing post", async () => {
  await expect(PostPage({ params: Promise.resolve({ board: "mlb", id: "7" }) } as never)).rejects.toThrow("NOT_FOUND");
  getPost.mockResolvedValue(null);
  await expect(PostPage({ params: Promise.resolve({ board: "kbo", id: "7" }) } as never)).rejects.toThrow("NOT_FOUND");
  expect(rpc).not.toHaveBeenCalled();
});

it("does not silently ignore a failed view RPC", async () => {
  rpc.mockResolvedValue({ error: { message: "offline" } });
  await expect(PostPage({ params: Promise.resolve({ board: "kbo", id: "7" }) } as never)).rejects.toThrow();
});

it.each(["post", "comment"])("shows the current %s report even after more than 1000 unrelated reports", async (targetType) => {
  getUser.mockResolvedValue({ data: { user: { id: "reader" } }, error: null });
  const fallback = from.getMockImplementation()!;
  from.mockImplementation((table: string) => {
    if (table === "comments" && targetType === "comment") {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: [{
          id: 7, author_id: "a", parent_id: null, body: "댓글", created_at: "2026-11-14T01:00:00Z",
          deleted_at: null, author: { nickname: "작성자" },
        }], error: null })),
      };
      return query;
    }
    if (table !== "reports") return fallback(table);
    let rows = [
      ...Array.from({ length: 1000 }, (_, i) => ({ target_type: "post", target_id: i + 100 })),
      { target_type: targetType, target_id: 7 },
    ];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key as keyof typeof r] === value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[key as keyof typeof r])); return query; },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: rows.slice(0, 1000), error: null })),
    };
    return query;
  });
  const html = renderToStaticMarkup(await PostPage({ params: Promise.resolve({ board: "kbo", id: "7" }) } as never));
  expect(html).toContain("🚩 신고됨");
});

it("does not display an unreported state when report loading fails", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "reader" } }, error: null });
  const fallback = from.getMockImplementation()!;
  from.mockImplementation((table: string) => {
    if (table !== "reports") return fallback(table);
    const query = {
      select: () => query, eq: () => query, in: () => query,
      maybeSingle: async () => ({ data: null, error: { message: "offline" } }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: { message: "offline" } })),
    };
    return query;
  });
  await expect(PostPage({ params: Promise.resolve({ board: "kbo", id: "7" }) } as never)).rejects.toThrow("신고 상태를 불러오지 못했습니다");
});
